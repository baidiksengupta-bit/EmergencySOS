import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../../constants/Colors';

export type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'outline' | 'ghost' | 'navy';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: any;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'navy',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  accessible = true,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'danger':
        return styles.btnDanger;
      case 'primary':
      case 'navy':
        return styles.btnNavy;
      case 'secondary':
        return styles.btnSecondary;
      case 'outline':
        return styles.btnOutline;
      case 'ghost':
        return styles.btnGhost;
      default:
        return styles.btnNavy;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return styles.textOutline;
      case 'ghost':
        return styles.textGhost;
      case 'secondary':
        return styles.textSecondary;
      default:
        return styles.textWhite;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      default:
        return styles.sizeMd;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        disabled && styles.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? Colors.navy[900] : Colors.white}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={[styles.textBase, getTextStyle(), textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: 8,
  },
  textBase: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Sizes
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  sizeMd: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  sizeLg: {
    paddingVertical: 18,
    paddingHorizontal: 28,
  },
  // Variants
  btnNavy: {
    backgroundColor: Colors.navy[900],
    borderWidth: 1,
    borderColor: Colors.navy[800],
  },
  btnDanger: {
    backgroundColor: Colors.emergency.primary,
  },
  btnSecondary: {
    backgroundColor: Colors.navy[600],
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.navy[900],
  },
  btnGhost: {
    backgroundColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  // Text Colors
  textWhite: {
    color: Colors.white,
    fontSize: 15,
  },
  textOutline: {
    color: Colors.navy[900],
    fontSize: 15,
  },
  textGhost: {
    color: Colors.navy[700],
    fontSize: 15,
  },
  textSecondary: {
    color: Colors.white,
    fontSize: 15,
  },
});
