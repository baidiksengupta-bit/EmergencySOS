import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform,
  Dimensions,
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
import { apiService, NearbyEmergencyService } from '../../src/services/api';
import { locationService } from '../../src/services/location';

// Dynamically import react-native-maps for native platforms; handle web gracefully
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_DEFAULT: any = null;

if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch (err) {
    console.warn('react-native-maps not available, falling back to coordinate list view:', err);
  }
}

type LocationState = 'idle' | 'loading' | 'success' | 'denied-permission' | 'unavailable';
type ServiceFilter = 'all' | 'police' | 'hospital';

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
  const { refreshPermissionStatus, activeAlert, breadcrumbs, themeColors } = useSOS();
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [locationData, setLocationData] = useState<DeviceLocationResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);

  // Nearby Emergency Services State
  const [services, setServices] = useState<NearbyEmergencyService[]>([]);
  const [selectedService, setSelectedService] = useState<NearbyEmergencyService | null>(null);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [isLoadingServices, setIsLoadingServices] = useState<boolean>(false);

  // OSRM Route Preview State
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeDurationMins, setRouteDurationMins] = useState<number | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  const mapRef = useRef<any>(null);

  // Check initial permission status silently on mount
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
        setLocationState('denied-permission');
        setStatusMessage('Foreground location permission was denied. You can enable it in device settings.');
      } else if (perm.status === 'granted') {
        executeLocationAcquisition();
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
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLocationState('unavailable');
        setStatusMessage('Device location services (GPS) are turned off. Please enable GPS in device settings and retry.');
        return;
      }

      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        await executeLocationAcquisition();
      } else {
        setShowPermissionModal(true);
      }
    } catch (err: any) {
      console.warn('Error verifying location services:', err);
      setLocationState('unavailable');
      setStatusMessage(err?.message || 'Unable to communicate with device location hardware.');
    }
  }, []);

  const handleConfirmPermissionRequest = async () => {
    setShowPermissionModal(false);
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      await refreshPermissionStatus();
      if (response.status === 'granted') {
        await executeLocationAcquisition();
      } else {
        setLocationState('denied-permission');
        setStatusMessage('Foreground location permission was denied. EmergencySOS requires this permission to display your GPS coordinates.');
      }
    } catch (err: any) {
      console.warn('Location permission request failed:', err);
      setLocationState('denied-permission');
      setStatusMessage(err?.message || 'Permission request could not be completed.');
    }
  };

  /**
   * Fetch nearby police stations and hospitals from FastAPI / OpenStreetMap Overpass
   */
  const loadNearbyServices = async (lat: number, lng: number) => {
    setIsLoadingServices(true);
    try {
      const results = await apiService.getNearbyServices(lat, lng, 3000);
      setServices(results);

      // Auto-select the first nearest facility if none selected
      if (results.length > 0) {
        handleSelectFacility(results[0], lat, lng);
      }
    } catch (err) {
      console.warn('Failed to load nearby services:', err);
    } finally {
      setIsLoadingServices(false);
    }
  };

  /**
   * Handle user selection of a facility: updates card and queries OSRM route geometry
   */
  const handleSelectFacility = async (
    facility: NearbyEmergencyService,
    userLat?: number,
    userLng?: number
  ) => {
    setSelectedService(facility);

    const startLat = userLat ?? locationData?.latitude;
    const startLng = userLng ?? locationData?.longitude;

    if (!startLat || !startLng) return;

    setIsLoadingRoute(true);
    setRouteCoordinates([]);
    setRouteDistanceKm(null);
    setRouteDurationMins(null);

    try {
      const routeData = await locationService.fetchOSRMRoute(
        startLat,
        startLng,
        facility.latitude,
        facility.longitude
      );

      if (routeData && routeData.coordinates.length > 0) {
        setRouteCoordinates(routeData.coordinates);
        setRouteDistanceKm(parseFloat((routeData.distanceMeters / 1000).toFixed(2)));
        setRouteDurationMins(Math.max(1, Math.round(routeData.durationSeconds / 60)));

        // Animate map camera to encompass route
        if (mapRef.current && routeData.coordinates.length > 1) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: startLat, longitude: startLng },
              { latitude: facility.latitude, longitude: facility.longitude },
            ],
            {
              edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
              animated: true,
            }
          );
        }
      } else {
        // Fallback straight segment if OSRM is unreachable
        setRouteCoordinates([
          { latitude: startLat, longitude: startLng },
          { latitude: facility.latitude, longitude: facility.longitude },
        ]);
        setRouteDistanceKm(facility.distance_km);
        setRouteDurationMins(Math.max(1, Math.round(facility.distance_km * 3)));
      }
    } catch (routeErr) {
      console.warn('Error acquiring route preview:', routeErr);
      setRouteCoordinates([
        { latitude: startLat, longitude: startLng },
        { latitude: facility.latitude, longitude: facility.longitude },
      ]);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  /**
   * Launch native turn-by-turn navigation via Google Maps / Apple Maps
   */
  const handleStartNavigation = async (facility: NearbyEmergencyService) => {
    const navUrl = await locationService.openNativeNavigation(
      facility.latitude,
      facility.longitude,
      facility.name
    );
    try {
      const canOpen = await Linking.canOpenURL(navUrl);
      if (canOpen) {
        await Linking.openURL(navUrl);
      } else {
        const fallback = locationService.getGoogleMapsUrl(facility.latitude, facility.longitude);
        await Linking.openURL(fallback);
      }
    } catch (e) {
      console.warn('Navigation launch error:', e);
      Linking.openURL(locationService.getGoogleMapsUrl(facility.latitude, facility.longitude));
    }
  };

  /**
   * Device location acquisition
   */
  const executeLocationAcquisition = async () => {
    setLocationState('loading');
    setStatusMessage(null);

    try {
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
        // Reverse geocoding optional
      }

      const res: DeviceLocationResult = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        address: geocodedAddress,
        speed: position.coords.speed,
        heading: position.coords.heading,
      };

      setLocationData(res);
      setLocationState('success');

      // Automatically discover nearby police & hospitals around current fix
      loadNearbyServices(res.latitude, res.longitude);
    } catch (gpsError: any) {
      console.warn('GPS lock failed, attempting device last known position:', gpsError);
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          const res: DeviceLocationResult = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy,
            timestamp: lastKnown.timestamp,
            address: 'Last Known Device Position',
            speed: lastKnown.coords.speed,
            heading: lastKnown.coords.heading,
          };
          setLocationData(res);
          setLocationState('success');
          loadNearbyServices(res.latitude, res.longitude);
          return;
        }
      } catch {
        // Fallback failed
      }

      setLocationState('unavailable');
      setStatusMessage('Unable to acquire satellite lock. Please ensure your device has clear sky visibility or that GPS is enabled.');
    }
  };

  const filteredServices = services.filter((svc) => {
    if (serviceFilter === 'police') return svc.category === 'police';
    if (serviceFilter === 'hospital') return svc.category === 'hospital';
    return true;
  });

  const hasNativeMap = Platform.OS !== 'web' && MapView !== null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={themeColors.statusBarStyle} />

      <Header
        title="Emergency Map & Routes"
        subtitle="Police Stations • Hospitals • Turn-by-Turn"
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
        {/* ================================================================== */}
        {/* Interactive Map & Nearby Facilities Section                        */}
        {/* ================================================================== */}
        {locationState === 'success' && locationData && (
          <View style={styles.mapSectionContainer}>
            {/* Live SOS Tracking Trail Banner (If Alert is Active) */}
            {activeAlert && (
              <View style={styles.liveSosBanner}>
                <View style={styles.liveSosBadge}>
                  <View style={styles.liveSosPulseDot} />
                  <Text style={styles.liveSosBadgeText}>LIVE SOS BROADCAST ACTIVE</Text>
                </View>
                <View style={styles.liveSosStatsRow}>
                  <Ionicons name="footsteps" size={14} color="#EF4444" />
                  <Text style={styles.liveSosStatsText}>
                    Tracking: {breadcrumbs.length} {breadcrumbs.length === 1 ? 'point' : 'points'}
                  </Text>
                  <Text style={styles.liveSosSubText}>• Live GPS Trail Recorded</Text>
                </View>
              </View>
            )}

            {/* Filter Chips Bar */}
            <View style={styles.filterChipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, serviceFilter === 'all' && styles.filterChipActive]}
                onPress={() => setServiceFilter('all')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="shield"
                  size={14}
                  color={serviceFilter === 'all' ? Colors.white : Colors.slate400}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    serviceFilter === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  All ({services.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, serviceFilter === 'police' && styles.filterChipActive]}
                onPress={() => setServiceFilter('police')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={serviceFilter === 'police' ? Colors.white : '#60A5FA'}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    serviceFilter === 'police' && styles.filterChipTextActive,
                  ]}
                >
                  Police ({services.filter((s) => s.category === 'police').length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, serviceFilter === 'hospital' && styles.filterChipActive]}
                onPress={() => setServiceFilter('hospital')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="medkit"
                  size={14}
                  color={serviceFilter === 'hospital' ? Colors.white : '#F87171'}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    serviceFilter === 'hospital' && styles.filterChipTextActive,
                  ]}
                >
                  Hospitals ({services.filter((s) => s.category === 'hospital').length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Map Canvas / Native react-native-maps or Clean Web Fallback */}
            {hasNativeMap ? (
              <View style={styles.mapWrapper}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_DEFAULT}
                  style={styles.mapCanvas}
                  initialRegion={{
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                    latitudeDelta: 0.035,
                    longitudeDelta: 0.035,
                  }}
                  showsUserLocation={true}
                  showsCompass={true}
                >
                  {/* User Current Location Marker */}
                  <Marker
                    coordinate={{
                      latitude: locationData.latitude,
                      longitude: locationData.longitude,
                    }}
                    title="Your Location"
                    description={locationData.address || 'Active GPS Position'}
                    pinColor="#2563EB"
                  />

                  {/* Nearby Police & Hospital Facility Markers */}
                  {filteredServices.map((facility) => {
                    const isSelected = selectedService?.id === facility.id;
                    const isPolice = facility.category === 'police';
                    return (
                      <Marker
                        key={facility.id}
                        coordinate={{
                          latitude: facility.latitude,
                          longitude: facility.longitude,
                        }}
                        title={facility.name}
                        description={`${facility.distance_km} km away`}
                        pinColor={isPolice ? '#1D4ED8' : '#DC2626'}
                        onPress={() => handleSelectFacility(facility)}
                      >
                        <View
                          style={[
                            styles.customMarkerCircle,
                            isPolice ? styles.policeMarker : styles.hospitalMarker,
                            isSelected && styles.markerCircleSelected,
                          ]}
                        >
                          <Ionicons
                            name={isPolice ? 'shield' : 'medkit'}
                            size={16}
                            color={Colors.white}
                          />
                        </View>
                      </Marker>
                    );
                  })}

                  {/* Live SOS Breadcrumb Trail (Rendered in Amber/Red when SOS active) */}
                  {activeAlert && breadcrumbs.length > 1 && (
                    <Polyline
                      coordinates={breadcrumbs.map((b) => ({
                        latitude: b.latitude,
                        longitude: b.longitude,
                      }))}
                      strokeColor="#F59E0B"
                      strokeWidth={5}
                      zIndex={10}
                    />
                  )}

                  {/* OSRM Route Geometry Polyline */}
                  {routeCoordinates.length > 0 && (
                    <Polyline
                      coordinates={routeCoordinates}
                      strokeColor="#DC2626"
                      strokeWidth={4}
                      lineDashPattern={isLoadingRoute ? [6, 4] : undefined}
                    />
                  )}
                </MapView>

                {/* Live Tracking Points Pill */}
                {activeAlert && breadcrumbs.length > 0 && (
                  <View style={styles.liveTrackingPill}>
                    <Ionicons name="radio" size={12} color="#10B981" />
                    <Text style={styles.liveTrackingPillText}>
                      Tracking: {breadcrumbs.length} {breadcrumbs.length === 1 ? 'point' : 'points'}
                    </Text>
                  </View>
                )}

                {isLoadingRoute && (
                  <View style={styles.routeLoadingPill}>
                    <ActivityIndicator size="small" color={Colors.white} />
                    <Text style={styles.routeLoadingText}>Calculating OSRM route...</Text>
                  </View>
                )}
              </View>
            ) : (
              /* Fallback for Web / Environments without native maps */
              <Card variant="navy" style={styles.webMapFallbackCard}>
                <View style={styles.webMapHeader}>
                  <Ionicons name="map-outline" size={24} color={Colors.info} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.webMapTitle}>Interactive Facility Finder</Text>
                    <Text style={styles.webMapSubtitle}>
                      {locationData.latitude.toFixed(5)}° N, {locationData.longitude.toFixed(5)}° W
                    </Text>
                  </View>
                  <Badge label="GPS ACTIVE" variant="success" />
                </View>
                <Text style={styles.webMapDesc}>
                  Select a facility below to preview route metrics and hand off to native Google / Apple Maps navigation.
                </Text>
              </Card>
            )}

            {/* Selected Facility Card with Route & Navigation Handoff */}
            {selectedService && (
              <Card variant="white" style={styles.selectedFacilityCard}>
                <View style={styles.facilityHeaderRow}>
                  <View
                    style={[
                      styles.facilityIconBadge,
                      selectedService.category === 'police'
                        ? styles.policeIconBadge
                        : styles.hospitalIconBadge,
                    ]}
                  >
                    <Ionicons
                      name={selectedService.category === 'police' ? 'shield-checkmark' : 'medkit'}
                      size={24}
                      color={Colors.white}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.facilityCategoryRow}>
                      <Badge
                        label={
                          selectedService.category === 'police'
                            ? 'POLICE STATION'
                            : 'EMERGENCY HOSPITAL'
                        }
                        variant={selectedService.category === 'police' ? 'info' : 'danger'}
                      />
                      <Text style={styles.facilityDistanceText}>
                        📍 {selectedService.distance_km} km away
                      </Text>
                    </View>
                    <Text style={styles.facilityTitleText} numberOfLines={2}>
                      {selectedService.name}
                    </Text>
                    {selectedService.address ? (
                      <Text style={styles.facilityAddressText} numberOfLines={1}>
                        {selectedService.address}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Route Preview Metrics */}
                <View style={styles.routeMetricsRow}>
                  <View style={styles.routeMetricItem}>
                    <Ionicons name="navigate-outline" size={16} color={Colors.slate600} />
                    <Text style={styles.routeMetricLabel}>EST. DISTANCE</Text>
                    <Text style={styles.routeMetricValue}>
                      {routeDistanceKm !== null ? `${routeDistanceKm} km` : `${selectedService.distance_km} km`}
                    </Text>
                  </View>

                  <View style={styles.routeMetricDivider} />

                  <View style={styles.routeMetricItem}>
                    <Ionicons name="car-outline" size={16} color={Colors.slate600} />
                    <Text style={styles.routeMetricLabel}>DRIVE TIME</Text>
                    <Text style={styles.routeMetricValue}>
                      {routeDurationMins !== null ? `~${routeDurationMins} mins` : 'Calculating...'}
                    </Text>
                  </View>

                  <View style={styles.routeMetricDivider} />

                  <View style={styles.routeMetricItem}>
                    <Ionicons name="compass-outline" size={16} color={Colors.slate600} />
                    <Text style={styles.routeMetricLabel}>ROUTING</Text>
                    <Text style={styles.routeMetricValue}>OSRM Public</Text>
                  </View>
                </View>

                {/* Turn-by-Turn Navigation Launch Button */}
                <Button
                  title={`Start Navigation to ${selectedService.category === 'police' ? 'Police' : 'Hospital'}`}
                  variant="danger"
                  size="lg"
                  onPress={() => handleStartNavigation(selectedService)}
                  icon={<Ionicons name="navigate" size={20} color={Colors.white} />}
                  style={styles.navButton}
                />
              </Card>
            )}

            {/* List of Other Nearby Facilities */}
            <View style={styles.facilitiesListSection}>
              <Text style={styles.facilitiesSectionHeader}>
                DISCOVERED EMERGENCY SERVICES ({filteredServices.length})
              </Text>

              {filteredServices.length === 0 && !isLoadingServices && (
                <View style={styles.emptyServicesCard}>
                  <Ionicons name="location-outline" size={32} color={Colors.slate400} />
                  <Text style={styles.emptyServicesTitle}>
                    {services.length === 0
                      ? 'No Nearby Facilities Found or Service Offline'
                      : `No ${serviceFilter === 'police' ? 'Police Stations' : 'Hospitals'} Found Nearby`}
                  </Text>
                  <Text style={styles.emptyServicesSubtitle}>
                    {services.length === 0
                      ? 'Unable to load emergency facilities within 3 km of your coordinates. Check network connection or tap retry below.'
                      : 'Try selecting "All" to view all discovered emergency response centers.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryServicesBtn}
                    onPress={() => loadNearbyServices(locationData.latitude, locationData.longitude)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={16} color={Colors.white} />
                    <Text style={styles.retryServicesBtnText}>Retry Facility Discovery</Text>
                  </TouchableOpacity>
                </View>
              )}

              {filteredServices.map((item) => {
                const isSelected = selectedService?.id === item.id;
                const isPolice = item.category === 'police';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.facilityListItem,
                      { backgroundColor: themeColors.cardNavyBackground, borderColor: isSelected ? themeColors.emergencyPrimary : themeColors.cardBorder },
                      isSelected && styles.facilityListItemSelected,
                    ]}
                    onPress={() => handleSelectFacility(item)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.itemTypeBadge,
                        isPolice ? styles.policeTypeBadge : styles.hospitalTypeBadge,
                      ]}
                    >
                      <Ionicons
                        name={isPolice ? 'shield' : 'medkit'}
                        size={18}
                        color={Colors.white}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.itemTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.itemSubtitle, { color: themeColors.textSecondary }]}>
                        {item.address || (isPolice ? 'Law Enforcement Facility' : 'Emergency Medical Services')}
                      </Text>
                    </View>
                    <View style={styles.itemDistanceBox}>
                      <Text style={styles.itemDistanceNumber}>{item.distance_km}</Text>
                      <Text style={styles.itemDistanceUnit}>km</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ================================================================== */}
        {/* Radar & Status Visualizer Card (If not loaded yet)                 */}
        {/* ================================================================== */}
        {locationState !== 'success' && (
          <Card variant="navy" style={styles.radarCard}>
            <View style={styles.radarVisualContainer}>
              <View style={styles.radarRingOuter} />
              <View style={styles.radarRingMiddle} />
              <View style={styles.radarRingInner} />
              <View style={styles.radarCrosshairH} />
              <View style={styles.radarCrosshairV} />

              {locationState === 'loading' ? (
                <View style={styles.centralBeaconLoading}>
                  <ActivityIndicator size="small" color={Colors.white} />
                </View>
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

            <View style={styles.radarStatusRow}>
              <View
                style={[
                  styles.statusPill,
                  locationState === 'loading'
                    ? styles.statusPillLoading
                    : locationState === 'denied-permission'
                    ? styles.statusPillDenied
                    : styles.statusPillIdle,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    locationState === 'loading'
                      ? { backgroundColor: Colors.info }
                      : locationState === 'denied-permission'
                      ? { backgroundColor: Colors.warning }
                      : { backgroundColor: Colors.slate400 },
                  ]}
                />
                <Text style={styles.statusPillText}>
                  {locationState === 'loading'
                    ? 'SEARCHING SATELLITES...'
                    : locationState === 'denied-permission'
                    ? 'PERMISSION REQUIRED'
                    : locationState === 'unavailable'
                    ? 'GPS UNAVAILABLE'
                    : 'STANDBY • READY'}
                </Text>
              </View>

              <Text style={styles.precisionText}>Device sensor telemetry</Text>
            </View>
          </Card>
        )}

        {/* STATE: IDLE */}
        {locationState === 'idle' && (
          <View style={styles.stateContainer}>
            <Card variant="white" style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="navigate-circle" size={26} color={Colors.emergency.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoCardTitle}>Discover Nearest Police & Hospitals</Text>
                  <Text style={styles.infoCardSubtitle}>
                    Capture your live GPS coordinates to find nearby police stations and hospitals with in-app route previews and turn-by-turn navigation.
                  </Text>
                </View>
              </View>

              <View style={styles.noticeList}>
                <View style={styles.noticeItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.noticeItemText}>Free OpenStreetMap discovery (No API keys)</Text>
                </View>
                <View style={styles.noticeItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.noticeItemText}>Live walking & driving route geometry preview</Text>
                </View>
                <View style={styles.noticeItem}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.noticeItemText}>One-tap native Google & Apple Maps navigation</Text>
                </View>
              </View>
            </Card>

            <Button
              title="Acquire Location & Discover Services"
              variant="danger"
              size="lg"
              onPress={handleCheckLocation}
              icon={<Ionicons name="navigate" size={20} color={Colors.white} />}
              style={styles.mainActionButton}
            />
          </View>
        )}

        {/* STATE: LOADING */}
        {locationState === 'loading' && (
          <Card variant="white" style={styles.loadingCard}>
            <ActivityIndicator size="large" color={Colors.emergency.primary} style={styles.loadingSpinner} />
            <Text style={styles.loadingTitle}>Acquiring Device GPS Fix...</Text>
            <Text style={styles.loadingSubtitle}>
              Connecting to device satellite sensors. Once locked, nearby police stations and hospitals will load automatically.
            </Text>
          </Card>
        )}

        {/* STATE: DENIED PERMISSION */}
        {locationState === 'denied-permission' && (
          <Card variant="white" style={styles.errorCard}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="lock-closed" size={28} color={Colors.warning} />
            </View>
            <Text style={styles.errorTitle}>Foreground Permission Denied</Text>
            <Text style={styles.errorSubtitle}>
              {statusMessage ||
                'EmergencySOS was not granted location permission. To discover nearby police and hospitals, please allow location access.'}
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

        {/* STATE: UNAVAILABLE */}
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
      </ScrollView>

      {/* Permission Modal */}
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
                    <Ionicons name="shield-checkmark-outline" size={22} color={Colors.navy[500]} />
                    <View style={styles.explanationTextCol}>
                      <Text style={styles.explanationItemTitle}>Discover Nearby Safe Havens</Text>
                      <Text style={styles.explanationItemDesc}>
                        Find verified police stations and emergency trauma centers closest to your coordinates.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.explanationItem}>
                    <Ionicons name="navigate-outline" size={22} color={Colors.navy[500]} />
                    <View style={styles.explanationTextCol}>
                      <Text style={styles.explanationItemTitle}>Turn-by-Turn Routing</Text>
                      <Text style={styles.explanationItemDesc}>
                        Preview escape and transit routes with direct handoff to Google / Apple Maps.
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalActionsCol}>
                  <Button
                    title="Allow Location Access"
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
    paddingTop: 8,
    paddingBottom: 110,
  },

  // Map & Discovery Section
  mapSectionContainer: {
    marginBottom: 20,
  },
  liveSosBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.emergency.primary,
  },
  liveSosBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  liveSosPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.emergency.primary,
  },
  liveSosBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.emergency.light,
    letterSpacing: 0.8,
  },
  liveSosStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveSosStatsText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  liveSosSubText: {
    fontSize: 11,
    color: Colors.slate400,
  },
  liveTrackingPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  liveTrackingPillText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  filterChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: Colors.emergency.primary,
    borderColor: Colors.emergency.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate400,
  },
  filterChipTextActive: {
    color: Colors.white,
  },

  mapWrapper: {
    width: '100%',
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.navy[700],
  },
  mapCanvas: {
    width: '100%',
    height: '100%',
  },
  customMarkerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  policeMarker: {
    backgroundColor: '#1D4ED8',
  },
  hospitalMarker: {
    backgroundColor: '#DC2626',
  },
  markerCircleSelected: {
    borderColor: '#FEF08A',
    transform: [{ scale: 1.25 }],
  },
  routeLoadingPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  routeLoadingText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },

  webMapFallbackCard: {
    padding: 18,
    marginBottom: 14,
  },
  webMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  webMapTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
  },
  webMapSubtitle: {
    fontSize: 12,
    color: Colors.slate400,
    marginTop: 2,
  },
  webMapDesc: {
    fontSize: 12,
    color: Colors.slate400,
    lineHeight: 18,
  },

  // Selected Facility Card
  selectedFacilityCard: {
    padding: 16,
    marginBottom: 16,
  },
  facilityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  facilityIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policeIconBadge: {
    backgroundColor: '#1D4ED8',
  },
  hospitalIconBadge: {
    backgroundColor: '#DC2626',
  },
  facilityCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  facilityDistanceText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.emergency.primary,
  },
  facilityTitleText: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.navy[900],
    lineHeight: 22,
  },
  facilityAddressText: {
    fontSize: 12,
    color: Colors.slate600,
    marginTop: 2,
  },

  // Route Metrics
  routeMetricsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.slate50,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.slate200,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  routeMetricItem: {
    alignItems: 'center',
    flex: 1,
  },
  routeMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.slate200,
  },
  routeMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.5,
    marginTop: 3,
  },
  routeMetricValue: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.navy[900],
    marginTop: 2,
  },
  navButton: {
    width: '100%',
  },

  // Discovered Facilities List
  facilitiesListSection: {
    marginTop: 4,
  },
  facilitiesSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  emptyServicesCard: {
    backgroundColor: Colors.navy[800],
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.navy[700],
    marginBottom: 12,
  },
  emptyServicesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 10,
    textAlign: 'center',
  },
  emptyServicesSubtitle: {
    fontSize: 12,
    color: Colors.slate400,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  retryServicesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.emergency.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 14,
    gap: 6,
  },
  retryServicesBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  facilityListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[800],
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  facilityListItemSelected: {
    borderColor: Colors.emergency.primary,
    backgroundColor: Colors.navy[700],
  },
  itemTypeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policeTypeBadge: {
    backgroundColor: '#1D4ED8',
  },
  hospitalTypeBadge: {
    backgroundColor: '#DC2626',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  itemSubtitle: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 2,
  },
  itemDistanceBox: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  itemDistanceNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.emergency.light,
  },
  itemDistanceUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate400,
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
  centralBeacon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centralBeaconLoading: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centralBeaconIdle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.navy[800],
    borderWidth: 1.5,
    borderColor: Colors.navy[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillLoading: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  statusPillDenied: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusPillIdle: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.6,
  },
  precisionText: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '600',
  },

  // State Card Views
  stateContainer: {
    marginTop: 4,
  },
  infoCard: {
    padding: 18,
    marginBottom: 16,
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
    marginTop: 4,
    lineHeight: 18,
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
    marginLeft: 8,
    fontWeight: '600',
  },
  mainActionButton: {
    width: '100%',
  },

  loadingCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingSpinner: {
    marginBottom: 14,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy[900],
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 12,
    color: Colors.slate600,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  errorCard: {
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.navy[900],
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 12,
    color: Colors.slate600,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  errorActions: {
    width: '100%',
    marginTop: 18,
    gap: 10,
  },
  errorBtn: {
    width: '100%',
  },

  // Modal
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