import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useSOS } from '../../context/SOSContext';

interface CardProps {
  children: React.ReactNode;
  variant?: 'white' | 'navy' | 'emergency';
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: any;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'white',
  style,
  accessible,
  accessibilityLabel,
  accessibilityRole,
}) => {
  const { themeColors } = useSOS();

  const getVariantStyle = () => {
    switch (variant) {
      case 'navy':
        return [
          styles.cardNavy,
          {
            backgroundColor: themeColors.cardNavyBackground,
            borderColor: themeColors.cardBorder,
          },
        ];
      case 'emergency':
        return [
          styles.cardEmergency,
          {
            backgroundColor: themeColors.emergencySurface,
            borderColor: themeColors.emergencyPrimary,
          },
        ];
      default:
        return styles.cardWhite;
    }
  };

  return (
    <View
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[styles.cardBase, getVariantStyle(), style]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: 16,
    padding: 18,
    marginVertical: 6,
  },
  cardWhite: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.slate100,
    shadowColor: Colors.navy[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardNavy: {
    backgroundColor: Colors.navy[900],
    borderWidth: 1,
    borderColor: Colors.navy[800],
    shadowColor: Colors.navy.darkest,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  cardEmergency: {
    backgroundColor: Colors.emergency.surface,
    borderWidth: 1.5,
    borderColor: Colors.emergency.border,
  },
});
