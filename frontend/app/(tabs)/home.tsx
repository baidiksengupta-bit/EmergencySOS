import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
  Vibration,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { Config } from '../../src/constants/Config';
import { locationService } from '../../src/services/location';
import { apiService } from '../../src/services/api';
import { LocationCoordinates } from '../../src/types';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { CountdownModal } from '../../src/components/sos/CountdownModal';
import { AlertConfirmationModal } from '../../src/components/sos/AlertConfirmationModal';
import { EmergencyPlanSection } from '../../src/components/plan/EmergencyPlanSection';
import { useSOS } from '../../src/context/SOSContext';
import { EmergencyHistoryItem } from '../../src/types';

// Bundled Siren Sound Asset (Original high-intensity emergency audio)
const sirenSoundAsset = require('../../assets/sounds/sos-siren.mp3');

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { settings, contacts, history, addDemoAlertRecord, refreshPermissionStatus, themeColors } = useSOS();

  // Preloaded Audio Player using Expo's expo-audio
  const sirenPlayer = useAudioPlayer(sirenSoundAsset);

  // ============================================================================
  // State: Countdown, Simulation Mode, and Location Permission
  // ============================================================================
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number>(settings?.countdown_seconds || 5);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Demo Alert Confirmation Modal State
  const [createdAlertRecord, setCreatedAlertRecord] = useState<EmergencyHistoryItem | null>(null);
  const [isConfirmationModalVisible, setIsConfirmationModalVisible] = useState(false);

  // GPS / Location Permission State
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'checking'>('checking');
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);

  // Backend API Connection State
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Backend SOS Dispatch State & Debounce Ref
  const [isSubmittingAlert, setIsSubmittingAlert] = useState(false);
  const [activeBackendAlertId, setActiveBackendAlertId] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);

  // Timers
  const countdownTimerRef = useRef<any>(null);
  const elapsedTimerRef = useRef<any>(null);

  // Animated Rings for Tactile Pulsing during Simulation / Active SOS
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (isEmergencyActive) {
      const pulseLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.12,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 0.65,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.2,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.2);
    }
  }, [isEmergencyActive]);

  // ============================================================================
  // 1. Check GPS & Backend Status on Mount, and Setup Audio Siren
  // ============================================================================
  useEffect(() => {
    checkGpsStatus();
    checkBackendHealth();

    // Periodically poll backend health every 15 seconds
    const statusInterval = setInterval(() => {
      checkBackendHealth();
    }, 15000);

    // Configure audio mode to respect device mute switch & physical volume
    const setupAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
        });
      } catch (err) {
        console.warn('Could not configure audio mode:', err);
      }
    };
    setupAudio();

    return () => {
      clearInterval(statusInterval);
      stopSiren();
      clearAllTimers();
    };
  }, []);

  // Configure siren player for continuous looping at full app volume
  useEffect(() => {
    try {
      if (sirenPlayer) {
        sirenPlayer.loop = true;
        sirenPlayer.volume = 1.0;
      }
    } catch (err) {
      console.warn('Could not configure siren player properties:', err);
    }
  }, [sirenPlayer]);

  const startSiren = () => {
    try {
      if (sirenPlayer) {
        sirenPlayer.loop = true;
        sirenPlayer.volume = 1.0;
        sirenPlayer.seekTo(0);
        sirenPlayer.play();
      }
    } catch (err) {
      console.warn('Error starting SOS siren audio:', err);
    }
  };

  const stopSiren = () => {
    try {
      if (sirenPlayer) {
        sirenPlayer.pause();
        sirenPlayer.seekTo(0);
      }
    } catch (err) {
      console.warn('Error stopping SOS siren audio:', err);
    }
  };

  const checkBackendHealth = async () => {
    try {
      const res = await apiService.checkHealth();
      if (res && (res.status === 'ok' || res.status === 'online')) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  };

  const checkGpsStatus = async () => {
    try {
      setPermissionStatus('checking');
      const status = await refreshPermissionStatus();
      if (status === 'granted') {
        setPermissionStatus('granted');
        const loc = await locationService.getCurrentLocation();
        setCurrentLocation(loc);
      } else {
        setPermissionStatus(status === 'denied' ? 'denied' : 'checking');
        // Retrieve initial fallback coordinate fix
        const loc = await locationService.getCurrentLocation();
        setCurrentLocation(loc);
      }
    } catch {
      setPermissionStatus('denied');
    }
  };

  const handleRequestGpsPermission = async () => {
    const { granted } = await locationService.requestPermissions();
    await refreshPermissionStatus();
    if (granted) {
      setPermissionStatus('granted');
      const loc = await locationService.getCurrentLocation();
      setCurrentLocation(loc);
      Alert.alert('GPS Connected', 'High precision GPS location is active and ready for emergency broadcasting.');
    } else {
      setPermissionStatus('denied');
      Alert.alert(
        'GPS Permission Required',
        'Location access was denied. In a real emergency, approximate network coordinates would be used.'
      );
    }
  };

  // ============================================================================
  // 2. Countdown Timer Logic (Window with Cancel & Haptic Vibration)
  // ============================================================================
  useEffect(() => {
    if (isCountingDown) {
      if (countdownValue > 0) {
        if (settings?.vibrate_enabled) {
          Vibration.vibrate(80);
        }
        countdownTimerRef.current = setTimeout(() => {
          setCountdownValue((prev) => prev - 1);
        }, 1000);
      } else {
        // Countdown reached 0 -> Trigger simulated emergency event
        setIsCountingDown(false);
        triggerSimulatedEmergency();
      }
    } else {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    }
    return () => {
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    };
  }, [isCountingDown, countdownValue]);

  const clearAllTimers = () => {
    stopSiren();
    Vibration.cancel();
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
  };

  // Starts the configured countdown (5s, 10s, or 15s)
  const handlePressSOS = () => {
    if (isEmergencyActive) {
      // If already active, tapping prompts to stand down
      handleCancelEmergency();
    } else {
      const initialCountdown = settings?.countdown_seconds || 5;
      setCountdownValue(initialCountdown);
      setIsCountingDown(true);
      if (settings?.vibrate_enabled) {
        Vibration.vibrate(150);
      }
    }
  };

  // Cancel Button action (Aborts the countdown and vibration immediately)
  const handleCancelCountdown = () => {
    stopSiren();
    Vibration.cancel();
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setIsCountingDown(false);
    setCountdownValue(settings?.countdown_seconds || 5);
    Alert.alert('Alert Aborted', 'Emergency countdown cancelled. You are safe in Standby Mode.');
  };

  // Skip countdown and immediately trigger demo
  const handleInstantTrigger = () => {
    Vibration.cancel();
    setIsCountingDown(false);
    triggerSimulatedEmergency();
  };

  // ============================================================================
  // 3. UI Demonstration Emergency Mode & FastAPI Backend SOS Dispatch
  // ============================================================================
  const triggerSimulatedEmergency = async () => {
    // Prevent double-dispatching if user taps repeatedly
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setIsEmergencyActive(true);
    setElapsedSeconds(0);

    // Haptic vibration feedback
    if (settings?.vibrate_enabled) {
      Vibration.vibrate([0, 250, 150, 250]);
    }

    // Play loud looping SOS siren only after countdown finishes and alert becomes active
    if (settings?.sound_alarm_enabled !== false) {
      startSiren();
    }

    // Determine latest coordinates & reverse-geocoded address
    let locAddress = 'Location unavailable';
    let locLat = 37.78825;
    let locLon = -122.43240;
    let locAccuracy: number | null = 10;

    if (permissionStatus === 'granted' && currentLocation) {
      locLat = currentLocation.latitude;
      locLon = currentLocation.longitude;
      locAccuracy = currentLocation.accuracy ?? 10;
      locAddress =
        currentLocation.address ||
        `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`;
    } else {
      locAddress = '37.78825° N, 122.43240° W • San Francisco, CA (Default Demo Fix)';
    }

    const payload = {
      user_id: 1,
      latitude: locLat,
      longitude: locLon,
      accuracy: locAccuracy || undefined,
      address: locAddress,
      message:
        settings?.custom_emergency_message ||
        'EMERGENCY SOS: I need immediate assistance! My current location is attached.',
      location_status: permissionStatus === 'granted' ? 'ACCURATE' : 'DEGRADED',
      google_maps_url: `https://www.google.com/maps/search/?api=1&query=${locLat},${locLon}`,
    };

    setIsSubmittingAlert(true);

    try {
      // Call POST /api/v1/sos/trigger on the FastAPI backend
      const backendAlert = await apiService.triggerSOS(payload);
      setActiveBackendAlertId(backendAlert.id);

      // Create persistent local history record linked with the real backend alert ID
      const record = await addDemoAlertRecord({
        address: locAddress,
        latitude: locLat,
        longitude: locLon,
        accuracy: locAccuracy,
        alert_id: backendAlert.id,
        contacts_notified_count: backendAlert.contacts_alerted_count || contacts.length,
        notes: `Successfully transmitted to FastAPI backend (#${backendAlert.id}). Status: ${backendAlert.status}`,
        status: backendAlert.status || 'TRIGGERED',
        google_maps_url: payload.google_maps_url,
      });

      setCreatedAlertRecord(record);
      setIsConfirmationModalVisible(true);
    } catch (backendErr: any) {
      console.warn('Backend SOS trigger failed, saving local record:', backendErr);

      // On failure, ALWAYS preserve the local demo record so no incident is lost!
      const fallbackRecord = await addDemoAlertRecord({
        address: locAddress,
        latitude: permissionStatus === 'granted' ? locLat : null,
        longitude: permissionStatus === 'granted' ? locLon : null,
        accuracy: permissionStatus === 'granted' ? locAccuracy : null,
        notes: 'Recorded locally. Backend unreachable: ' + (backendErr?.message || 'Network error'),
        status: 'Demo Alert (Offline)',
        google_maps_url: payload.google_maps_url,
      });

      setCreatedAlertRecord(fallbackRecord);

      // Show user-friendly error dialog with Retry option
      Alert.alert(
        'Backend Dispatch Offline',
        `Could not reach the FastAPI backend server (${Config.API_BASE_URL}). Your emergency alert has been securely preserved in your local incident history.`,
        [
          {
            text: 'View Local Alert',
            style: 'cancel',
            onPress: () => setIsConfirmationModalVisible(true),
          },
          {
            text: 'Retry Broadcast',
            style: 'default',
            onPress: async () => {
              try {
                setIsSubmittingAlert(true);
                const retryAlert = await apiService.triggerSOS(payload);
                setActiveBackendAlertId(retryAlert.id);
                fallbackRecord.alert_id = retryAlert.id;
                setCreatedAlertRecord({ ...fallbackRecord, alert_id: retryAlert.id });
                setIsConfirmationModalVisible(true);
                Alert.alert('Broadcast Success', `Emergency Alert #${retryAlert.id} dispatched to backend!`);
              } catch (retryErr: any) {
                Alert.alert(
                  'Retry Failed',
                  retryErr?.message || 'Server still unreachable. Local record remains saved.'
                );
                setIsConfirmationModalVisible(true);
              } finally {
                setIsSubmittingAlert(false);
              }
            },
          },
        ]
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmittingAlert(false);
    }

    // Start elapsed active timer
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleCancelEmergency = () => {
    Alert.alert(
      'Stand Down Emergency SOS?',
      'This will safely end the simulated emergency broadcast and return to standby.',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Stand Down / Reset',
          style: 'destructive',
          onPress: async () => {
            clearAllTimers();
            stopSiren();
            setIsEmergencyActive(false);
            setElapsedSeconds(0);
            if (activeBackendAlertId) {
              try {
                await apiService.cancelSOS(activeBackendAlertId, {
                  reason: 'User cancelled - Stand down',
                });
              } catch (e) {
                console.warn('Could not notify backend of cancellation:', e);
              }
              setActiveBackendAlertId(null);
            }
          },
        },
      ]
    );
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeContainer, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={themeColors.statusBarStyle} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ==================================================================== */}
        {/* TOP BRANDING: EmergencySOS & Tagline                                 */}
        {/* ==================================================================== */}
        <View style={styles.brandContainer}>
          <View style={styles.brandTopRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.white} />
            </View>
            <View style={styles.brandTextGroup}>
              <Text style={[styles.brandTitle, { color: themeColors.textPrimary }]}>
                Emergency<Text style={styles.brandAccent}>SOS</Text>
              </Text>
              <Text style={[styles.tagline, { color: themeColors.textSecondary }]}>Your Safety, One Tap Away.</Text>
            </View>
          </View>

          <View style={styles.demoModeBadge}>
            <View style={styles.demoDot} />
            <Text style={styles.demoModeText}>UI DEMO MODE</Text>
          </View>
        </View>

        {/* ==================================================================== */}
        {/* BACKEND CONNECTION STATUS INDICATOR                                  */}
        {/* ==================================================================== */}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={checkBackendHealth}
          style={[styles.backendStatusBar, { backgroundColor: themeColors.cardNavyBackground, borderColor: themeColors.cardBorder }]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`Backend connection status: ${backendStatus === 'connected' ? 'Connected' : backendStatus === 'checking' ? 'Connecting' : 'Disconnected'}`}
          accessibilityHint="Tap to test connection to FastAPI backend"
        >
          <View style={styles.backendStatusLeft}>
            <Ionicons
              name={backendStatus === 'connected' ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={15}
              color={backendStatus === 'connected' ? Colors.success : Colors.slate400}
            />
            <Text style={[styles.backendStatusTitle, { color: themeColors.textPrimary }]}>FastAPI Backend</Text>
            <Text style={styles.backendUrlText} numberOfLines={1}>
              192.168.0.127:8000
            </Text>
          </View>

          <View
            style={[
              styles.backendStatusPill,
              backendStatus === 'connected'
                ? styles.backendPillConnected
                : styles.backendPillDisconnected,
            ]}
          >
            <View
              style={[
                styles.backendStatusDot,
                backendStatus === 'connected'
                  ? styles.backendDotConnected
                  : styles.backendDotDisconnected,
              ]}
            />
            <Text
              style={[
                styles.backendPillText,
                backendStatus === 'connected'
                  ? styles.backendTextConnected
                  : styles.backendTextDisconnected,
              ]}
              numberOfLines={1}
            >
              {backendStatus === 'connected'
                ? 'Connected'
                : backendStatus === 'checking'
                ? 'Connecting...'
                : 'Disconnected'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* ==================================================================== */}
        {/* GPS / LOCATION PERMISSION STATUS                                     */}
        {/* ==================================================================== */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleRequestGpsPermission}
          style={[styles.gpsStatusBar, { backgroundColor: themeColors.cardNavyBackground, borderColor: themeColors.cardBorder }]}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`GPS Location Status: ${permissionStatus === 'granted' ? 'Active' : 'Permission Required'}`}
          accessibilityHint="Tap to configure device location permissions"
        >
          <View style={[styles.gpsIconContainer, { backgroundColor: themeColors.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]}>
            <Ionicons
              name={permissionStatus === 'granted' ? 'location' : 'location-outline'}
              size={18}
              color={permissionStatus === 'granted' ? Colors.success : Colors.warning}
            />
          </View>

          <View style={styles.gpsTextCol}>
            <View style={styles.gpsHeaderRow}>
              <Text style={[styles.gpsStatusLabel, { color: themeColors.textSecondary }]}>GPS LOCATION STATUS</Text>
              <View
                style={[
                  styles.permissionPill,
                  permissionStatus === 'granted'
                    ? styles.pillGranted
                    : styles.pillDenied,
                ]}
              >
                <Text
                  style={[
                    styles.permissionPillText,
                    permissionStatus === 'granted'
                      ? styles.pillTextGranted
                      : styles.pillTextDenied,
                  ]}
                  numberOfLines={1}
                >
                  {permissionStatus === 'granted' ? 'PERMISSION ACTIVE' : 'TAP TO ENABLE'}
                </Text>
              </View>
            </View>

            <Text style={[styles.gpsCoordsText, { color: themeColors.textPrimary }]} numberOfLines={1} ellipsizeMode="tail">
              {currentLocation
                ? `${currentLocation.latitude.toFixed(5)}° N, ${Math.abs(currentLocation.longitude).toFixed(5)}° W • ${currentLocation.address || 'San Francisco, CA'}`
                : '37.78825° N, 122.43240° W • San Francisco, CA'}
            </Text>
          </View>

          <View style={styles.gpsArrowBox}>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ==================================================================== */}
        {/* ACTIVE EMERGENCY BANNER (Shown during simulated SOS)                 */}
        {/* ==================================================================== */}
        {isEmergencyActive && (
          <View style={styles.activeSimulationBanner}>
            <View style={styles.activeBannerTop}>
              <View style={styles.activeBannerTitleGroup}>
                <View style={styles.redPulseDot} />
                <Text style={styles.activeBannerTitle}>EMERGENCY SIMULATION ACTIVE</Text>
              </View>
              <Text style={styles.activeTimerText}>{formatTimer(elapsedSeconds)}</Text>
            </View>

            {isSubmittingAlert ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator size="small" color={Colors.white} />
                <Text style={styles.submittingText}>
                  Broadcasting SOS alert to FastAPI backend...
                </Text>
              </View>
            ) : (
              <Text style={styles.activeBannerDesc}>
                {activeBackendAlertId
                  ? `Active Backend Alert #${activeBackendAlertId} • Coordinates broadcasted to contacts network.`
                  : 'Simulated coordinates broadcasted to contacts network. Real emergency services and SMS calls are disabled.'}
              </Text>
            )}

            <View style={styles.activeActionsRow}>
              <TouchableOpacity
                style={styles.standDownBtn}
                onPress={handleCancelEmergency}
                activeOpacity={0.8}
              >
                <Ionicons name="stop-circle" size={16} color={Colors.white} />
                <Text style={styles.standDownBtnText}>STAND DOWN / RESET</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==================================================================== */}
        {/* CENTERPIECE: Large Glowing Red Circular SOS Button                    */}
        {/* ==================================================================== */}
        <View style={styles.centerpieceContainer}>
          {/* Concentric Glowing Outer Pulse Ring */}
          <Animated.View
            style={[
              styles.outerGlowRing,
              isEmergencyActive && styles.outerGlowRingActive,
              isEmergencyActive && {
                transform: [{ scale: pulseAnim }],
                opacity: glowAnim,
              },
            ]}
          />

          {/* Concentric Middle Radiant Ring */}
          <Animated.View
            style={[
              styles.middleGlowRing,
              isEmergencyActive && styles.middleGlowRingActive,
              isEmergencyActive && {
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [1, 1.12],
                      outputRange: [1, 1.06],
                    }),
                  },
                ],
              },
            ]}
          />

          {/* Touchable Glowing Red SOS Button */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handlePressSOS}
            style={[
              styles.sosCircleButton,
              isEmergencyActive && styles.sosCircleButtonActive,
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={
              isEmergencyActive
                ? 'Simulated Emergency Active. Double tap to stand down.'
                : 'Emergency SOS Panic Button. Tap to initiate emergency broadcast countdown.'
            }
            accessibilityHint="Activates simulated emergency SOS broadcast"
          >
            <View style={styles.buttonInnerContent}>
              <Ionicons
                name={isEmergencyActive ? 'radio' : 'alert-circle'}
                size={38}
                color={Colors.white}
              />
              <Text
                style={[
                  styles.sosButtonText,
                  isEmergencyActive && styles.sosButtonTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
              >
                {isEmergencyActive ? 'ACTIVE' : 'SOS'}
              </Text>
              <Text
                style={styles.sosButtonSub}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
              >
                {isEmergencyActive ? 'SIMULATING' : 'TOUCH FOR HELP'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ==================================================================== */}
        {/* PROMINENT TEXT: "Press for Emergency"                                */}
        {/* ==================================================================== */}
        <View style={styles.instructionBlock}>
          <Text style={[styles.pressForEmergencyText, { color: themeColors.textPrimary }]}>Press for Emergency</Text>
          <Text style={[styles.instructionSubtext, { color: themeColors.textSecondary }]}>
            {isEmergencyActive
              ? 'Tap button to stand down simulation • You are safe'
              : 'Tap to initiate 5-second countdown • UI Demonstration'}
          </Text>
        </View>

        {/* ==================================================================== */}
        {/* EMERGENCY PLAN: Setup Checklist & Readiness Status                   */}
        {/* ==================================================================== */}
        <EmergencyPlanSection />

        {/* ==================================================================== */}
        {/* SHORTCUTS: Emergency Contacts, Live Location, Alert History          */}
        {/* ==================================================================== */}
        <View style={styles.shortcutsSection}>
          <Text style={[styles.sectionHeaderTitle, { color: themeColors.textSecondary }]}>QUICK SAFETY SHORTCUTS</Text>

          <View style={styles.shortcutsGrid}>
            {/* Shortcut 1: Emergency Contacts */}
            <TouchableOpacity
              style={[styles.shortcutCard, { backgroundColor: themeColors.cardNavyBackground, borderColor: themeColors.cardBorder }]}
              activeOpacity={0.75}
              onPress={() => router.push('/(tabs)/contacts')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Emergency Contacts, ${contacts.length} contacts configured`}
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: '#0D3B66' }]}>
                <Ionicons name="people" size={22} color={Colors.white} />
              </View>
              <View style={styles.shortcutTextCol}>
                <Text style={[styles.shortcutTitle, { color: themeColors.textPrimary }]}>Emergency Contacts</Text>
                <Text style={[styles.shortcutSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {contacts.length === 0
                    ? 'No Contacts Saved'
                    : `${contacts.length} Contact${contacts.length === 1 ? '' : 's'} Configured`}
                </Text>
              </View>
              <View style={styles.shortcutArrow}>
                <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
              </View>
            </TouchableOpacity>

            {/* Shortcut 2: Live Location */}
            <TouchableOpacity
              style={[styles.shortcutCard, { backgroundColor: themeColors.cardNavyBackground, borderColor: themeColors.cardBorder }]}
              activeOpacity={0.75}
              onPress={() => router.push('/(tabs)/location')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Live Location, Real-Time GPS Radar"
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: '#034078' }]}>
                <Ionicons name="radio" size={22} color={Colors.white} />
              </View>
              <View style={styles.shortcutTextCol}>
                <Text style={[styles.shortcutTitle, { color: themeColors.textPrimary }]}>Live Location</Text>
                <Text style={[styles.shortcutSub, { color: themeColors.textSecondary }]} numberOfLines={1}>Real-Time GPS Radar</Text>
              </View>
              <View style={styles.shortcutArrow}>
                <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
              </View>
            </TouchableOpacity>

            {/* Shortcut 3: Alert History */}
            <TouchableOpacity
              style={[styles.shortcutCard, { backgroundColor: themeColors.cardNavyBackground, borderColor: themeColors.cardBorder }]}
              activeOpacity={0.75}
              onPress={() => router.push('/(tabs)/history')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`Alert History, ${history.length} records archived`}
            >
              <View style={[styles.shortcutIconBox, { backgroundColor: '#1E293B' }]}>
                <Ionicons name="time" size={22} color={Colors.white} />
              </View>
              <View style={styles.shortcutTextCol}>
                <Text style={[styles.shortcutTitle, { color: themeColors.textPrimary }]}>Alert History</Text>
                <Text style={[styles.shortcutSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  {history.length === 0
                    ? 'No Incidents Logged'
                    : `${history.length} Record${history.length === 1 ? '' : 's'} Archived`}
                </Text>
              </View>
              <View style={styles.shortcutArrow}>
                <Ionicons name="chevron-forward" size={16} color={themeColors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Demonstration Notice */}
        <View style={styles.footerNoteBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.slate400} />
          <Text style={styles.footerNoteText}>
            Safety Demonstration Mode • Real emergency calls and SMS broadcasts are disabled.
          </Text>
        </View>
      </ScrollView>

      {/* ==================================================================== */}
      {/* 5-SECOND COUNTDOWN MODAL WITH CANCEL BUTTON                          */}
      {/* ==================================================================== */}
      <CountdownModal
        visible={isCountingDown}
        countdown={countdownValue}
        onCancel={handleCancelCountdown}
        onInstantTrigger={handleInstantTrigger}
      />

      {/* ==================================================================== */}
      {/* DEMO ALERT CONFIRMATION MODAL                                        */}
      {/* ==================================================================== */}
      <AlertConfirmationModal
        visible={isConfirmationModalVisible}
        alertRecord={createdAlertRecord}
        contactsCount={contacts.length}
        onViewHistory={() => {
          setIsConfirmationModalVisible(false);
          router.push('/(tabs)/history');
        }}
        onDismiss={() => {
          setIsConfirmationModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

// ============================================================================
// Premium Dark Navy Theme Styles (Responsive for Android Phones)
// ============================================================================
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Colors.navy[900], // Premium Midnight Navy (#0A1128)
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 14 : 10,
    paddingBottom: 120,
  },

  // 1. Branding Header
  brandContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTextGroup: {
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: Colors.emergency.light,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate400,
    marginTop: 1,
    letterSpacing: 0.2,
  },
  demoModeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
    marginRight: 5,
  },
  demoModeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.8,
  },

  // 1b. Backend Connection Status Bar
  backendStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0A173B',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    gap: 8,
  },
  backendStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  backendStatusTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
  },
  backendUrlText: {
    fontSize: 10,
    color: Colors.slate400,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    flexShrink: 1,
  },
  backendStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
    gap: 5,
  },
  backendPillConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  backendPillDisconnected: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  backendStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  backendDotConnected: {
    backgroundColor: Colors.success,
  },
  backendDotDisconnected: {
    backgroundColor: Colors.emergency.primary,
  },
  backendPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  backendTextConnected: {
    color: Colors.success,
  },
  backendTextDisconnected: {
    color: Colors.emergency.light,
  },

  // 2. GPS Location Status Bar
  gpsStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1B3E',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  gpsIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gpsTextCol: {
    flex: 1,
    minWidth: 0,
  },
  gpsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  gpsStatusLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  permissionPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexShrink: 0,
  },
  pillGranted: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  pillDenied: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  permissionPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillTextGranted: {
    color: Colors.success,
  },
  pillTextDenied: {
    color: Colors.warning,
  },
  gpsCoordsText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '600',
    marginTop: 1,
  },
  gpsArrowBox: {
    flexShrink: 0,
    marginLeft: 4,
  },

  // 3. Active Emergency Simulation Banner
  activeSimulationBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1.5,
    borderColor: Colors.emergency.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  activeBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeBannerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.emergency.primary,
    marginRight: 6,
  },
  activeBannerTitle: {
    color: Colors.emergency.light,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activeTimerText: {
    color: Colors.white,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '900',
  },
  activeBannerDesc: {
    color: Colors.slate400,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  submittingText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  activeActionsRow: {
    flexDirection: 'row',
  },
  standDownBtn: {
    backgroundColor: Colors.emergency.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  standDownBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.5,
  },

  // 4. Centerpiece Glowing Red Circular SOS Button
  centerpieceContainer: {
    width: '100%',
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
  },
  outerGlowRing: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  outerGlowRingActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
  },
  middleGlowRing: {
    position: 'absolute',
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
  },
  middleGlowRingActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.32)',
  },
  sosCircleButton: {
    width: 182,
    height: 182,
    borderRadius: 91,
    backgroundColor: Colors.emergency.primary, // #DC2626
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.65,
    shadowRadius: 20,
    elevation: 12,
  },
  sosCircleButtonActive: {
    backgroundColor: Colors.emergency.dark,
    borderColor: Colors.emergency.light,
  },
  buttonInnerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonText: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 2,
    lineHeight: 46,
    marginTop: 2,
  },
  sosButtonTextActive: {
    fontSize: 26,
    letterSpacing: 1.5,
    lineHeight: 30,
  },
  sosButtonSub: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.8,
    marginTop: 2,
    paddingHorizontal: 8,
  },

  // 5. Text Below Button: "Press for Emergency"
  instructionBlock: {
    alignItems: 'center',
    marginBottom: 26,
  },
  pressForEmergencyText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  instructionSubtext: {
    fontSize: 12,
    color: Colors.slate400,
    marginTop: 4,
    textAlign: 'center',
  },

  // 6. Safety Shortcuts Section
  shortcutsSection: {
    width: '100%',
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  shortcutsGrid: {
    gap: 10,
  },
  shortcutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1B3E', // elevated card background
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  shortcutIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  shortcutTextCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  shortcutSub: {
    fontSize: 12,
    color: Colors.slate400,
  },
  shortcutArrow: {
    marginLeft: 12,
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 7. Footer Note Box
  footerNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  footerNoteText: {
    fontSize: 11,
    color: Colors.slate400,
    marginLeft: 6,
    textAlign: 'center',
  },
});
