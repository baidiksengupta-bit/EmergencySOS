import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, Linking, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import {
  SOSAlert,
  EmergencyContact,
  EmergencyHistoryItem,
  BreadcrumbPoint,
  LocationCoordinates,
  NotificationDeliveryReport,
  LocationStatus,
  LocalUserProfile,
  LocalAppSettings,
  CountdownDuration,
  EmergencyPlanStatus,
  AlertStatus,
} from '../types';
import { apiService } from '../services/api';
import { locationService } from '../services/location';
import { THEME_PALETTES, ThemeColors } from '../constants/Colors';

interface SOSContextType {
  activeAlert: SOSAlert | null;
  isCountdownActive: boolean;
  countdown: number;
  isLoading: boolean;
  currentLocation: LocationCoordinates | null;
  breadcrumbs: BreadcrumbPoint[];
  contacts: EmergencyContact[];
  history: EmergencyHistoryItem[];
  profile: LocalUserProfile;
  settings: LocalAppSettings;
  themeColors: ThemeColors;
  locationPermission: 'granted' | 'denied' | 'undetermined' | 'checking';
  refreshPermissionStatus: () => Promise<'granted' | 'denied' | 'undetermined'>;
  emergencyPlanStatus: EmergencyPlanStatus;
  startSOSCountdown: () => void;
  cancelCountdown: () => void;
  triggerImmediateSOS: () => Promise<void>;
  cancelActiveSOS: (reason?: string, pin?: string) => Promise<void>;
  shareGoogleMapsLink: () => Promise<void>;
  dispatchSMSFallback: () => Promise<void>;
  refreshLocation: () => Promise<LocationCoordinates>;
  addContact: (contact: Omit<EmergencyContact, 'id'> & { id?: number }) => Promise<void>;
  updateContact: (id: number, contact: Partial<EmergencyContact>) => Promise<void>;
  deleteContact: (id: number) => Promise<void>;
  addDemoAlertRecord: (locationInfo?: {
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    alert_id?: number;
    contacts_notified_count?: number;
    notes?: string;
    status?: string;
    google_maps_url?: string;
  }) => Promise<EmergencyHistoryItem>;
  clearHistory: () => Promise<void>;
  refreshHistory: (statusFilter?: AlertStatus) => Promise<EmergencyHistoryItem[]>;
  updateProfile: (profile: Partial<LocalUserProfile>) => Promise<void>;
  updateSettings: (settings: Partial<LocalAppSettings>) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const SOSContext = createContext<SOSContextType | undefined>(undefined);

const STORAGE_CONTACTS = '@emergencysos_contacts';
export const STORAGE_DELETED_CONTACTS = '@emergencysos_deleted_contact_ids';
const STORAGE_HISTORY = '@emergencysos_history';
const STORAGE_PROFILE = '@emergencysos_profile';
const STORAGE_SETTINGS = '@emergencysos_settings';
const STORAGE_ACTIVE_ALERT = '@emergencysos_active_alert';

const DEFAULT_PROFILE: LocalUserProfile = {
  full_name: 'Alex Morgan',
  medical_notes: 'Diabetic (Type 1), penicillin allergy. Emergency contact is primary responder.',
};

const DEFAULT_SETTINGS: LocalAppSettings = {
  countdown_seconds: 5,
  vibrate_enabled: true,
  sound_alarm_enabled: true,
  theme: 'midnight_navy',
  custom_emergency_message:
    '🚨 EMERGENCY SOS: I need urgent assistance! My coordinates and health profile are attached.',
};

const INITIAL_CONTACTS: EmergencyContact[] = [
  {
    id: 1,
    name: 'Sarah Morgan',
    phone_number: '+1 (555) 234-5678',
    relationship_label: 'Spouse',
    is_primary: true,
    email: 'sarah.m@example.com',
    avatar_color: '#034078',
  },
  {
    id: 2,
    name: 'Dr. Robert Chen',
    phone_number: '+1 (555) 987-6543',
    relationship_label: 'Physician',
    is_primary: false,
    email: 'dr.chen@cityclinic.org',
    avatar_color: '#0D3B66',
  },
  {
    id: 3,
    name: 'Michael Davis',
    phone_number: '+1 (555) 345-6789',
    relationship_label: 'Brother',
    is_primary: false,
    email: 'michael.davis@example.com',
    avatar_color: '#1282A2',
  },
  {
    id: 4,
    name: 'National Emergency Helpline',
    phone_number: '112',
    relationship_label: 'Police: 100 / Emergency: 112',
    is_primary: false,
    avatar_color: '#DC2626',
  },
];

const INITIAL_HISTORY: EmergencyHistoryItem[] = [
  {
    id: 'HIST-1024',
    alert_id: 1024,
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    resolved_at: new Date(Date.now() - 86400000 * 3 + 1800000).toISOString(),
    status: 'RESOLVED',
    location_address: 'Corner of 4th & Mission St, San Francisco, CA',
    latitude: 37.7858,
    longitude: -122.4008,
    google_maps_url: 'https://www.google.com/maps/search/?api=1&query=37.785800,-122.400800',
    contacts_notified_count: 3,
    notes: 'Medical emergency resolved by responders.',
    duration_minutes: 30,
  },
];

export const SOSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbPoint[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [history, setHistory] = useState<EmergencyHistoryItem[]>([]);
  const [profile, setProfile] = useState<LocalUserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<LocalAppSettings>(DEFAULT_SETTINGS);
  const [locationPermission, setLocationPermission] = useState<
    'granted' | 'denied' | 'undetermined' | 'checking'
  >('checking');

  // Timers & Subscription references
  const countdownTimerRef = useRef<any>(null);
  const periodicTelemetryRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const refreshPermissionStatus = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
    try {
      const perm = await locationService.getPermissionStatus();
      setLocationPermission(perm);
      return perm;
    } catch {
      setLocationPermission('undetermined');
      return 'undetermined';
    }
  };

