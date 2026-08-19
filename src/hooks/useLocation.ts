import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import { Coordinates } from '../types';

interface UseLocationResult {
  location: Coordinates | null;
  errorMessage: string | null;
  isLoading: boolean;
  hasPermission: boolean;
  isGpsEnabled: boolean;
  refreshLocation: () => Promise<void>;
}

/**
 * Enterprise-grade location hook using Expo Location (Android FusedLocationProvider).
 * 1. Checks device GPS hardware state.
 * 2. Requests foreground permissions.
 * 3. Immediately obtains cached last known location for instant coordinate availability.
 * 4. Acquires fresh high-accuracy position.
 * 5. Maintains an active position watcher for smooth live updates without coordinate jumping.
 */
export function useLocation(enableLiveWatcher: boolean = true): UseLocationResult {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isGpsEnabled, setIsGpsEnabled] = useState<boolean>(true);

  const watcherSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchLocation = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      // Step 1: Check if Location Services are switched on
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!isMountedRef.current) return;
      setIsGpsEnabled(servicesEnabled);

      if (!servicesEnabled) {
        setErrorMessage('Device GPS is turned off. Please enable Location in your device settings.');
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
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (isMountedRef.current && lastKnown && lastKnown.coords) {
        setLocation({
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        });
      }

      // Step 4: Fresh high-accuracy satellite fix
      const freshPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (isMountedRef.current && freshPosition && freshPosition.coords) {
        setLocation({
          latitude: freshPosition.coords.latitude,
          longitude: freshPosition.coords.longitude,
        });
      }

      // Step 5: Start live position watcher if requested
      if (enableLiveWatcher && !watcherSubscriptionRef.current) {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (newPosition) => {
            if (isMountedRef.current && newPosition && newPosition.coords) {
              setLocation({
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
  }, [enableLiveWatcher]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchLocation();

    return () => {
      isMountedRef.current = false;
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
    refreshLocation: fetchLocation,
  };
}

export default useLocation;
