import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface CountdownModalProps {
  visible: boolean;
  countdown: number;
  onCancel: () => void;
  onInstantTrigger: () => void;
}

export const CountdownModal: React.FC<CountdownModalProps> = ({
  visible,
  countdown,
  onCancel,
  onInstantTrigger,
}) => {
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
              accessibilityLabel={`Emergency SOS Initiated. Countdown: ${countdown} seconds`}
            >
              <View style={styles.header}>
                <Ionicons name="warning" size={30} color={Colors.emergency.primary} />
                <Text style={styles.title}>EMERGENCY SOS INITIATED</Text>
              </View>

              <Text style={styles.subtitle}>
                Preparing emergency broadcast in:
              </Text>

              {/* Big Glowing Countdown Circle */}
              <View
                style={styles.counterCircle}
                accessible={true}
                accessibilityLabel={`${countdown} seconds remaining`}
              >
                <Text style={styles.counterText}>{countdown}</Text>
                <Text style={styles.secondsLabel}>SECONDS</Text>
              </View>

              {/* UI Demonstration Mode Notice */}
              <View style={styles.demoNoticeBox}>
                <Ionicons name="information-circle" size={16} color={Colors.navy[500]} />
                <Text style={styles.demoNoticeText}>
                  UI Demonstration Mode: No real SMS, phone calls, or external alerts will be dispatched.
                </Text>
              </View>

              <View style={styles.actionCol}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel False Alarm"
                  accessibilityHint="Stops countdown and returns to standby"
                >
                  <Ionicons name="close-circle" size={22} color={Colors.white} />
                  <Text style={styles.cancelBtnText}>CANCEL (FALSE ALARM)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.instantBtn}
                  onPress={onInstantTrigger}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Trigger UI Demo Now"
                  accessibilityHint="Skips the remaining countdown and records demo alert immediately"
                >
                  <Text style={styles.instantBtnText}>Trigger UI Demo Now (Skip Timer)</Text>
                </TouchableOpacity>
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
    backgroundColor: 'rgba(10, 17, 40, 0.94)',
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
    maxWidth: 380,
    backgroundColor: Colors.navy[900],
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.emergency.primary,
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.emergency.light,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.slate400,
    textAlign: 'center',
    marginVertical: 8,
    lineHeight: 18,
  },
  counterCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 5,
    borderColor: Colors.emergency.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 14,
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  counterText: {
    fontSize: 62,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 68,
  },
  secondsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.emergency.light,
    letterSpacing: 1.5,
  },
  demoNoticeBox: {
    flexDirection: 'row',
    backgroundColor: Colors.navy[800],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  demoNoticeText: {
    color: Colors.slate400,
    fontSize: 11,
    marginLeft: 6,
    flex: 1,
    lineHeight: 15,
  },
  actionCol: {
    width: '100%',
    marginTop: 8,
  },
  cancelBtn: {
    backgroundColor: Colors.emergency.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 10,
  },
  cancelBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  instantBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  instantBtnText: {
    color: Colors.slate400,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
