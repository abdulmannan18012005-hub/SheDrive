import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Coordinates } from '../types';

interface UseLocationResult {
  location: Coordinates | null;
  errorMessage: string | null;
  isLoading: boolean;
  refreshLocation: () => Promise<void>;
}

/**
 * Hook to get the user's current device location using Expo Location.
 * Requests permissions and returns coordinates.
 */
export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Location permission was denied. Please enable location access in your device settings.');
        setIsLoading(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
    } catch (error) {
      setErrorMessage('Unable to get your current location. Please check your GPS settings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return {
    location,
    errorMessage,
    isLoading,
    refreshLocation: fetchLocation,
  };
}

export default useLocation;
