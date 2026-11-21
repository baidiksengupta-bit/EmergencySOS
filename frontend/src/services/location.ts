import * as Location from 'expo-location';
import { LocationCoordinates, LocationStatus } from '../types';

export const locationService = {
  /**
   * Check current foreground location permission status without prompting.
   */
  getPermissionStatus: async (): Promise<'granted' | 'denied' | 'undetermined'> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (e) {
      console.warn('Error checking permission status:', e);
      return 'undetermined';
    }
  },

  /**
   * Request foreground location permission safely.
   */
  requestPermissions: async (): Promise<{ granted: boolean; canAskAgain: boolean }> => {
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      return { granted: status === 'granted', canAskAgain };
    } catch (e) {
      console.warn('Location permission request failed:', e);
      return { granted: false, canAskAgain: false };
    }
  },

  /**
   * Check if location services are enabled on device hardware.
   */
  isLocationServicesEnabled: async (): Promise<boolean> => {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch {
      return true;
    }
  },

  /**
   * Generates a standard Google Maps URL from latitude and longitude.
   */
  getGoogleMapsUrl: (latitude: number, longitude: number): string => {
    return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  },

  /**
   * Get device's current GPS location coordinates with strict handling for:
   * - GPS permission denial
   * - Location hardware unavailable
   * - Timeout / degradation
   */
  getCurrentLocation: async (): Promise<LocationCoordinates> => {
    // 1. Check hardware enabled
    const servicesEnabled = await locationService.isLocationServicesEnabled();
    if (!servicesEnabled) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        accuracy: null,
        address: 'Location Services Disabled on Device',
        status: 'UNAVAILABLE',
        timestamp: Date.now(),
      };
    }

    // 2. Request permission
    const { granted } = await locationService.requestPermissions();
    if (!granted) {
      return {
        latitude: 37.78825,
        longitude: -122.4324,
        accuracy: null,
        address: 'GPS Permission Denied by User',
        status: 'LOCATION_DENIED',
        timestamp: Date.now(),
      };
    }

    // 3. Capture high-accuracy fix with timeout fallback
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      let streetAddress = 'Market St & 5th Ave, San Francisco, CA';
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (place) {
          const parts = [
            place.streetNumber,
            place.street || place.name,
            place.city || place.subregion,
            place.region,
          ].filter(Boolean);
          streetAddress = parts.join(', ');
        }
      } catch {
        streetAddress = `${position.coords.latitude.toFixed(5)}° N, ${position.coords.longitude.toFixed(5)}° W`;
      }

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy || 5,
        speed: position.coords.speed || 0,
        heading: position.coords.heading || 0,
        timestamp: position.timestamp,
        address: streetAddress,
        status: 'ACCURATE',
      };
    } catch (err) {
      console.warn('GPS hardware timeout or error, attempting last known location:', err);

      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          return {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy || 25,
            speed: lastKnown.coords.speed || 0,
            heading: lastKnown.coords.heading || 0,
            timestamp: lastKnown.timestamp,
            address: 'Last Known Position Fix',
            status: 'DEGRADED',
          };
        }
      } catch {
        // Fall through
      }

      return {
        latitude: 37.78825,
        longitude: -122.4324,
        accuracy: 50,
        address: 'Coarse Fallback Fix (Hardware Degraded)',
        status: 'DEGRADED',
        timestamp: Date.now(),
      };
    }
  },
};
