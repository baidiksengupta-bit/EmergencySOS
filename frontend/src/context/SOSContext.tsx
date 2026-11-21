import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, Linking, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SOSAlert,
  EmergencyContact,
  EmergencyHistoryItem,
  LocationCoordinates,
  NotificationDeliveryReport,
  LocationStatus,
  LocalUserProfile,
  LocalAppSettings,
  CountdownDuration,
  EmergencyPlanStatus,
} from '../types';
import { apiService } from '../services/api';
import { locationService } from '../services/location';

interface SOSContextType {
  activeAlert: SOSAlert | null;
  isCountdownActive: boolean;
  countdown: number;
  isLoading: boolean;
  currentLocation: LocationCoordinates | null;
  contacts: EmergencyContact[];
  history: EmergencyHistoryItem[];
  profile: LocalUserProfile;
  settings: LocalAppSettings;
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
  addContact: (contact: Omit<EmergencyContact, 'id'>) => Promise<void>;
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
  updateProfile: (profile: Partial<LocalUserProfile>) => Promise<void>;
  updateSettings: (settings: Partial<LocalAppSettings>) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const SOSContext = createContext<SOSContextType | undefined>(undefined);

const STORAGE_CONTACTS = '@emergencysos_contacts';
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
  theme: 'navy',
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
    name: 'Local Emergency Dispatch',
    phone_number: '911',
    relationship_label: 'First Responders',
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
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [history, setHistory] = useState<EmergencyHistoryItem[]>([]);
  const [profile, setProfile] = useState<LocalUserProfile>(DEFAULT_PROFILE);
  const [settings, setSettings] = useState<LocalAppSettings>(DEFAULT_SETTINGS);
  const [locationPermission, setLocationPermission] = useState<
    'granted' | 'denied' | 'undetermined' | 'checking'
  >('checking');

