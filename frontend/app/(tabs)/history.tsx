import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/Colors';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Button } from '../../src/components/common/Button';
import { useSOS } from '../../src/context/SOSContext';
import { EmergencyHistoryItem } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
  const { history, clearHistory } = useSOS();

  // Show all records newest first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Header
        title="Alert History"
        subtitle={
          history.length === 0
            ? 'No Demo Records'
            : `${history.length} Demo Alert Record${history.length === 1 ? '' : 's'} Logged`
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
        {/* Device-Only Privacy Notice */}
        <View style={styles.privacyBanner}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
          <View style={styles.privacyTextCol}>
            <Text style={styles.privacyBannerTitle}>LOCAL DEMO LOG ONLY</Text>
            <Text style={styles.privacyBannerSub}>
              Alert records are generated for UI demonstration and stored locally on this phone. No emergency services were contacted.
            </Text>
          </View>
        </View>

        <FlatList
          data={sortedHistory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            sortedHistory.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const hasLocation =
              item.location_address &&
              item.location_address !== 'Location unavailable';

            return (
              <Card
                variant="navy"
                style={styles.alertCard}
                accessible={true}
                accessibilityLabel={`Demo Alert ${item.id}, ${formatDateTime(item.timestamp)}, status Demo Alert, location: ${item.location_address || 'unavailable'}`}
              >
                {/* Header Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.alertIdBadge}>
                    <Ionicons name="shield" size={16} color={Colors.emergency.primary} />
                    <Text style={styles.alertIdText}>{item.id}</Text>
                  </View>
                  <Badge label="Demo Alert" variant="danger" />
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
                    <Text style={styles.locationLabel}>COORDINATES / FIX</Text>
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
                </View>

                {/* Accuracy details if available */}
                {item.accuracy != null && (
                  <View style={styles.accuracyRow}>
                    <Ionicons name="scan-outline" size={13} color={Colors.slate400} />
                    <Text style={styles.accuracyText}>
                      Sensor precision: ±{item.accuracy.toFixed(1)}m
                    </Text>
                  </View>
                )}

                {/* Demo Notice Footer */}
                <View style={styles.cardFooter}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.navy[500]} />
                  <Text style={styles.cardFooterText}>
                    {item.notes || 'UI Demonstration Mode • Standalone local record'}
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
              <Text style={styles.emptyTitle}>No Alert History</Text>
              <Text style={styles.emptySubtitle}>
                Local demo alert records will appear here whenever you trigger an emergency from the SOS Panic button.
              </Text>
              <View style={styles.emptyNoticePill}>
                <Ionicons name="lock-closed" size={14} color={Colors.slate400} />
                <Text style={styles.emptyNoticeText}>
                  Stored 100% on this device
                </Text>
              </View>
            </View>
          }
          ListFooterComponent={
            sortedHistory.length > 0 ? (
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

  // Privacy Banner
  privacyBanner: {
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

  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  accuracyText: {
    fontSize: 11,
    color: Colors.slate400,
    marginLeft: 6,
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
