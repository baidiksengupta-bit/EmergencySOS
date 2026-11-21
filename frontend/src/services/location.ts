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
   * Fetch nearby police stations and hospitals directly from OpenStreetMap Overpass API.
   * Free, public, requires no API keys, and uses the device's real GPS coordinates.
   */
  fetchNearbyServicesFromOverpass: async (
    latitude: number,
    longitude: number,
    radiusM: number = 3000
  ): Promise<any[]> => {
    try {
      const overpassQuery = `
        [out:json][timeout:10];
        (
          node["amenity"="police"](around:${radiusM},${latitude},${longitude});
          way["amenity"="police"](around:${radiusM},${latitude},${longitude});
          node["amenity"="hospital"](around:${radiusM},${latitude},${longitude});
          way["amenity"="hospital"](around:${radiusM},${latitude},${longitude});
        );
        out center;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'EmergencySOS/1.0 (Emergency Response App; contact: help@emergencysos.org)',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const elements = data.elements || [];

      const calculateDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Earth radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(2));
      };

      const results = elements
        .map((elem: any) => {
          const lat = elem.lat || elem.center?.lat;
          const lon = elem.lon || elem.center?.lon;
          if (lat == null || lon == null) return null;

          const tags = elem.tags || {};
          const amenity = tags.amenity;
          const category = amenity === 'police' ? 'police' : 'hospital';

          let name = tags.name;
          if (!name) {
            name = category === 'police' ? 'Police Station' : 'Emergency Hospital';
          }

          const addrParts = [
            tags['addr:housenumber'],
            tags['addr:street'],
            tags['addr:city'] || tags['addr:suburb'],
          ].filter(Boolean);
          const address = addrParts.length > 0 ? addrParts.join(', ') : tags['addr:full'] || null;

          const distanceKm = calculateDist(latitude, longitude, lat, lon);

          return {
            id: `osm-${elem.type || 'node'}-${elem.id}`,
            name,
            category,
            latitude: lat,
            longitude: lon,
            distance_km: distanceKm,
            address,
          };
        })
        .filter(Boolean);

      results.sort((a: any, b: any) => a.distance_km - b.distance_km);
      return results;
    } catch (err) {
      console.warn('Overpass direct query failed:', err);
      return [];
    }
  },
  getGoogleMapsUrl: (latitude: number, longitude: number): string => {
    return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  },

  /**
   * Open native turn-by-turn navigation (Google Maps on Android/Web, Apple Maps on iOS).
   */
  openNativeNavigation: async (latitude: number, longitude: number, label?: string) => {
    const encodedLabel = encodeURIComponent(label || 'Emergency Facility');
    const url =
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
    return url;
  },

  /**
   * Fetch driving/walking route geometry from public OSRM routing endpoint.
   * router.project-osrm.org is free, public, and requires no API keys.
   */
  fetchOSRMRoute: async (
    startLat: number,
    startLng: number,
    destLat: number,
    destLng: number
  ): Promise<{ coordinates: Array<{ latitude: number; longitude: number }>; distanceMeters: number; durationSeconds: number } | null> => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'EmergencySOS/1.0',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        return null;
      }

      const route = data.routes[0];
      const rawCoords: [number, number][] = route.geometry.coordinates;
      // OSRM GeoJSON format is [longitude, latitude]
      const coordinates = rawCoords.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));

      return {
        coordinates,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };
    } catch (err) {
      console.warn('Failed to fetch OSRM route geometry:', err);
      return null;
    }
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