  // Timers
  const countdownTimerRef = useRef<any>(null);
  const periodicTelemetryRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);

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
  // Step 5: Start & Stop Periodic Location Telemetry
  // ============================================================================
  const startPeriodicTelemetry = (alertId: number) => {
    stopPeriodicTelemetry();

    // 1. Telemetry streaming breadcrumb interval (every 7 seconds)
    periodicTelemetryRef.current = setInterval(async () => {
      try {
        const loc = await locationService.getCurrentLocation();
        setCurrentLocation(loc);

        // Ping backend breadcrumb
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
        // Silently continue in background
        console.log('Telemetry ping interval error:', err);
      }
    }, 7000);

    // 2. Elapsed active seconds counter (every 1 second)
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
      const loc = await refreshLocation();
      const mapsUrl = locationService.getGoogleMapsUrl(loc.latitude, loc.longitude);

      if (loc.status === 'LOCATION_DENIED') {
        Alert.alert(
          '⚠️ Location Access Denied',
          'GPS access was denied. Emergency SOS will broadcast with approximate coordinates. Enable location permissions in Settings for exact tracking.'
        );
      } else if (loc.status === 'UNAVAILABLE') {
        Alert.alert(
          '⚠️ GPS Hardware Unavailable',
          'Device location services appear to be disabled. Emergency broadcast will proceed with last known telemetry.'
        );
      }

      let alertData: SOSAlert;

      // 2. Create emergency event via Backend API
      try {
        alertData = await apiService.triggerSOS({
          user_id: 1,
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy || undefined,
          address: loc.address,
          message: 'EMERGENCY: User activated SOS panic button!',
          location_status: loc.status || 'ACCURATE',
          google_maps_url: mapsUrl,
        });

        // Check provider delivery confirmation:
        // Rule: Never show successful delivery unless provider confirms
        if (alertData.delivery_report?.delivery_status !== 'ACCEPTED') {
          console.warn('Notification provider did not confirm delivery:', alertData.delivery_report);
        }
      } catch (networkErr: any) {
        // 3. Handle Internet Failure: Store event locally & offer cellular SMS fallback
        console.warn('Internet failure during SOS trigger, creating local offline alert:', networkErr);

        const localId = Math.floor(1000 + Math.random() * 9000);
        const offlineReport: NotificationDeliveryReport = {
          provider: 'cellular_sms_fallback',
          delivery_status: 'OFFLINE',
          confirmed_count: 0,
          failed_count: contacts.length,
          recipient_count: contacts.length,
          details: 'Internet offline. Immediate cellular SMS dispatch recommended.',
          google_maps_url: mapsUrl,
        };

        alertData = {
          id: localId,
          user_id: 1,
          status: 'TRIGGERED',
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy || 10,
          address: loc.address || 'GPS Coordinates',
          location_status: loc.status || 'DEGRADED',
          google_maps_url: mapsUrl,
          message: 'EMERGENCY: SOS panic button triggered (Offline Mode)',
          notification_status: 'OFFLINE',
          contacts_alerted_count: 0,
          delivery_report: offlineReport,
          breadcrumbs_count: 1,
          elapsed_seconds: 0,
          triggered_at: new Date().toISOString(),
        };

        // Prompt user for immediate cellular SMS fallback
        const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
        if (primaryContact) {
          Alert.alert(
            '📡 Internet Offline: Send Emergency SMS?',
            `Cannot connect to backend server. Would you like to dispatch an immediate emergency SMS with your Google Maps link to ${primaryContact.name}?`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Send SMS Now',
                style: 'destructive',
                onPress: () => dispatchSMSFallback(),
              },
            ]
          );
        }
      }

      alertData.google_maps_url = mapsUrl;
      alertData.breadcrumbs_count = 1;
      alertData.elapsed_seconds = 0;

      setActiveAlert(alertData);
      await AsyncStorage.setItem(STORAGE_ACTIVE_ALERT, JSON.stringify(alertData));

      // 5. Start periodic location telemetry updates
      startPeriodicTelemetry(alertData.id);

      // Add to history log
      const newHistoryItem: EmergencyHistoryItem = {
        id: `HIST-${alertData.id}`,
        alert_id: alertData.id,
        timestamp: alertData.triggered_at,
        status: 'TRIGGERED',
        location_address: alertData.address || 'Real-time GPS Fix',
        latitude: alertData.latitude,
        longitude: alertData.longitude,
        google_maps_url: mapsUrl,
        contacts_notified_count: alertData.delivery_report?.confirmed_count || 0,
        notes: `Emergency SOS initiated. Provider status: ${alertData.notification_status}`,
      };

      const updatedHistory = [newHistoryItem, ...history];
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
        await apiService.resolveSOS(activeAlert.id, 'CANCELLED');
      } catch (err) {
        console.warn('Backend resolve offline, updating local status:', err);
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

      Alert.alert(
        'Emergency Alert Cancelled',
        'Your emergency broadcast has been safely stood down. Telemetry streaming has stopped.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Contacts CRUD - Device-only local persistence
  const addContact = async (contactIn: Omit<EmergencyContact, 'id'>) => {
    const newId = Date.now();
    const isPrim = contactIn.priority_level === 'PRIMARY' || contactIn.is_primary;
    const newContact: EmergencyContact = {
      ...contactIn,
      id: newId,
      is_primary: isPrim,
      priority_level: contactIn.priority_level || (isPrim ? 'PRIMARY' : 'STANDARD'),
      avatar_color: ['#034078', '#0D3B66', '#1282A2', '#001F54'][contacts.length % 4],
    };

    let updated = [...contacts, newContact];
    if (newContact.is_primary) {
      updated = updated.map((c) => (c.id === newId ? c : { ...c, is_primary: false, priority_level: c.priority_level === 'PRIMARY' ? 'HIGH' : c.priority_level }));
    }

    setContacts(updated);
    await AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated));
  };

  const updateContact = async (id: number, contactIn: Partial<EmergencyContact>) => {
    const isPrim = contactIn.priority_level === 'PRIMARY' || contactIn.is_primary;
    let updated = contacts.map((c) => (c.id === id ? { ...c, ...contactIn, ...(contactIn.priority_level ? { is_primary: isPrim } : {}) } : c));
    if (isPrim) {
      updated = updated.map((c) => (c.id === id ? { ...c, is_primary: true, priority_level: 'PRIMARY' } : { ...c, is_primary: false, priority_level: c.priority_level === 'PRIMARY' ? 'HIGH' : c.priority_level }));
    }
    setContacts(updated);
    await AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated));
  };

  const deleteContact = async (id: number) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    await AsyncStorage.setItem(STORAGE_CONTACTS, JSON.stringify(updated));
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
        contacts,
        history,
        profile,
        settings,
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