  // Load persistent storage
  useEffect(() => {
    const initializeData = async () => {
      try {
        const storedContacts = await AsyncStorage.getItem(STORAGE_CONTACTS);
        if (storedContacts) {
          try {
            const parsed = JSON.parse(storedContacts);
            setContacts(
              Array.isArray(parsed)
                ? parsed.filter(
                    (c) =>
                      c &&
                      typeof c === 'object' &&
                      typeof c.name === 'string' &&
                      typeof c.phone_number === 'string'
                  )
                : []
            );
          } catch {
            setContacts([]);
            await AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify([]));
          }
        } else {
          setContacts([]);
          await AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify([]));
        }

        const storedHistory = await AsyncStorage.getItem(STORAGE_HISTORY);
        if (storedHistory) {
          try {
            const parsed = JSON.parse(storedHistory);
            setHistory(
              Array.isArray(parsed)
                ? parsed.filter(
                    (h) =>
                      h &&
                      typeof h === 'object' &&
                      typeof h.id === 'string' &&
                      typeof h.timestamp === 'string'
                  )
                : []
            );
          } catch {
            setHistory([]);
            await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify([]));
          }
        } else {
          setHistory([]);
          await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify([]));
        }

        const storedProfile = await AsyncStorage.getItem(STORAGE_PROFILE);
        if (storedProfile) {
          try {
            const parsed = JSON.parse(storedProfile);
            if (parsed && typeof parsed.full_name === 'string') {
              setProfile(parsed);
            } else {
              setProfile(DEFAULT_PROFILE);
            }
          } catch {
            setProfile(DEFAULT_PROFILE);
          }
        } else {
          setProfile(DEFAULT_PROFILE);
          await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(DEFAULT_PROFILE));
        }

        const storedSettings = await AsyncStorage.getItem(STORAGE_SETTINGS);
        if (storedSettings) {
          try {
            const parsed = JSON.parse(storedSettings);
            if (
              parsed &&
              [0, 3, 5, 10, 15].includes(parsed.countdown_seconds) &&
              typeof parsed.vibrate_enabled === 'boolean'
            ) {
              // Safely migrate legacy theme keys to midnight_navy by default
              if (parsed.theme && parsed.theme !== 'light_white' && parsed.theme !== 'midnight_navy') {
                parsed.theme = 'midnight_navy';
                await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify(parsed));
              }
              setSettings(parsed);
            } else {
              setSettings(DEFAULT_SETTINGS);
            }
          } catch {
            setSettings(DEFAULT_SETTINGS);
          }
        } else {
          setSettings(DEFAULT_SETTINGS);
          await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        }

        const storedActiveAlert = await AsyncStorage.getItem(STORAGE_ACTIVE_ALERT);
        if (storedActiveAlert) {
          const parsed: SOSAlert = JSON.parse(storedActiveAlert);
          setActiveAlert(parsed);
          startPeriodicTelemetry(parsed.id);
        }
      } catch (e) {
        console.warn('Storage initialization error:', e);
      }

      // Check foreground location permission
      try {
        const perm = await locationService.getPermissionStatus();
        setLocationPermission(perm);
      } catch {
        setLocationPermission('undetermined');
      }

      // Initial GPS fix
      try {
        const loc = await locationService.getCurrentLocation();
        setCurrentLocation(loc);
      } catch (e) {
        console.warn('Initial GPS fetch error:', e);
      }
    };

    initializeData();

    return () => {
      stopPeriodicTelemetry();
    };
  }, []);

  // Emergency Plan Status Calculation
  const isProfileComplete = Boolean(
    profile.full_name &&
    profile.full_name.trim().length >= 2 &&
    profile.is_completed !== false
  );
  const isContactsComplete = contacts.length > 0;
  const isLocationComplete = locationPermission === 'granted';
  const isCountdownComplete = Boolean(
    settings.countdown_seconds != null &&
    [0, 3, 5, 10, 15].includes(settings.countdown_seconds) &&
    settings.countdown_preference_set !== false
  );
  const completedCount = [
    isProfileComplete,
    isContactsComplete,
    isLocationComplete,
    isCountdownComplete,
  ].filter(Boolean).length;
  const totalCount = 4;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const isReady = completedCount === totalCount;

  // Active theme calculation - exactly two supported themes: light_white & midnight_navy
  const getThemePalette = (t?: string): ThemeColors => {
    if (t === 'light_white' || t === 'light') return THEME_PALETTES.light_white;
    // Migrate any legacy or undefined theme key safely to midnight_navy
    return THEME_PALETTES.midnight_navy;
  };

  const themeColors = getThemePalette(settings.theme);

  const emergencyPlanStatus: EmergencyPlanStatus = {
    isProfileComplete,
    isContactsComplete,
    isLocationComplete,
    isCountdownComplete,
    completedCount,
    totalCount,
    progressPercent,
    isReady,
  };

  // Countdown timer watcher
  useEffect(() => {
    if (isCountdownActive) {
      if (countdown > 0) {
        countdownTimerRef.current = setTimeout(() => {
          setCountdown((prev) => prev - 1);
        }, 1000);
      } else {
        setIsCountdownActive(false);
        triggerImmediateSOS();
      }
    } else {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    }
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [isCountdownActive, countdown]);

  const refreshLocation = async (): Promise<LocationCoordinates> => {
    const loc = await locationService.getCurrentLocation();
    setCurrentLocation(loc);
    return loc;
  };

  const startSOSCountdown = () => {
    setCountdown(5);
    setIsCountdownActive(true);
  };

  const cancelCountdown = () => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setIsCountdownActive(false);
    setCountdown(5);
  };

  // ============================================================================
  // Step 5: Start & Stop Periodic Location Telemetry & Live WatchPosition
  // ============================================================================
  const startPeriodicTelemetry = async (alertId: number) => {
    stopPeriodicTelemetry();

    // 1. Initial breadcrumb at trigger point
    const initialLoc = currentLocation || (await locationService.getCurrentLocation());
    const initialBreadcrumb: BreadcrumbPoint = {
      alert_id: alertId,
      latitude: initialLoc.latitude,
      longitude: initialLoc.longitude,
      accuracy: initialLoc.accuracy,
      speed: initialLoc.speed,
      heading: initialLoc.heading,
      timestamp: new Date().toISOString(),
    };
    setBreadcrumbs([initialBreadcrumb]);

    // Send initial point
    apiService
      .sendLocationBreadcrumb({
        alert_id: alertId,
        latitude: initialLoc.latitude,
        longitude: initialLoc.longitude,
        accuracy: initialLoc.accuracy || undefined,
        speed: initialLoc.speed || 0,
        heading: initialLoc.heading || 0,
      })
      .catch((err) => console.log('Initial breadcrumb upload failed:', err));

    // 2. Start Location.watchPositionAsync for real-time live GPS tracking
    try {
      const hasPerm = await locationService.getPermissionStatus();
      if (hasPerm === 'granted') {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000, // 10 seconds interval
            distanceInterval: 10, // 10 meters distance
          },
          (newLocation) => {
            const point: BreadcrumbPoint = {
              alert_id: alertId,
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy,
              speed: newLocation.coords.speed,
              heading: newLocation.coords.heading,
              timestamp: new Date(newLocation.timestamp).toISOString(),
            };

            // Append to local live trail
            setBreadcrumbs((prev) => [...prev, point]);

            // Update current location fix
            setCurrentLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy,
              speed: newLocation.coords.speed,
              heading: newLocation.coords.heading,
              timestamp: newLocation.timestamp,
              status: 'ACCURATE',
            });

            // POST breadcrumb to backend
            apiService
              .sendLocationBreadcrumb({
                alert_id: alertId,
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
                accuracy: newLocation.coords.accuracy || undefined,
                speed: newLocation.coords.speed || 0,
                heading: newLocation.coords.heading || 0,
              })
              .catch((err) => console.log('Live breadcrumb stream upload:', err));

            // Update alert metadata
            setActiveAlert((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
                accuracy: newLocation.coords.accuracy || prev.accuracy,
                breadcrumbs_count: (prev.breadcrumbs_count || 0) + 1,
              };
            });
          }
        );
        locationSubscriptionRef.current = sub;
      }
    } catch (watchErr) {
      console.warn('watchPositionAsync subscription error:', watchErr);
    }

    // 3. Fallback interval if watchPosition is throttled or hardware stationary
    periodicTelemetryRef.current = setInterval(async () => {
      try {
        const loc = await locationService.getCurrentLocation();
        setCurrentLocation(loc);

        // Ping backend breadcrumb if subscription didn't already
        const pingPoint: BreadcrumbPoint = {
          alert_id: alertId,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          speed: loc.speed,
          heading: loc.heading,
          timestamp: new Date().toISOString(),
        };

        setBreadcrumbs((prev) => {
          // Avoid duplicate points within 2 meters
          const last = prev[prev.length - 1];
          if (
            last &&
            Math.abs(last.latitude - loc.latitude) < 0.00003 &&
            Math.abs(last.longitude - loc.longitude) < 0.00003
          ) {
            return prev;
          }
          return [...prev, pingPoint];
        });

        await apiService.sendLocationBreadcrumb({
          alert_id: alertId,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy || undefined,
          speed: loc.speed || 0,
          heading: loc.heading || 0,
        });

        setActiveAlert((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            latitude: loc.latitude,
            longitude: loc.longitude,
            accuracy: loc.accuracy || prev.accuracy,
            breadcrumbs_count: (prev.breadcrumbs_count || 0) + 1,
          };
        });
      } catch (err) {
        console.log('Telemetry ping interval error:', err);
      }
    }, 12000);

    // 4. Elapsed active seconds counter (every 1 second)
    elapsedTimerRef.current = setInterval(() => {
      setActiveAlert((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          elapsed_seconds: (prev.elapsed_seconds || 0) + 1,
        };
      });
    }, 1000);
  };

  const stopPeriodicTelemetry = () => {
    // Cleanly remove Expo location subscription immediately
    if (locationSubscriptionRef.current) {
      try {
        locationSubscriptionRef.current.remove();
      } catch (e) {
        console.warn('Error removing location subscription:', e);
      }
      locationSubscriptionRef.current = null;
    }

    if (periodicTelemetryRef.current) {
      clearInterval(periodicTelemetryRef.current);
      periodicTelemetryRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  // ============================================================================
  // Step 1 - 4: Trigger Emergency SOS Flow
  // ============================================================================
  const triggerImmediateSOS = async () => {
    setIsLoading(true);
    cancelCountdown();

    try {
      // 1. Capture current GPS location & handle denials / unavailability
      let loc: LocationCoordinates;
      try {
        loc = await refreshLocation();
      } catch (locErr) {
        console.warn('Location capture failed, using safe fallback coordinates:', locErr);
        loc = {
          latitude: 37.78825,
          longitude: -122.4324,
          accuracy: 10,
          address: 'San Francisco, CA (Default Demo Fix)',
          status: 'UNAVAILABLE',
          timestamp: Date.now(),
        };
        setCurrentLocation(loc);
      }

      // Safe fallback coordinates if invalid or unavailable
      const latitude =
        typeof loc?.latitude === 'number' && !isNaN(loc.latitude)
          ? loc.latitude
          : 37.78825;
      const longitude =
        typeof loc?.longitude === 'number' && !isNaN(loc.longitude)
          ? loc.longitude
          : -122.4324;
      const mapsUrl = locationService.getGoogleMapsUrl(latitude, longitude);
      const locStatus: LocationStatus =
        loc.status === 'ACCURATE' ? 'ACCURATE' : 'DEGRADED';

      if (loc.status === 'LOCATION_DENIED') {
        Alert.alert(
          '⚠️ Location Access Denied',
          'GPS access was denied. Emergency SOS will broadcast with approximate coordinates. Enable location permissions in Settings for exact tracking.'
        );
      } else if (loc.status === 'UNAVAILABLE') {
        Alert.alert(
          '⚠️ GPS Hardware Unavailable',
          'Device location services appear to be disabled. Emergency broadcast will proceed with fallback telemetry.'
        );
      }

      let alertData: SOSAlert;

      // 2. Create emergency event via Backend API (POST /api/v1/sos/trigger)
      try {
        alertData = await apiService.triggerSOS({
          latitude,
          longitude,
          accuracy: loc.accuracy || undefined,
          address: loc.address || 'Real-time GPS Fix',
          message:
            settings?.custom_emergency_message ||
            'EMERGENCY: User activated SOS panic button!',
          location_status: locStatus,
          google_maps_url: mapsUrl,
        });

        if (alertData.delivery_report?.delivery_status !== 'ACCEPTED') {
          console.warn('Notification provider status:', alertData.delivery_report);
        }
      } catch (networkErr: any) {
        // 3. Graceful failure / timeout handling: keep local emergency simulation active
        console.warn(
          'Backend SOS trigger failed or timed out, preserving local simulation:',
          networkErr
        );

        const localId = Math.floor(1000 + Math.random() * 9000);
        const offlineReport: NotificationDeliveryReport = {
          provider: 'offline_local_simulation',
          delivery_status: 'OFFLINE',
          confirmed_count: 0,
          failed_count: contacts.length,
          recipient_count: contacts.length,
          details: 'Backend unreachable. Preserving local emergency simulation.',
          google_maps_url: mapsUrl,
        };

        alertData = {
          id: localId,
          user_id: 1,
          status: 'TRIGGERED',
          latitude,
          longitude,
          accuracy: loc.accuracy || 10,
          address: loc.address || 'San Francisco, CA (Default Demo Fix)',
          location_status: locStatus,
          google_maps_url: mapsUrl,
          message:
            settings?.custom_emergency_message ||
            'EMERGENCY: SOS panic button triggered (Offline Simulation Mode)',
          notification_status: 'OFFLINE',
          contacts_alerted_count: 0,
          delivery_report: offlineReport,
          breadcrumbs_count: 1,
          elapsed_seconds: 0,
          triggered_at: new Date().toISOString(),
        };
      }

      alertData.google_maps_url = mapsUrl;
      alertData.breadcrumbs_count = alertData.breadcrumbs_count || 1;
      alertData.elapsed_seconds = 0;

      // Store returned backend alert ID in active emergency state
      setActiveAlert(alertData);
      await AsyncStorage.setItem(STORAGE_ACTIVE_ALERT, JSON.stringify(alertData));

      // 5. Start periodic location telemetry updates
      startPeriodicTelemetry(alertData.id);

      // Add to history log so demo mode never crashes
      const newHistoryItem: EmergencyHistoryItem = {
        id: `HIST-${alertData.id}`,
        alert_id: alertData.id,
        timestamp: alertData.triggered_at,
        status: alertData.status || 'TRIGGERED',
        location_address: alertData.address || 'Real-time GPS Fix',
        latitude: alertData.latitude,
        longitude: alertData.longitude,
        accuracy: alertData.accuracy,
        google_maps_url: mapsUrl,
        contacts_notified_count: alertData.delivery_report?.confirmed_count || 0,
        notes:
          alertData.notification_status === 'OFFLINE'
            ? 'Emergency SOS active (Local Simulation - Backend Offline).'
            : `Emergency SOS initiated. Alert #${alertData.id}`,
      };

      const updatedHistory = [newHistoryItem, ...history.filter((h) => h.id !== newHistoryItem.id)];
      setHistory(updatedHistory);
      await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify(updatedHistory));
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // Step 4: Share Google Maps Location Link
  // ============================================================================
  const shareGoogleMapsLink = async () => {
    const lat = activeAlert?.latitude || currentLocation?.latitude || 37.78825;
    const lon = activeAlert?.longitude || currentLocation?.longitude || -122.4324;
    const mapsUrl = activeAlert?.google_maps_url || locationService.getGoogleMapsUrl(lat, lon);
    const addr = activeAlert?.address || currentLocation?.address || 'Current Location';

    const message = `🚨 EMERGENCY SOS ALERT!\nI have triggered an emergency distress signal.\nMy Current Location: ${addr}\nCoordinates: (${lat.toFixed(5)}, ${lon.toFixed(5)})\nLive Google Maps Link: ${mapsUrl}`;

    try {
      await Share.share({
        message,
        title: 'EMERGENCY SOS: My Location',
      });
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
    }
  };

  // Dispatch cellular SMS fallback with Google Maps link
  const dispatchSMSFallback = async () => {
    const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
    if (!primaryContact) {
      Alert.alert('No Contacts', 'Please configure an emergency contact to send SMS.');
      return;
    }

    const lat = activeAlert?.latitude || currentLocation?.latitude || 37.78825;
    const lon = activeAlert?.longitude || currentLocation?.longitude || -122.4324;
    const mapsUrl = activeAlert?.google_maps_url || locationService.getGoogleMapsUrl(lat, lon);

    const smsBody = encodeURIComponent(
      `🚨 EMERGENCY SOS: I need immediate help! My live location: ${mapsUrl}`
    );
    Linking.openURL(`sms:${primaryContact.phone_number}?body=${smsBody}`);
  };

  // ============================================================================
  // Step 7: Cancel / Resolve Emergency Alert Flow
  // ============================================================================
  const cancelActiveSOS = async (reason: string = 'User cancelled - Safe', pin?: string) => {
    if (!activeAlert) return;
    setIsLoading(true);

    try {
      // 1. Immediately halt periodic location telemetry and timers
      stopPeriodicTelemetry();

      try {
        await apiService.cancelSOS(activeAlert.id, { reason, pin });
      } catch (err) {
        console.warn('Backend cancel offline, updating local status:', err);
      }

      // Update history record
      const now = new Date().toISOString();
      const updatedHistory = history.map((item) =>
        item.alert_id === activeAlert.id
          ? {
              ...item,
              status: 'CANCELLED' as const,
              resolved_at: now,
              duration_minutes: Math.max(1, Math.round((activeAlert.elapsed_seconds || 60) / 60)),
              notes: reason,
            }
          : item
      );

      setHistory(updatedHistory);
      await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify(updatedHistory));
      await AsyncStorage.removeItem(STORAGE_ACTIVE_ALERT);
      setActiveAlert(null);
      setBreadcrumbs([]);

      Alert.alert(
        'Emergency Alert Cancelled',
        'Your emergency broadcast has been safely stood down. Telemetry streaming has stopped.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Contacts CRUD - Device-only local persistence
  const addContact = async (contactIn: (Omit<EmergencyContact, 'id'> & { id?: number })) => {
    const newId = contactIn.id || Date.now();
    const isPrim = contactIn.priority_level === 'PRIMARY' || contactIn.is_primary;
    const newContact: EmergencyContact = {
      ...contactIn,
      id: newId,
      is_primary: isPrim,
      priority_level: contactIn.priority_level || (isPrim ? 'PRIMARY' : 'STANDARD'),
      avatar_color: ['#034078', '#0D3B66', '#1282A2', '#001F54'][contacts.length % 4],
      synced: contactIn.synced ?? (newId < 1000000000000),
    };

    setContacts((prevContacts) => {
      let updated = [...prevContacts, newContact];
      if (newContact.is_primary) {
        updated = updated.map((c) =>
          c.id === newId
            ? c
            : {
                ...c,
                is_primary: false,
                priority_level: c.priority_level === 'PRIMARY' ? 'HIGH' : c.priority_level,
              }
        );
      }
      AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch((err) =>
        console.warn('[SOSContext] Error saving new contact to AsyncStorage:', err)
      );
      return updated;
    });

    // Un-mark from deleted list if re-adding
    try {
      const rawDeleted = await AsyncStorage.getItem(STORAGE_DELETED_CONTACTS);
      if (rawDeleted) {
        const deletedIds: number[] = JSON.parse(rawDeleted);
        const filtered = deletedIds.filter((id) => id !== newId);
        await AsyncStorage.setItem(STORAGE_DELETED_CONTACTS, JSON.stringify(filtered));
      }
    } catch {}
  };

  const updateContact = async (id: number, contactIn: Partial<EmergencyContact>) => {
    const isPrim = contactIn.priority_level === 'PRIMARY' || contactIn.is_primary;
    setContacts((prevContacts) => {
      let updated = prevContacts.map((c) =>
        c.id === id
          ? { ...c, ...contactIn, ...(contactIn.priority_level ? { is_primary: isPrim } : {}) }
          : c
      );
      if (isPrim) {
        updated = updated.map((c) =>
          c.id === id
            ? { ...c, is_primary: true, priority_level: 'PRIMARY' }
            : {
                ...c,
                is_primary: false,
                priority_level: c.priority_level === 'PRIMARY' ? 'HIGH' : c.priority_level,
              }
        );
      }
      AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch((err) =>
        console.warn('[SOSContext] Error updating contact in AsyncStorage:', err)
      );
      return updated;
    });
  };

  const deleteContact = async (id: number) => {
    // 1. Immediately update React state with functional filter (optimistic delete)
    setContacts((prevContacts) => {
      const updated = prevContacts.filter((c) => c.id !== id);
      AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated)).catch((err) =>
        console.warn('[SOSContext] Error saving deleted contacts to AsyncStorage:', err)
      );
      return updated;
    });

    // 2. Mark this ID as deleted to prevent background sync resurrection
    try {
      const rawDeleted = await AsyncStorage.getItem(STORAGE_DELETED_CONTACTS);
      const deletedIds: number[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        await AsyncStorage.setItem(STORAGE_DELETED_CONTACTS, JSON.stringify(deletedIds));
      }

      // 3. Direct AsyncStorage update to guarantee immediate persistence
      const rawStored = await AsyncStorage.getItem(STORAGE_CONTACTS);
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((c: any) => c.id !== id);
          await AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(filtered));
        }
      }
    } catch (e) {
      console.warn('[SOSContext] Error persisting deleteContact to storage:', e);
    }
  };

  const addDemoAlertRecord = async (locationInfo?: {
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    alert_id?: number;
    contacts_notified_count?: number;
    notes?: string;
    status?: string;
    google_maps_url?: string;
  }): Promise<EmergencyHistoryItem> => {
    const newId = locationInfo?.alert_id ? `ALERT-${locationInfo.alert_id}` : `ALERT-${Date.now()}`;
    const now = new Date().toISOString();

    let locAddress = 'Location unavailable';
    if (locationInfo?.address) {
      locAddress = locationInfo.address;
    } else if (locationInfo?.latitude != null && locationInfo?.longitude != null) {
      const latDir = locationInfo.latitude >= 0 ? 'N' : 'S';
      const lonDir = locationInfo.longitude >= 0 ? 'E' : 'W';
      locAddress = `${Math.abs(locationInfo.latitude).toFixed(5)}° ${latDir}, ${Math.abs(locationInfo.longitude).toFixed(5)}° ${lonDir}`;
    } else if (currentLocation && currentLocation.status !== 'LOCATION_DENIED' && currentLocation.status !== 'UNAVAILABLE') {
      if (currentLocation.address) {
        locAddress = currentLocation.address;
      } else {
        const latDir = currentLocation.latitude >= 0 ? 'N' : 'S';
        const lonDir = currentLocation.longitude >= 0 ? 'E' : 'W';
        locAddress = `${Math.abs(currentLocation.latitude).toFixed(5)}° ${latDir}, ${Math.abs(currentLocation.longitude).toFixed(5)}° ${lonDir}`;
      }
    }

    const newRecord: EmergencyHistoryItem = {
      id: newId,
      alert_id: locationInfo?.alert_id,
      timestamp: now,
      status: locationInfo?.status || (locationInfo?.alert_id ? 'TRIGGERED' : 'Demo Alert'),
      location_address: locAddress,
      latitude: locationInfo?.latitude ?? currentLocation?.latitude ?? null,
      longitude: locationInfo?.longitude ?? currentLocation?.longitude ?? null,
      accuracy: locationInfo?.accuracy ?? currentLocation?.accuracy ?? null,
      google_maps_url: locationInfo?.google_maps_url,
      contacts_notified_count: locationInfo?.contacts_notified_count,
      notes: locationInfo?.notes || 'Triggered from EmergencySOS UI Demonstration Mode.',
    };

    const updated = [newRecord, ...history];
    setHistory(updated);
    await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated));
    return newRecord;
  };

  const mapAlertToHistoryItem = (alert: SOSAlert): EmergencyHistoryItem => {
    let durationMinutes: number | undefined;
    if (alert.triggered_at && alert.resolved_at) {
      const start = new Date(alert.triggered_at).getTime();
      const end = new Date(alert.resolved_at).getTime();
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        durationMinutes = Math.max(1, Math.round((end - start) / 60000));
      }
    }

    let locAddress = alert.address;
    if (!locAddress && alert.latitude != null && alert.longitude != null) {
      const latDir = alert.latitude >= 0 ? 'N' : 'S';
      const lonDir = alert.longitude >= 0 ? 'E' : 'W';
      locAddress = `${Math.abs(alert.latitude).toFixed(5)}° ${latDir}, ${Math.abs(alert.longitude).toFixed(5)}° ${lonDir}`;
    }

    return {
      id: `ALERT-${alert.id}`,
      alert_id: alert.id,
      timestamp: alert.triggered_at || new Date().toISOString(),
      resolved_at: alert.resolved_at,
      status: alert.status,
      location_address: locAddress || 'San Francisco, CA (Default Demo Fix)',
      latitude: alert.latitude,
      longitude: alert.longitude,
      accuracy: alert.accuracy,
      google_maps_url:
        alert.google_maps_url ||
        (alert.latitude && alert.longitude
          ? `https://www.google.com/maps/search/?api=1&query=${alert.latitude},${alert.longitude}`
          : undefined),
      contacts_notified_count: alert.contacts_alerted_count,
      notes: alert.cancellation_reason
        ? `Cancellation reason: ${alert.cancellation_reason}`
        : alert.message || `Backend Incident Alert #${alert.id}`,
      duration_minutes: durationMinutes,
    };
  };

  const mergeHistoryItems = (
    backendItems: EmergencyHistoryItem[],
    localItems: EmergencyHistoryItem[]
  ): EmergencyHistoryItem[] => {
    const mergedMap = new Map<string, EmergencyHistoryItem>();

    for (const b of backendItems) {
      const key = b.alert_id ? `ALERT-${b.alert_id}` : b.id;
      mergedMap.set(key, b);
    }

    for (const l of localItems) {
      const alertKey = l.alert_id ? `ALERT-${l.alert_id}` : null;
      const histKey = l.id.startsWith('HIST-') ? `ALERT-${l.id.replace('HIST-', '')}` : null;

      if (alertKey && mergedMap.has(alertKey)) continue;
      if (histKey && mergedMap.has(histKey)) continue;
      if (mergedMap.has(l.id)) continue;

      mergedMap.set(l.id, l);
    }

    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  const refreshHistory = async (statusFilter?: AlertStatus): Promise<EmergencyHistoryItem[]> => {
    try {
      const backendAlerts = await apiService.getHistory({ status_filter: statusFilter });
      if (Array.isArray(backendAlerts)) {
        const mappedBackendItems = backendAlerts.map(mapAlertToHistoryItem);
        const merged = mergeHistoryItems(mappedBackendItems, history);
        setHistory(merged);
        await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Backend history fetch unreachable, using local session history:', err);
    }
    return history;
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify([]));
  };

  const updateProfile = async (profileIn: Partial<LocalUserProfile>) => {
    const updated = {
      ...profile,
      ...profileIn,
      is_completed: profileIn.is_completed ?? true,
    };
    setProfile(updated);
    await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(updated));
  };

  const updateSettings = async (settingsIn: Partial<LocalAppSettings>) => {
    const updated = {
      ...settings,
      ...settingsIn,
      countdown_preference_set: settingsIn.countdown_preference_set ?? true,
    };
    setSettings(updated);
    await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify(updated));
  };

  const resetDemoData = async () => {
    setContacts([]);
    setHistory([]);
    const resetProf: LocalUserProfile = { ...DEFAULT_PROFILE, is_completed: false };
    const resetSett: LocalAppSettings = { ...DEFAULT_SETTINGS, countdown_preference_set: false };
    setProfile(resetProf);
    setSettings(resetSett);
    setActiveAlert(null);
    setIsCountdownActive(false);

    await AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify([]));
    await AsyncStorage.setItem(STORAGE_HISTORY, JSON.stringify([]));
    await AsyncStorage.setItem(STORAGE_PROFILE, JSON.stringify(resetProf));
    await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify(resetSett));
    await AsyncStorage.removeItem(STORAGE_ACTIVE_ALERT);
  };

  return (
    <SOSContext.Provider
      value={{
        activeAlert,
        isCountdownActive,
        countdown,
        isLoading,
        currentLocation,
        breadcrumbs,
        contacts,
        history,
        profile,
        settings,
        themeColors,
        locationPermission,
        refreshPermissionStatus,
        emergencyPlanStatus,
        startSOSCountdown,
        cancelCountdown,
        triggerImmediateSOS,
        cancelActiveSOS,
        shareGoogleMapsLink,
        dispatchSMSFallback,
        refreshLocation,
        addContact,
        updateContact,
        deleteContact,
        addDemoAlertRecord,
        clearHistory,
        refreshHistory,
        updateProfile,
        updateSettings,
        resetDemoData,
      }}
    >
      {children}
    </SOSContext.Provider>
  );
};

export const useSOS = (): SOSContextType => {
  const ctx = useContext(SOSContext);
  if (!ctx) {
    throw new Error('useSOS must be used inside SOSProvider');
  }
  return ctx;
};
