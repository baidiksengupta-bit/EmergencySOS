import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Colors } from '../../src/constants/Colors';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { Ionicons } from '@expo/vector-icons';
import { useSOS } from '../../src/context/SOSContext';

type LocationState = 'idle' | 'loading' | 'success' | 'denied-permission' | 'unavailable';

interface DeviceLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  address?: string;
  speed?: number | null;
  heading?: number | null;
}

export default function LocationScreen() {
  const { refreshPermissionStatus } = useSOS();
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [locationData, setLocationData] = useState<DeviceLocationResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);

  // Check initial permission status silently on mount (without prompting the user)
  useEffect(() => {
    checkInitialStatus();
  }, []);

  const checkInitialStatus = async () => {
    try {
      await refreshPermissionStatus();
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        return;
      }
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'denied' && !perm.canAskAgain) {
        // If user already permanently denied in the past
        setLocationState('denied-permission');
        setStatusMessage('Foreground location permission was denied. You can enable it in device settings.');
      }
    } catch (e) {
      console.warn('Initial location status check error:', e);
    }
  };

  /**
   * Main entry point when user taps "Check My Location" or "Refresh Location"
   */
  const handleCheckLocation = useCallback(async () => {
    try {
      // 1. Verify device location services (GPS) are enabled on hardware
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationState('unavailable');
        setStatusMessage('Device location services (GPS) are turned off. Please enable GPS in device settings and retry.');
        return;
      }

      // 2. Check if foreground permission is already granted
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        await executeLocationAcquisition();
      } else {
        // Show clear explanation modal before requesting system permission
        setShowPermissionModal(true);
      }
    } catch (err: any) {
      console.warn('Error verifying location services:', err);
      setLocationState('unavailable');
      setStatusMessage(err?.message || 'Unable to communicate with device location hardware.');
    }
  }, []);

  /**
   * Called when user confirms foreground permission request in the explanation modal
   */
  const handleConfirmPermissionRequest = async () => {
    setShowPermissionModal(false);
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      await refreshPermissionStatus();
      if (response.status === 'granted') {
        await executeLocationAcquisition();
      } else {
        setLocationState('denied-permission');
        setStatusMessage('Foreground location permission was denied. EmergencySOS requires this permission to display your GPS coordinates on this device.');
      }
    } catch (err: any) {
      console.warn('Location permission request failed:', err);
      setLocationState('denied-permission');
      setStatusMessage(err?.message || 'Permission request could not be completed.');
    }
  };

  /**
   * Strictly device-only foreground location acquisition
   * No background tracking, no remote transmission, no SMS or phone calls.
   */
  const executeLocationAcquisition = async () => {
    setLocationState('loading');
    setStatusMessage(null);

    try {
      // Fetch high accuracy foreground location from device GPS
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let geocodedAddress: string | undefined = undefined;
      try {
        const places = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (places && places.length > 0) {
          const p = places[0];
          const parts = [
            p.streetNumber,
            p.street || p.name,
            p.city || p.subregion,
            p.region,
            p.postalCode,
          ].filter(Boolean);
          if (parts.length > 0) {
            geocodedAddress = parts.join(', ');
          }
        }
      } catch {
        // Reverse geocoding is optional - fallback to coordinates display
      }

      setLocationData({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        address: geocodedAddress,
        speed: position.coords.speed,
        heading: position.coords.heading,
      });
      setLocationState('success');
    } catch (gpsError: any) {
      console.warn('Current GPS lock failed, attempting device last known position:', gpsError);
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          setLocationData({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy,
            timestamp: lastKnown.timestamp,
            address: 'Last Known Device Position',
            speed: lastKnown.coords.speed,
            heading: lastKnown.coords.heading,
          });
          setLocationState('success');
          return;
        }
      } catch {
        // Fallback failed
      }

      setLocationState('unavailable');
      setStatusMessage('Unable to acquire satellite lock. Please ensure your device has clear sky visibility or that GPS is enabled.');
    }
  };

  /**
   * Format latitude with hemisphere (N / S)
   */
  const formatLatitude = (lat: number): string => {
    const dir = lat >= 0 ? 'N' : 'S';
    return `${Math.abs(lat).toFixed(6)}° ${dir}`;
  };

  /**
   * Format longitude with hemisphere (E / W)
   */
  const formatLongitude = (lon: number): string => {
    const dir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lon).toFixed(6)}° ${dir}`;
  };

  /**
   * Format accuracy in meters
   */
  const formatAccuracy = (acc: number | null): string => {
    if (acc == null) return '± -- m';
    return `±${acc.toFixed(1)} m`;
  };

  /**
   * Format timestamp into time + date
   */
  const formatTimeUpdated = (timestamp: number): string => {
    const d = new Date(timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return `${timeStr} (${dateStr})`;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Header
        title="Live Location"
        subtitle="Device-Only Safe GPS Telemetry"
        variant="navy"
        rightAction={
          locationState === 'success'
            ? {
                icon: 'refresh',
                onPress: handleCheckLocation,
              }
            : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Device-Only Privacy Guarantee Banner */}
        <View style={styles.privacyGuaranteeBanner}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
          <View style={styles.privacyTextCol}>
            <Text style={styles.privacyBannerTitle}>100% DEVICE-ONLY PRIVACY</Text>
            <Text style={styles.privacyBannerSub}>
              Coordinates stay strictly on this device. No remote transmission, no cloud logging, and no background tracking.
            </Text>
          </View>
        </View>

        {/* ================================================================== */}
        {/* Radar & Status Visualizer Card                                     */}
        {/* ================================================================== */}
        <Card variant="navy" style={styles.radarCard}>
          <View style={styles.radarVisualContainer}>
            <View style={styles.radarRingOuter} />
            <View style={styles.radarRingMiddle} />
            <View style={styles.radarRingInner} />
            <View style={styles.radarCrosshairH} />
            <View style={styles.radarCrosshairV} />

            {/* Dynamic Beacon Pin based on state */}
            {locationState === 'loading' ? (
              <View style={styles.centralBeaconLoading}>
                <ActivityIndicator size="small" color={Colors.white} />
              </View>
            ) : locationState === 'success' ? (
              <>
                <View style={styles.centralPulseRing} />
                <View style={styles.centralBeaconActive}>
                  <Ionicons name="navigate" size={20} color={Colors.white} />
                </View>
              </>
            ) : locationState === 'denied-permission' ? (
              <View style={[styles.centralBeacon, { backgroundColor: Colors.warning }]}>
                <Ionicons name="lock-closed" size={18} color={Colors.white} />
              </View>
            ) : locationState === 'unavailable' ? (
              <View style={[styles.centralBeacon, { backgroundColor: Colors.slate600 }]}>
                <Ionicons name="alert" size={18} color={Colors.white} />
              </View>
            ) : (
              <View style={styles.centralBeaconIdle}>
                <Ionicons name="location-outline" size={20} color={Colors.slate400} />
              </View>
            )}
          </View>

          {/* Radar Status Bar */}
          <View style={styles.radarStatusRow}>
            <View
              style={[
                styles.statusPill,
                locationState === 'success'
                  ? styles.statusPillSuccess
                  : locationState === 'loading'
                  ? styles.statusPillLoading
                  : locationState === 'denied-permission'
                  ? styles.statusPillDenied
                  : styles.statusPillIdle,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  locationState === 'success'
                    ? { backgroundColor: Colors.success }
                    : locationState === 'loading'
                    ? { backgroundColor: Colors.info }
                    : locationState === 'denied-permission'
                    ? { backgroundColor: Colors.warning }
                    : { backgroundColor: Colors.slate400 },
                ]}
              />
              <Text style={styles.statusPillText}>
                {locationState === 'success'
                  ? 'SATELLITE LOCK ACTIVE'
                  : locationState === 'loading'
                  ? 'SEARCHING SATELLITES...'
                  : locationState === 'denied-permission'
                  ? 'PERMISSION REQUIRED'
                  : locationState === 'unavailable'
                  ? 'GPS UNAVAILABLE'
                  : 'STANDBY • READY'}
              </Text>
            </View>

            <Text style={styles.precisionText}>
              {locationState === 'success' && locationData?.accuracy
                ? `±${locationData.accuracy.toFixed(1)}m accuracy`
                : 'Device sensor telemetry'}
            </Text>
          </View>
        </Card>

        {/* ================================================================== */}
        {/* STATE 1: IDLE (Initial view before checking location)               */}
        {/* ================================================================== */}
        {locationState === 'idle' && (
          <View style={styles.stateContainer}>
            <Card variant="white" style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="navigate-circle" size={26} color={Colors.emergency.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>Check Device GPS Coordinates</Text>
                  <Text style={styles.infoCardSubtitle}>
                    Safely capture and inspect your current latitude, longitude, and satellite accuracy directly on your phone.
                  </Text>
                </View>
              </View>

              <View style={styles.noticeList}>
                <View style={styles.noticeItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.noticeItemText}>Foreground-only permission requested</Text>
                </View>
                <View style={styles.noticeItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.noticeItemText}>No remote transmission or server logging</Text>
                </View>
                <View style={styles.noticeItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.noticeItemText}>No automatic SMS or calls dispatched</Text>
                </View>
              </View>
            </Card>

            <Button
              title="Check My Location"
              variant="danger"
              size="lg"
              onPress={handleCheckLocation}
              icon={<Ionicons name="navigate" size={20} color={Colors.white} />}
              accessibilityLabel="Check My Device Location GPS Coordinates"
              style={styles.mainActionButton}
            />
          </View>
        )}

        {/* ================================================================== */}
        {/* STATE 2: LOADING (Acquiring satellite fix)                         */}
        {/* ================================================================== */}
        {locationState === 'loading' && (
          <Card variant="white" style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.emergency.primary} style={styles.loadingSpinner} />
            <Text style={styles.loadingTitle}>Acquiring Device GPS Fix...</Text>
            <Text style={styles.loadingSubtitle}>
              Connecting to device satellite sensors in the foreground. Coordinates remain strictly on this device.
            </Text>
            <View style={styles.loadingBadge}>
              <Ionicons name="lock-closed" size={14} color={Colors.navy[600]} />
              <Text style={styles.loadingBadgeText}>ZERO CLOUD TRANSMISSION</Text>
            </View>
          </Card>
        )}

        {/* ================================================================== */}
        {/* STATE 3: DENIED PERMISSION                                         */}
        {/* ================================================================== */}
        {locationState === 'denied-permission' && (
          <Card variant="white" style={styles.errorCard}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="lock-closed" size={28} color={Colors.warning} />
            </View>
            <Text style={styles.errorTitle}>Foreground Permission Denied</Text>
            <Text style={styles.errorSubtitle}>
              {statusMessage ||
                'EmergencySOS was not granted foreground location permission. To view your exact device coordinates on this screen, please allow location access.'}
            </Text>

            <View style={styles.errorActions}>
              <Button
                title="Grant Permission (Try Again)"
                variant="danger"
                size="md"
                onPress={handleCheckLocation}
                icon={<Ionicons name="shield-checkmark" size={18} color={Colors.white} />}
                style={styles.errorBtn}
              />
              <Button
                title="Open Phone Settings"
                variant="outline"
                size="md"
                onPress={() => Linking.openSettings()}
                icon={<Ionicons name="settings-outline" size={18} color={Colors.navy[900]} />}
                style={styles.errorBtn}
              />
            </View>
          </Card>
        )}

        {/* ================================================================== */}
        {/* STATE 4: LOCATION UNAVAILABLE                                      */}
        {/* ================================================================== */}
        {locationState === 'unavailable' && (
          <Card variant="white" style={styles.errorCard}>
            <View style={[styles.errorIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="location-outline" size={28} color={Colors.emergency.primary} />
            </View>
            <Text style={styles.errorTitle}>Location Services Unavailable</Text>
            <Text style={styles.errorSubtitle}>
              {statusMessage ||
                'GPS location hardware is disabled or a satellite signal could not be acquired. Please turn on Location in your device settings.'}
            </Text>

            <View style={styles.errorActions}>
              <Button
                title="Retry Location Check"
                variant="danger"
                size="md"
                onPress={handleCheckLocation}
                icon={<Ionicons name="refresh" size={18} color={Colors.white} />}
                style={styles.errorBtn}
              />
              <Button
                title="Open Device Settings"
                variant="outline"
                size="md"
                onPress={() => Linking.openSettings()}
                icon={<Ionicons name="settings-outline" size={18} color={Colors.navy[900]} />}
                style={styles.errorBtn}
              />
            </View>
          </Card>
        )}

        {/* ================================================================== */}
        {/* STATE 5: SUCCESS (Coordinates & Accuracy Acquired)                */}
        {/* ================================================================== */}
        {locationState === 'success' && locationData && (
          <View style={styles.successContainer}>
            {/* Time Updated Card */}
            <Card variant="white" style={styles.timeCard}>
              <View style={styles.timeRow}>
                <View style={styles.timeIconBox}>
                  <Ionicons name="time" size={20} color={Colors.navy[700]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeLabel}>LAST TIME UPDATED</Text>
                  <Text style={styles.timeValue}>{formatTimeUpdated(locationData.timestamp)}</Text>
                </View>
                <Badge label="JUST NOW" variant="success" />
              </View>
            </Card>

            {/* Reverse Geocoded Street Fix (if available) */}
            {locationData.address && (
              <Card variant="white" style={styles.addressCard}>
                <View style={styles.addressRow}>
                  <View style={styles.addressIconCircle}>
                    <Ionicons name="location" size={20} color={Colors.emergency.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addressLabel}>APPROXIMATE STREET ADDRESS</Text>
                    <Text style={styles.addressValue}>{locationData.address}</Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Primary Coordinates Metrics Grid */}
            <View style={styles.metricsGrid}>
              {/* Latitude */}
              <Card variant="white" style={styles.metricCard}>
                <Ionicons name="compass-outline" size={22} color={Colors.navy[700]} />
                <Text style={styles.metricLabel}>LATITUDE</Text>
                <Text style={styles.metricValue}>{formatLatitude(locationData.latitude)}</Text>
              </Card>

              {/* Longitude */}
              <Card variant="white" style={styles.metricCard}>
                <Ionicons name="globe-outline" size={22} color={Colors.navy[700]} />
                <Text style={styles.metricLabel}>LONGITUDE</Text>
                <Text style={styles.metricValue}>{formatLongitude(locationData.longitude)}</Text>
              </Card>

              {/* Accuracy */}
              <Card variant="white" style={styles.metricCard}>
                <Ionicons name="scan-outline" size={22} color={Colors.navy[700]} />
                <Text style={styles.metricLabel}>GPS ACCURACY</Text>
                <Text style={styles.metricValue}>{formatAccuracy(locationData.accuracy)}</Text>
                <Text style={styles.metricSub}>
                  {locationData.accuracy && locationData.accuracy <= 15
                    ? 'High Precision'
                    : 'Standard Precision'}
                </Text>
              </Card>

              {/* Sensor Speed / Health */}
              <Card variant="white" style={styles.metricCard}>
                <Ionicons name="speedometer-outline" size={22} color={Colors.success} />
                <Text style={styles.metricLabel}>GROUND SPEED</Text>
                <Text style={styles.metricValue}>
                  {locationData.speed && locationData.speed > 0
                    ? `${(locationData.speed * 3.6).toFixed(1)} km/h`
                    : '0.0 km/h'}
                </Text>
                <Text style={styles.metricSub}>Device Motion</Text>
              </Card>
            </View>

            {/* Safe Device-Only Result Stamp */}
            <View style={styles.deviceOnlyStamp}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              <Text style={styles.deviceOnlyStampText}>
                Active session only • Zero cloud synchronization • Safe foreground access
              </Text>
            </View>

            {/* “Refresh Location” Button */}
            <Button
              title="Refresh Location"
              variant="danger"
              size="lg"
              onPress={handleCheckLocation}
              icon={<Ionicons name="refresh" size={20} color={Colors.white} />}
              accessibilityLabel="Refresh Device GPS Location Fix"
              style={styles.mainActionButton}
            />
          </View>
        )}
      </ScrollView>

      {/* ================================================================== */}
      {/* Clear Permission Explanation Modal                                */}
      {/* ================================================================== */}
      <Modal visible={showPermissionModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.modalSafeContainer}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconBox}>
                    <Ionicons name="location" size={28} color={Colors.emergency.primary} />
                  </View>
                  <Text style={styles.modalTitle}>Foreground Location Access</Text>
                  <Text style={styles.modalSubtitle}>
                    Why EmergencySOS requests device location:
                  </Text>
                </View>

                <View style={styles.modalExplanationBody}>
                  <View style={styles.explanationItem}>
                    <Ionicons name="phone-portrait-outline" size={22} color={Colors.navy[500]} />
                    <View style={styles.explanationTextCol}>
                      <Text style={styles.explanationItemTitle}>Strictly On-Device</Text>
                      <Text style={styles.explanationItemDesc}>
                        Your GPS coordinates are calculated and shown strictly on this phone for your reference.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.explanationItem}>
                    <Ionicons name="eye-off-outline" size={22} color={Colors.navy[500]} />
                    <View style={styles.explanationTextCol}>
                      <Text style={styles.explanationItemTitle}>No Background Tracking</Text>
                      <Text style={styles.explanationItemDesc}>
                        Location is only retrieved in the foreground when you tap Check or Refresh on this screen.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.explanationItem}>
                    <Ionicons name="cloud-offline-outline" size={22} color={Colors.navy[500]} />
                    <View style={styles.explanationTextCol}>
                      <Text style={styles.explanationItemTitle}>Zero Cloud Transmission</Text>
                      <Text style={styles.explanationItemDesc}>
                        No coordinates are uploaded to external databases, shared, texted, or broadcast.
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalActionsCol}>
                  <Button
                    title="Allow Foreground Access"
                    variant="danger"
                    size="md"
                    onPress={handleConfirmPermissionRequest}
                    icon={<Ionicons name="checkmark-circle" size={18} color={Colors.white} />}
                    style={{ marginBottom: 10 }}
                  />
                  <Button
                    title="Cancel"
                    variant="outline"
                    size="md"
                    onPress={() => setShowPermissionModal(false)}
                  />
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy[900],
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },

  // Privacy Guarantee Banner
  privacyGuaranteeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  privacyTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  privacyBannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.success,
    letterSpacing: 0.8,
  },
  privacyBannerSub: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 2,
    lineHeight: 15,
  },

  // Radar Visualizer
  radarCard: {
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  radarVisualContainer: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: Colors.navy.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 10,
    borderWidth: 2,
    borderColor: Colors.navy[700],
    overflow: 'hidden',
  },
  radarRingOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(18, 130, 162, 0.25)',
  },
  radarRingMiddle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(18, 130, 162, 0.4)',
  },
  radarRingInner: {
    position: 'absolute',
    width: 75,
    height: 75,
    borderRadius: 37.5,
    borderWidth: 1,
    borderColor: 'rgba(18, 130, 162, 0.6)',
  },
  radarCrosshairH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(18, 130, 162, 0.3)',
  },
  radarCrosshairV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(18, 130, 162, 0.3)',
  },
  centralPulseRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
  },
  centralBeacon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centralBeaconActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  centralBeaconLoading: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centralBeaconIdle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navy[800],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.navy[600],
  },
  radarStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusPillLoading: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
  },
  statusPillDenied: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillIdle: {
    backgroundColor: Colors.navy[800],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusPillText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  precisionText: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '600',
  },

  // General State Container
  stateContainer: {
    width: '100%',
  },
  infoCard: {
    padding: 18,
    marginBottom: 14,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.emergency.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy[900],
  },
  infoCardSubtitle: {
    fontSize: 12,
    color: Colors.slate600,
    marginTop: 3,
    lineHeight: 17,
  },
  noticeList: {
    borderTopWidth: 1,
    borderTopColor: Colors.slate100,
    paddingTop: 12,
    gap: 8,
  },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noticeItemText: {
    fontSize: 12,
    color: Colors.navy[800],
    fontWeight: '600',
    marginLeft: 8,
  },

  mainActionButton: {
    width: '100%',
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },

  // Loading State
  loadingCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  loadingSpinner: {
    marginBottom: 12,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy[900],
  },
  loadingSubtitle: {
    fontSize: 12,
    color: Colors.slate600,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.slate100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 14,
  },
  loadingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.navy[700],
    marginLeft: 6,
    letterSpacing: 0.5,
  },

  // Error Cards (Denied / Unavailable)
  errorCard: {
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
  },
  errorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.navy[900],
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 12,
    color: Colors.slate600,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  errorActions: {
    width: '100%',
    gap: 10,
  },
  errorBtn: {
    width: '100%',
  },

  // Success State
  successContainer: {
    width: '100%',
  },
  timeCard: {
    padding: 14,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.navy[900],
    marginTop: 2,
  },

  addressCard: {
    padding: 14,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.emergency.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
  },
  addressValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.navy[900],
    marginTop: 2,
    lineHeight: 18,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    width: '48.5%',
    padding: 14,
    alignItems: 'center',
    marginVertical: 0,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.navy[900],
    marginTop: 4,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  metricSub: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate400,
    marginTop: 3,
  },

  deviceOnlyStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  deviceOnlyStampText: {
    fontSize: 11,
    color: Colors.slate400,
    marginLeft: 6,
    fontWeight: '600',
  },

  // Explanation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 17, 40, 0.92)',
  },
  modalSafeContainer: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.navy[900],
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: Colors.navy[700],
    shadowColor: Colors.navy.darkest,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  modalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1.5,
    borderColor: Colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.slate400,
    textAlign: 'center',
    marginTop: 4,
  },
  modalExplanationBody: {
    backgroundColor: Colors.navy[800],
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  explanationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  explanationTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  explanationItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  explanationItemDesc: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 2,
    lineHeight: 16,
  },
  modalActionsCol: {
    width: '100%',
  },
});
