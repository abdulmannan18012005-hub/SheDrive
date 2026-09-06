import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { Coordinates } from '../types';

export const LAHORE_DEFAULT_COORDINATES: Coordinates = {
  latitude: 31.5204,
  longitude: 74.3587,
};

interface UseLocationResult {
  location: Coordinates | null;
  errorMessage: string | null;
  isLoading: boolean;
  hasPermission: boolean;
  isGpsEnabled: boolean;
  refreshLocation: () => Promise<void>;
}

// 0.0001 degrees latitude/longitude is ~11.1 meters in Lahore
const MIN_DISTANCE_THRESHOLD = 0.0001;

function isSignificantShift(prev: Coordinates | null, next: Coordinates): boolean {
  if (!prev) return true;
  const dLat = Math.abs(prev.latitude - next.latitude);
  const dLng = Math.abs(prev.longitude - next.longitude);
  return dLat > MIN_DISTANCE_THRESHOLD || dLng > MIN_DISTANCE_THRESHOLD;
}

/**
 * Enterprise-grade location hook with debouncing, distance thresholding,
 * and resilient non-blocking fallback coordinates.
 */
export function useLocation(enableLiveWatcher: boolean = true): UseLocationResult {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isGpsEnabled, setIsGpsEnabled] = useState<boolean>(true);

  const lastCoordsRef = useRef<Coordinates | null>(null);
  const watcherSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const updateLocationIfShifted = useCallback((newCoords: Coordinates) => {
    if (!isMountedRef.current) return;
    if (isSignificantShift(lastCoordsRef.current, newCoords)) {
      lastCoordsRef.current = newCoords;
      setLocation(newCoords);
    }
  }, []);

  const fetchLocation = useCallback(async (isSilent: boolean = false) => {
    if (!isMountedRef.current) return;

    try {
      if (!isSilent && !lastCoordsRef.current) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      // Step 1: Check if Location Services are switched on
      const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
      if (!isMountedRef.current) return;
      setIsGpsEnabled(servicesEnabled);

      if (!servicesEnabled) {
        setErrorMessage('Please turn on your device location to find nearby drivers.');
        setIsLoading(false);
        return;
      }

      // Step 2: Request foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMountedRef.current) return;

      if (status !== 'granted') {
        setHasPermission(false);
        setErrorMessage('Location permission was denied. Please enable location access in device settings.');
        setIsLoading(false);
        return;
      }

      setHasPermission(true);

      // Step 3: Fast-path: get last known location immediately
      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (isMountedRef.current && lastKnown && lastKnown.coords) {
        updateLocationIfShifted({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      // Step 4: Fresh high-accuracy satellite fix (with 4-second resilient timeout)
      const freshPosition = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]).catch(() => null) as Location.LocationObject | null;

      if (isMountedRef.current && freshPosition && freshPosition.coords) {
        updateLocationIfShifted({
          latitude: freshPosition.coords.latitude,
          longitude: freshPosition.coords.longitude,
        });
      } else if (isMountedRef.current && !lastCoordsRef.current) {
        // Resilient fallback: ensure coordinates are never null
        updateLocationIfShifted(LAHORE_DEFAULT_COORDINATES);
      }

      // Step 5: Start live position watcher if requested (with 10m threshold)
      if (enableLiveWatcher && !watcherSubscriptionRef.current) {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (newPosition) => {
            if (isMountedRef.current && newPosition && newPosition.coords) {
              updateLocationIfShifted({
                latitude: newPosition.coords.latitude,
                longitude: newPosition.coords.longitude,
              });
            }
          }
        );
        watcherSubscriptionRef.current = sub;
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        console.warn('Location acquisition error:', error);
        setErrorMessage(error?.message || 'Unable to retrieve current location. Please verify GPS.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enableLiveWatcher, updateLocationIfShifted]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchLocation(false);

    // Listen to AppState (e.g. user goes to system settings to enable GPS and returns to app)
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isMountedRef.current) {
        const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
        if (servicesEnabled) {
          fetchLocation(true); // Silent refresh so screen never flickers or unmounts
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMountedRef.current = false;
      appStateSubscription.remove();
      if (watcherSubscriptionRef.current) {
        watcherSubscriptionRef.current.remove();
        watcherSubscriptionRef.current = null;
      }
    };
  }, [fetchLocation]);

  return {
    location,
    errorMessage,
    isLoading,
    hasPermission,
    isGpsEnabled,
    refreshLocation: async () => fetchLocation(false),
  };
}

export default useLocation;
