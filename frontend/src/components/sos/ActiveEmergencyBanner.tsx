import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { SOSAlert } from '../../types';

interface ActiveEmergencyBannerProps {
  alert: SOSAlert;
  onCancel: () => void;
  onShareMaps: () => void;
}

export const ActiveEmergencyBanner: React.FC<ActiveEmergencyBannerProps> = ({
  alert,
  onCancel,
  onShareMaps,
}) => {
  const formatTimer = (totalSeconds: number = 0) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isConfirmed = alert.delivery_report?.delivery_status === 'ACCEPTED';
  const isOffline = alert.notification_status === 'OFFLINE';

  const getStatusBadge = () => {
    if (isConfirmed) {
      return { text: 'PROVIDER CONFIRMED', bg: 'rgba(16, 185, 129, 0.25)', border: '#10B981' };
    }
    if (isOffline) {
      return { text: 'OFFLINE (SMS READY)', bg: 'rgba(245, 158, 11, 0.25)', border: '#F59E0B' };
    }
    return { text: 'DELIVERY UNCONFIRMED', bg: 'rgba(239, 68, 68, 0.3)', border: '#EF4444' };
  };

  const badge = getStatusBadge();

  return (
    <View style={styles.banner}>
      {/* Top Header Row */}
      <View style={styles.topRow}>
        <View style={styles.leftTitleGroup}>
          <View style={styles.pulseBeacon} />
          <Text style={styles.title}>EMERGENCY ALERT #{alert.id} ACTIVE</Text>
        </View>

        <View style={styles.timerBadge}>
          <Ionicons name="time" size={13} color={Colors.white} />
          <Text style={styles.timerText}>{formatTimer(alert.elapsed_seconds || 0)}</Text>
        </View>
      </View>

      {/* Middle Status & Telemetry Row */}
      <View style={styles.midRow}>
        <Text style={styles.addressText} numberOfLines={1}>
          📍 {alert.address || 'Real-time GPS Fix'} (±{alert.accuracy ? alert.accuracy.toFixed(0) : '5'}m)
        </Text>
        <Text style={styles.breadcrumbText}>
          📡 {alert.breadcrumbs_count || 1} telemetry updates sent
        </Text>
      </View>

      {/* Strict Delivery Status Indicator */}
      <View style={[styles.deliveryIndicator, { backgroundColor: badge.bg, borderColor: badge.border }]}>
        <Ionicons
          name={isConfirmed ? 'checkmark-circle' : 'alert-circle'}
          size={14}
          color={badge.border}
        />
        <Text style={[styles.deliveryText, { color: Colors.white }]}>
          {badge.text} • {alert.delivery_report?.details || 'Push broadcast active'}
        </Text>
      </View>

      {/* Action Buttons Row */}
      <View style={styles.actionsRow}>
        <TouchableOpacity activeOpacity={0.8} style={styles.shareBtn} onPress={onShareMaps}>
          <Ionicons name="map" size={14} color={Colors.navy[900]} />
          <Text style={styles.shareBtnText}>Share Google Maps Link</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} style={styles.cancelBtn} onPress={onCancel}>
          <Ionicons name="close-circle" size={15} color={Colors.white} />
          <Text style={styles.cancelBtnText}>STAND DOWN / CANCEL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.navy[900],
    borderBottomWidth: 3,
    borderBottomColor: Colors.emergency.primary,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulseBeacon: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.emergency.primary,
    marginRight: 8,
  },
  title: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  timerText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginLeft: 4,
  },
  midRow: {
    marginVertical: 6,
  },
  addressText: {
    color: Colors.slate200,
    fontSize: 12,
    fontWeight: '600',
  },
  breadcrumbText: {
    color: Colors.slate400,
    fontSize: 11,
    marginTop: 2,
  },
  deliveryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginVertical: 6,
  },
  deliveryText: {
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.3,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  shareBtnText: {
    color: Colors.navy[900],
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
  },
  cancelBtn: {
    backgroundColor: Colors.emergency.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
});
