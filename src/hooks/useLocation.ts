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

/**
 * Location hook that fetches GPS position ONCE on mount.
 * Does NOT use a live watcher to prevent re-render loops that cause
 * map blinking, keyboard bounce, and app crashes.
 * Call refreshLocation() explicitly to update position.
 */
export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isGpsEnabled, setIsGpsEnabled] = useState<boolean>(true);

  const lastCoordsRef = useRef<Coordinates | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const hasFetchedRef = useRef<boolean>(false);

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
      if (isMountedRef.current && lastKnown && lastKnown.coords && !lastCoordsRef.current) {
        const coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        lastCoordsRef.current = coords;
        setLocation(coords);
      }

      // Step 4: Fresh GPS fix (with 6-second timeout)
      const freshPosition = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]).catch(() => null) as Location.LocationObject | null;

      if (isMountedRef.current && freshPosition && freshPosition.coords) {
        const newCoords = {
          latitude: freshPosition.coords.latitude,
          longitude: freshPosition.coords.longitude,
        };
        lastCoordsRef.current = newCoords;
        setLocation(newCoords);
      } else if (isMountedRef.current && !lastCoordsRef.current) {
        // Resilient fallback: ensure coordinates are never null
        lastCoordsRef.current = LAHORE_DEFAULT_COORDINATES;
        setLocation(LAHORE_DEFAULT_COORDINATES);
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
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Only fetch once on mount
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchLocation(false);
    }

    // Listen to AppState (e.g. user goes to system settings to enable GPS and returns to app)
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isMountedRef.current) {
        const servicesEnabled = await Location.hasServicesEnabledAsync().catch(() => false);
        if (servicesEnabled && !lastCoordsRef.current) {
          fetchLocation(true); // Silent refresh only if we don't have coords yet
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMountedRef.current = false;
      appStateSubscription.remove();
    };
  }, []); // Empty deps - runs only once, no watcher to clean up

  return {
    location,
    errorMessage,
    isLoading,
    hasPermission,
    isGpsEnabled,
    refreshLocation: async () => {
      // Reset so manual refresh always works
      lastCoordsRef.current = null;
      await fetchLocation(false);
    },
  };
}

export default useLocation;
