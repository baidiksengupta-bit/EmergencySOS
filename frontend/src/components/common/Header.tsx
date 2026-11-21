import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  variant?: 'navy' | 'white';
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  variant = 'navy',
}) => {
  const isNavy = variant === 'navy';

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)/home');
    }
  };

  return (
    <View style={[styles.container, isNavy ? styles.navyContainer : styles.whiteContainer]}>
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBackPress}
              style={[styles.backBtn, isNavy ? styles.backBtnNavy : styles.backBtnWhite]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              accessibilityHint="Navigates back to the home dashboard"
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={isNavy ? Colors.white : Colors.navy[900]}
              />
            </TouchableOpacity>
          )}
          <View>
            <Text style={[styles.title, isNavy ? styles.titleNavy : styles.titleWhite]}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, isNavy ? styles.subtitleNavy : styles.subtitleWhite]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={[styles.rightBtn, isNavy ? styles.rightBtnNavy : styles.rightBtnWhite]}
          >
            <Ionicons
              name={rightAction.icon}
              size={22}
              color={isNavy ? Colors.white : Colors.navy[900]}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  navyContainer: {
    backgroundColor: Colors.navy[900],
    borderBottomWidth: 1,
    borderBottomColor: Colors.navy[800],
  },
  whiteContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.slate100,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backBtnNavy: {
    backgroundColor: Colors.navy[800],
  },
  backBtnWhite: {
    backgroundColor: Colors.slate100,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  titleNavy: {
    color: Colors.white,
  },
  titleWhite: {
    color: Colors.navy[900],
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  subtitleNavy: {
    color: Colors.slate400,
  },
  subtitleWhite: {
    color: Colors.slate600,
  },
  rightBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightBtnNavy: {
    backgroundColor: Colors.navy[800],
  },
  rightBtnWhite: {
    backgroundColor: Colors.slate100,
  },
});
