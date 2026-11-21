import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface SOSButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  isActive?: boolean;
  isCountingDown?: boolean;
  countdownValue?: number;
}

export const SOSButton: React.FC<SOSButtonProps> = ({
  onPress,
  isLoading = false,
  isActive = false,
  isCountingDown = false,
  countdownValue = 5,
}) => {
  return (
    <View style={styles.outerContainer}>
      {/* Outer Pulse Ring 1 */}
      <View
        style={[
          styles.pulseRingOuter,
          isActive && styles.pulseRingOuterActive,
        ]}
      />

      {/* Middle Pulse Ring 2 */}
      <View
        style={[
          styles.pulseRingMiddle,
          isActive && styles.pulseRingMiddleActive,
        ]}
      />

      {/* Main Touchable Button */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        disabled={isLoading}
        style={[
          styles.button,
          isActive ? styles.buttonActive : styles.buttonNormal,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color={Colors.white} />
        ) : isCountingDown ? (
          <View style={styles.centerCol}>
            <Text style={styles.countdownNumber}>{countdownValue}</Text>
            <Text style={styles.countdownLabel}>CANCEL IN</Text>
          </View>
        ) : isActive ? (
          <View style={styles.centerCol}>
            <Ionicons name="radio" size={40} color={Colors.white} />
            <Text style={styles.activeText}>ACTIVE</Text>
            <Text style={styles.subText}>BROADCASTING</Text>
          </View>
        ) : (
          <View style={styles.centerCol}>
            <Ionicons name="alert-circle" size={42} color={Colors.white} />
            <Text style={styles.sosText}>SOS</Text>
            <Text style={styles.subText}>TAP TO ACTIVATE</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 12,
  },
  pulseRingOuter: {
    position: 'absolute',
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  pulseRingOuterActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.22)',
  },
  pulseRingMiddle: {
    position: 'absolute',
    width: 236,
    height: 236,
    borderRadius: 118,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
  },
  pulseRingMiddleActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.35)',
  },
  button: {
    width: 195,
    height: 195,
    borderRadius: 97.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  buttonNormal: {
    backgroundColor: Colors.emergency.primary,
  },
  buttonActive: {
    backgroundColor: Colors.emergency.dark,
  },
  centerCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 2,
    lineHeight: 46,
    marginTop: 2,
  },
  activeText: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  countdownNumber: {
    fontSize: 58,
    fontWeight: '900',
    color: Colors.white,
    lineHeight: 64,
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 1.2,
  },
  subText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 1,
    marginTop: 2,
  },
});
