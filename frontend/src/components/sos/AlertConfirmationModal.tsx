import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Ionicons } from '@expo/vector-icons';
import { EmergencyHistoryItem } from '../../types';

interface AlertConfirmationModalProps {
  visible: boolean;
  alertRecord: EmergencyHistoryItem | null;
  contactsCount: number;
  onViewHistory: () => void;
  onDismiss: () => void;
}

export const AlertConfirmationModal: React.FC<AlertConfirmationModalProps> = ({
  visible,
  alertRecord,
  contactsCount,
  onViewHistory,
  onDismiss,
}) => {
  if (!alertRecord) return null;

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    } catch {
      return isoString;
    }
  };

  const hasLocation =
    alertRecord.location_address && alertRecord.location_address !== 'Location unavailable';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={styles.card}
              accessible={true}
              accessibilityRole="alert"
              accessibilityLabel="Emergency Demo Alert Confirmation"
            >
              {/* Top Success Badge */}
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark" size={44} color={Colors.white} />
              </View>

              <Text style={styles.title}>
                {alertRecord.alert_id ? "EMERGENCY ALERT BROADCASTED" : "DEMO ALERT CREATED"}
              </Text>
              <Text style={styles.subtitle}>
                {alertRecord.alert_id
                  ? `Successfully transmitted to FastAPI backend server (Alert ID #${alertRecord.alert_id}).`
                  : "Simulated emergency event successfully recorded on this device."}
              </Text>

              {/* Alert Meta Details Card */}
              <View style={styles.detailsCard}>
                {/* Alert ID & Status */}
                <View style={styles.detailRow}>
                  <View style={styles.labelCol}>
                    <Text style={styles.detailLabel}>INCIDENT ID</Text>
                    <Text style={styles.detailValueBold}>
                      {alertRecord.alert_id ? `#${alertRecord.alert_id} • ${alertRecord.id}` : alertRecord.id}
                    </Text>
                  </View>
                  <Badge
                    label={alertRecord.alert_id ? "BACKEND ACTIVE" : "DEMO ALERT"}
                    variant={alertRecord.alert_id ? "success" : "danger"}
                  />
                </View>

                <View style={styles.divider} />

                {/* Timestamp */}
                <View style={styles.detailRow}>
                  <View style={styles.iconBox}>
                    <Ionicons name="time-outline" size={16} color={Colors.slate400} />
                  </View>
                  <View style={styles.labelCol}>
                    <Text style={styles.detailLabel}>TIMESTAMP</Text>
                    <Text style={styles.detailValue}>{formatTimestamp(alertRecord.timestamp)}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Coordinates & Location */}
                <View style={styles.detailRow}>
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={hasLocation ? 'location' : 'location-outline'}
                      size={16}
                      color={hasLocation ? Colors.emergency.primary : Colors.slate400}
                    />
                  </View>
                  <View style={styles.labelCol}>
                    <Text style={styles.detailLabel}>DEVICE LOCATION CAPTURE</Text>
                    <Text style={styles.detailValue} numberOfLines={2}>
                      {alertRecord.location_address || 'Location unavailable'}
                    </Text>
                    {alertRecord.accuracy != null && (
                      <Text style={styles.accuracyText}>
                        Sensor Accuracy: ±{alertRecord.accuracy.toFixed(1)}m
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.divider} />

                {/* Contacts Notified Summary */}
                <View style={styles.detailRow}>
                  <View style={styles.iconBox}>
                    <Ionicons name="people-outline" size={16} color={Colors.slate400} />
                  </View>
                  <View style={styles.labelCol}>
                    <Text style={styles.detailLabel}>SIMULATED DISPATCH</Text>
                    <Text style={styles.detailValue}>
                      {contactsCount > 0
                        ? `${contactsCount} local emergency contact${contactsCount === 1 ? '' : 's'} staged`
                        : 'No saved contacts (Staged in standby)'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Safety Demonstration Notice */}
              <View style={styles.noticeBox}>
                <Ionicons name="information-circle" size={18} color={Colors.warning} />
                <Text style={styles.noticeText}>
                  Demo Mode Active: No real SMS messages, phone calls, or external alerts were dispatched to emergency services or contacts.
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.actionsCol}>
                <Button
                  title="View Incident in Alert History"
                  variant="danger"
                  size="lg"
                  onPress={onViewHistory}
                  icon={<Ionicons name="time" size={18} color={Colors.white} />}
                  accessibilityLabel="View Incident in Alert History"
                  style={styles.actionBtn}
                />

                <Button
                  title="Return to Standby Mode"
                  variant="outline"
                  size="md"
                  onPress={onDismiss}
                  textStyle={{ color: Colors.white }}
                  accessibilityLabel="Return to Standby Mode"
                  style={styles.actionBtn}
                />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 20, 0.92)',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.navy[900],
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.slate400,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: Colors.navy[800],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.navy[700],
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  labelCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '600',
  },
  detailValueBold: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '800',
  },
  accuracyText: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.navy[700],
    marginVertical: 12,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: '100%',
  },
  noticeText: {
    fontSize: 11,
    color: Colors.slate200,
    lineHeight: 16,
    marginLeft: 8,
    flex: 1,
  },
  actionsCol: {
    width: '100%',
  },
  actionBtn: {
    marginBottom: 10,
    width: '100%',
  },
});
