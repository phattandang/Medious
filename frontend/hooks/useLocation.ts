import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { locationApi } from '../lib/api';
import type { LocationCoords } from '../types';

interface UseLocationOptions {
  token: string | null;
  enabled?: boolean;
  updateInterval?: number; // ms
}

interface UseLocationReturn {
  location: LocationCoords | null;
  loading: boolean;
  error: string | null;
  permissionStatus: Location.PermissionStatus | null;
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<void>;
  updateServerLocation: () => Promise<void>;
}

export function useLocation(options: UseLocationOptions): UseLocationReturn {
  const { token, enabled = true, updateInterval = 60000 } = options;

  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  // Check current permission status
  const checkPermission = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
      return status === 'granted';
    } catch (err) {
      console.error('Error checking permission:', err);
      return false;
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== 'granted') {
        setError('Location permission denied');
        return false;
      }

      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to request permission');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get current location
  const getCurrentLocation = useCallback(async (): Promise<LocationCoords | null> => {
    try {
      const hasPermission = await checkPermission();
      if (!hasPermission) {
        return null;
      }

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords: LocationCoords = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
      };

      setLocation(coords);
      return coords;
    } catch (err: any) {
      console.error('Error getting location:', err);
      setError(err.message || 'Failed to get location');
      return null;
    }
  }, [checkPermission]);

  // Refresh location manually
  const refreshLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    await getCurrentLocation();
    setLoading(false);
  }, [getCurrentLocation]);

  // Update server with current location
  const updateServerLocation = useCallback(async () => {
    if (!token || !location) {
      return;
    }

    try {
      await locationApi.updateLocation(token, location.latitude, location.longitude);
    } catch (err: any) {
      console.error('Error updating server location:', err);
      // Don't set error here as it's a background operation
    }
  }, [token, location]);

  // Initial permission check
  useEffect(() => {
    if (enabled) {
      checkPermission();
    }
  }, [enabled, checkPermission]);

  // Get initial location when permission is granted
  useEffect(() => {
    if (enabled && permissionStatus === 'granted') {
      getCurrentLocation();
    }
  }, [enabled, permissionStatus, getCurrentLocation]);

  return {
    location,
    loading,
    error,
    permissionStatus,
    requestPermission,
    refreshLocation,
    updateServerLocation,
  };
}

export default useLocation;
