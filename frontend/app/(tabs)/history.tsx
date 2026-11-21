import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '../../src/constants/Colors';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { useSOS } from '../../src/context/SOSContext';
import { AlertStatus, EmergencyHistoryItem } from '../../src/types';
import { apiService } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';

type StatusFilterOption = 'ALL' | AlertStatus;

const FILTER_OPTIONS: { label: string; value: StatusFilterOption }[] = [
  { label: 'All Incidents', value: 'ALL' },
  { label: 'Triggered', value: 'TRIGGERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Resolved', value: 'RESOLVED' },
];

export default function HistoryScreen() {
  const { history, clearHistory, refreshHistory, themeColors } = useSOS();

  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<StatusFilterOption>('ALL');

  // Load backend history records and merge with local records
  const loadHistory = async (showLoading = false, filter?: StatusFilterOption) => {
    if (showLoading) setIsLoading(true);
    const activeFilter = filter !== undefined ? filter : selectedFilter;
    const queryFilter: AlertStatus | undefined = activeFilter === 'ALL' ? undefined : activeFilter;

    try {
      // Direct health / getHistory check to update backend connectivity state
      const backendAlerts = await apiService.getHistory({ status_filter: queryFilter });
      if (Array.isArray(backendAlerts)) {
        setBackendStatus('connected');
      }
      await refreshHistory(queryFilter);
    } catch (err) {
      console.warn('Backend history unreachable, using local demo records:', err);
      setBackendStatus('offline');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory(false, selectedFilter);
    }, [selectedFilter])
  );

  useEffect(() => {
    loadHistory(true, selectedFilter);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHistory(false, selectedFilter);
  };

  const handleFilterSelect = (opt: StatusFilterOption) => {
    setSelectedFilter(opt);
    loadHistory(false, opt);
  };

  // Filter and sort display list
  const displayHistory = history
    .filter((item) => {
      if (selectedFilter === 'ALL') return true;
      return item.status?.toUpperCase() === selectedFilter.toUpperCase();
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const confirmClearHistory = () => {
    Alert.alert(
      'Clear Alert History?',
      'Are you sure you want to clear all local demo alert records from this device? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
          },
        },
      ]
    );
  };

  const getStatusBadgeVariant = (status?: string): 'danger' | 'warning' | 'success' | 'info' => {
    switch (status?.toUpperCase()) {
      case 'TRIGGERED':
        return 'danger';
      case 'RESOLVED':
        return 'success';
      case 'CANCELLED':
        return 'warning';
      case 'ACKNOWLEDGED':
        return 'info';
      default:
        return 'danger';
    }
  };

  const formatDateTime = (timestamp: string): string => {
    try {
      const d = new Date(timestamp);
      const timeStr = d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dateStr = d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${dateStr} at ${timeStr}`;
    } catch {
      return timestamp;
    }
  };

  const openGoogleMaps = (url?: string, lat?: number | null, lon?: number | null) => {
    const targetUrl = url || (lat != null && lon != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : null);
    if (targetUrl) {
      Linking.openURL(targetUrl).catch(() => {
        Alert.alert('Unable to Open Map', 'Could not open the location link on this device.');
      });
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={themeColors.statusBarStyle} />

      <Header
        title="Alert History"
        subtitle={
          displayHistory.length === 0
            ? 'No Incidents Recorded'
            : `${displayHistory.length} Incident${displayHistory.length === 1 ? '' : 's'} ${
                backendStatus === 'connected' ? 'Synced with Backend' : 'Saved on Device'
              }`
        }
        variant="navy"
        rightAction={
          history.length > 0
            ? {
                icon: 'trash-outline',
                onPress: confirmClearHistory,
              }
            : undefined
        }
      />

      <View style={styles.content}>
        {/* Backend Synchronization & Offline Indicator */}
        <View style={[styles.syncStatusBar, { backgroundColor: themeColors.cardNavyBackground, borderColor: themeColors.cardBorder }]}>
          <View style={styles.syncStatusLeft}>
            <View
              style={[
                styles.syncStatusDot,
                backendStatus === 'connected'
                  ? styles.syncDotConnected
                  : backendStatus === 'checking'
                  ? styles.syncDotChecking
                  : styles.syncDotOffline,
              ]}
            />
            <Text style={[styles.syncStatusText, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {backendStatus === 'connected'
                ? 'FastAPI Backend Synced'
                : backendStatus === 'checking'
                ? 'Connecting to Backend...'
                : 'Offline Mode • Showing Local Records'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => loadHistory(true, selectedFilter)}
            style={[styles.syncRefreshBtn, { backgroundColor: themeColors.isDark ? Colors.navy[700] : '#E2E8F0' }]}
            disabled={isLoading || isRefreshing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Refresh alert history from backend"
          >
            {isLoading && !isRefreshing ? (
              <ActivityIndicator size="small" color={themeColors.textPrimary} />
            ) : (
              <View style={styles.syncRefreshRow}>
                <Ionicons
                  name={backendStatus === 'connected' ? 'refresh-outline' : 'cloud-offline-outline'}
                  size={14}
                  color={backendStatus === 'connected' ? themeColors.emergencyPrimary : Colors.warning}
                />
                <Text
                  style={[
                    styles.syncRefreshText,
                    { color: backendStatus === 'connected' ? themeColors.emergencyPrimary : Colors.warning },
                  ]}
                >
                  {backendStatus === 'connected' ? 'Refresh' : 'Retry'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Status Query Filter Chips */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {FILTER_OPTIONS.map((opt) => {
              const isActive = selectedFilter === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => handleFilterSelect(opt.value)}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${opt.label}`}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Privacy Notice Banner */}
        <View style={styles.privacyBanner}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
          <View style={styles.privacyTextCol}>
            <Text style={styles.privacyBannerTitle}>INCIDENT TELEMETRY & AUDIT TRAIL</Text>
            <Text style={styles.privacyBannerSub}>
              Alerts recorded locally and backed by your FastAPI backend service. Real emergency dispatches and live emergency calls (112 / 100) are disabled.
            </Text>
          </View>
        </View>

        {isLoading && !isRefreshing && displayHistory.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.emergency.primary} />
            <Text style={styles.loadingText}>Fetching emergency history from backend...</Text>
          </View>
        ) : (
          <FlatList
            data={displayHistory}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              displayHistory.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.emergency.primary}
                colors={[Colors.emergency.primary]}
              />
            }
            renderItem={({ item }) => {
              const hasLocation =
                item.location_address &&
                item.location_address !== 'Location unavailable';

              return (
                <Card
                  variant="navy"
                  style={styles.alertCard}
                  accessible={true}
                  accessibilityLabel={`Incident Alert ${item.id}, ${formatDateTime(item.timestamp)}, status ${item.status}, location: ${item.location_address || 'unavailable'}`}
                >
                  {/* Header Row */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.alertIdBadge}>
                      <Ionicons name="shield" size={16} color={Colors.emergency.primary} />
                      <Text style={styles.alertIdText}>
                        {item.alert_id ? `ALERT #${item.alert_id}` : item.id}
                      </Text>
                    </View>
                    <Badge
                      label={item.status || 'TRIGGERED'}
                      variant={getStatusBadgeVariant(item.status)}
                    />
                  </View>

                  {/* Date & Time Row */}
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={15} color={Colors.slate400} />
                    <Text style={styles.metaText}>{formatDateTime(item.timestamp)}</Text>
                  </View>

                  {/* Location Row */}
                  <View
                    style={[
                      styles.locationBox,
                      !hasLocation && styles.locationBoxUnavailable,
                    ]}
                  >
                    <Ionicons
                      name={hasLocation ? 'location-sharp' : 'location-outline'}
                      size={16}
                      color={hasLocation ? Colors.emergency.primary : Colors.slate400}
                    />
                    <View style={styles.locationTextCol}>
                      <Text style={styles.locationLabel}>COORDINATES / ADDRESS</Text>
                      <Text
                        style={[
                          styles.locationValue,
                          !hasLocation && styles.locationValueUnavailable,
                        ]}
                        numberOfLines={2}
                      >
                        {item.location_address || 'Location unavailable'}
                      </Text>
                    </View>

                    {item.google_maps_url && (
                      <TouchableOpacity
                        onPress={() => openGoogleMaps(item.google_maps_url, item.latitude, item.longitude)}
                        style={styles.mapActionBtn}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="View location in Google Maps"
                      >
                        <Ionicons name="open-outline" size={16} color={Colors.emergency.light} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Accuracy & Duration Row */}
                  <View style={styles.detailMetaRow}>
                    {item.accuracy != null && (
                      <View style={styles.accuracyPill}>
                        <Ionicons name="scan-outline" size={12} color={Colors.slate400} />
                        <Text style={styles.accuracyText}>
                          Accuracy ±{item.accuracy.toFixed(1)}m
                        </Text>
                      </View>
                    )}
                    {item.duration_minutes != null && (
                      <View style={styles.durationPill}>
                        <Ionicons name="time-outline" size={12} color={Colors.slate400} />
                        <Text style={styles.durationText}>
                          Active: {item.duration_minutes} min
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Demo Notice / Cancellation Reason Footer */}
                  <View style={styles.cardFooter}>
                    <Ionicons name="information-circle-outline" size={14} color={Colors.navy[500]} />
                    <Text style={styles.cardFooterText} numberOfLines={2}>
                      {item.notes || 'Emergency broadcast event recorded.'}
                    </Text>
                  </View>
                </Card>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="time-outline" size={54} color={Colors.slate400} />
                </View>
                <Text style={styles.emptyTitle}>
                  {selectedFilter === 'ALL' ? 'No Alert History' : `No ${selectedFilter} Alerts`}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {selectedFilter === 'ALL'
                    ? 'Alert records will appear here whenever an emergency broadcast is triggered from the SOS button.'
                    : `No incident records matching status filter "${selectedFilter}" were found.`}
                </Text>
                <View style={styles.emptyNoticePill}>
                  <Ionicons name="cloud-done-outline" size={14} color={Colors.slate400} />
                  <Text style={styles.emptyNoticeText}>
                    {backendStatus === 'connected' ? 'FastAPI Backend Synchronized' : 'Device Storage Preserved'}
                  </Text>
                </View>
              </View>
            }
            ListFooterComponent={
              displayHistory.length > 0 ? (
                <Button
                  title="Clear All Alert History"
                  variant="outline"
                  size="md"
                  onPress={confirmClearHistory}
                  icon={<Ionicons name="trash-outline" size={16} color={Colors.emergency.light} />}
                  textStyle={{ color: Colors.emergency.light }}
                  style={styles.clearAllBtn}
                />
              ) : undefined
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy[900],
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Backend Synchronization Status Bar
  syncStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.navy[800],
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navy[700],
    marginBottom: 10,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  syncStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  syncDotConnected: {
    backgroundColor: Colors.success,
  },
  syncDotChecking: {
    backgroundColor: Colors.info,
  },
  syncDotOffline: {
    backgroundColor: Colors.warning,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
    flex: 1,
  },
  syncRefreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.navy[700],
  },
  syncRefreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncRefreshText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.emergency.light,
  },

  // Status Filter Chips
  filterContainer: {
    marginBottom: 10,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
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

  // Privacy Banner
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
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

  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.slate400,
    fontWeight: '600',
  },

  listContent: {
    paddingBottom: 110,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Alert Card
  alertCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  alertIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    marginLeft: 6,
    fontFamily: 'monospace',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaText: {
    fontSize: 12,
    color: Colors.slate400,
    marginLeft: 6,
    fontWeight: '600',
  },

  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.navy[700],
    marginBottom: 10,
  },
  locationBoxUnavailable: {
    borderColor: Colors.navy[700],
    opacity: 0.8,
  },
  locationTextCol: {
    flex: 1,
    marginLeft: 8,
  },
  locationLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 2,
  },
  locationValueUnavailable: {
    color: Colors.slate400,
    fontStyle: 'italic',
  },
  mapActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.navy[800],
    marginLeft: 8,
  },

  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  accuracyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  accuracyText: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '600',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '600',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.navy[700],
  },
  cardFooterText: {
    fontSize: 11,
    color: Colors.slate400,
    marginLeft: 6,
    flex: 1,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.navy[800],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.navy[700],
    marginVertical: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.slate400,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  emptyNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 18,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  emptyNoticeText: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '600',
    marginLeft: 6,
  },

  clearAllBtn: {
    marginTop: 8,
    marginBottom: 16,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    backgroundColor: 'rgba(220, 38, 38, 0.06)',
  },
});
