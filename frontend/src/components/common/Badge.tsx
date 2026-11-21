import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Colors } from '../../constants/Colors';

interface BadgeProps {
  label: string;
  variant?: 'danger' | 'success' | 'warning' | 'info' | 'navy';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'navy',
  style,
  textStyle,
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'danger':
        return {
          bg: 'rgba(220, 38, 38, 0.15)',
          border: 'rgba(220, 38, 38, 0.35)',
          text: Colors.emergency.light,
        };
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.35)',
          text: Colors.success,
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.4)',
          text: Colors.warning,
        };
      case 'info':
        return {
          bg: 'rgba(2, 132, 199, 0.15)',
          border: 'rgba(2, 132, 199, 0.35)',
          text: '#38BDF8',
        };
      case 'navy':
      default:
        return {
          bg: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.15)',
          text: Colors.slate200,
        };
    }
  };

  const styleObj = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: styleObj.bg,
          borderColor: styleObj.border,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: styleObj.text }, textStyle]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
