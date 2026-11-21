import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../src/constants/Colors';
import { Button } from '../src/components/common/Button';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const completeOnboardingAndNavigate = async (targetRoute: string = '/(tabs)/home') => {
    try {
      await AsyncStorage.setItem('@emergencysos_onboarded', 'true');
    } catch (e) {
      console.warn('Failed to save onboarded status:', e);
    }
    router.replace(targetRoute as any);
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Header Branding */}
        <View style={styles.brandRow}>
          <View style={styles.logoBadge} accessible={true} accessibilityLabel="EmergencySOS Logo">
            <Ionicons name="shield-checkmark" size={24} color={Colors.white} />
          </View>
          <View style={styles.brandCol}>
            <Text style={styles.brandName}>
              Emergency<Text style={styles.brandHighlight}>SOS</Text>
            </Text>
            <Text style={styles.brandTagline}>Offline-First Safety Demo</Text>
          </View>
        </View>

        {/* Hero Visual Card */}
        <View style={styles.heroCard}>
          <View style={styles.pulseContainer}>
            <View style={styles.pulseOuter} />
            <View style={styles.pulseMiddle} />
            <View style={styles.heroIconCircle}>
              <Ionicons name="alert-circle" size={54} color={Colors.white} />
            </View>
          </View>

          <View style={styles.heroStatusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusPillText}>STANDALONE UI DEMONSTRATION</Text>
          </View>
        </View>

        {/* Headline & Value Proposition */}
        <View style={styles.textSection}>
          <Text style={styles.headline}>Your Safety, One Tap Away</Text>
          <Text style={styles.subheadline}>
            A complete mobile emergency interface designed for critical situations, featuring instantaneous panic triggers and local readiness tracking.
          </Text>
        </View>

        {/* Essential Safety Notice Banner */}
        <View style={styles.noticeCard} accessible={true} accessibilityRole="alert">
          <View style={styles.noticeIconCircle}>
            <Ionicons name="information-circle" size={24} color={Colors.warning} />
          </View>
          <View style={styles.noticeTextCol}>
            <Text style={styles.noticeTitle}>IMPORTANT SAFETY DEMO NOTICE</Text>
            <Text style={styles.noticeBody}>
              This application is currently a <Text style={styles.boldText}>device-only UI demo</Text>. It does <Text style={styles.boldText}>NOT</Text> dial emergency helplines (112 / Police: 100), contact real emergency services, send SMS broadcasts, place calls, or track location in the background.
            </Text>
          </View>
        </View>

        {/* Four-Pillar Emergency Plan Overview */}
        <View style={styles.sectionHeader}>
          <Ionicons name="clipboard-outline" size={18} color={Colors.slate400} />
          <Text style={styles.sectionHeaderText}>LOCAL EMERGENCY PLAN ARCHITECTURE</Text>
        </View>

        <View style={styles.featuresList}>
          {/* Item 1 */}
          <View style={styles.featureItem}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(220, 38, 38, 0.15)' }]}>
              <Ionicons name="radio" size={20} color={Colors.emergency.primary} />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>5-Second SOS Countdown</Text>
              <Text style={styles.featureDesc}>
                Centerpiece panic button with full false-alarm abort window, haptic vibration, and safe demo alerts.
              </Text>
            </View>
          </View>

          {/* Item 2 */}
          <View style={styles.featureItem}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(3, 64, 120, 0.2)' }]}>
              <Ionicons name="navigate" size={20} color={Colors.info} />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Private GPS Radar</Text>
              <Text style={styles.featureDesc}>
                Foreground-only sensor telemetry. Coordinates stay 100% on this phone with zero cloud transmission.
              </Text>
            </View>
          </View>

          {/* Item 3 */}
          <View style={styles.featureItem}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(13, 59, 102, 0.25)' }]}>
              <Ionicons name="people" size={20} color={Colors.white} />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Offline Emergency Contacts</Text>
              <Text style={styles.featureDesc}>
                Store trusted family members and physicians privately in device storage without address book scraping.
              </Text>
            </View>
          </View>

          {/* Item 4 */}
          <View style={styles.featureItem}>
            <View style={[styles.featureIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Readiness Checklist & Plan</Text>
              <Text style={styles.featureDesc}>
                Tracks profile, contacts, location permission, and countdown duration with real-time readiness indicators.
              </Text>
            </View>
          </View>
        </View>

        {/* Call to Action Buttons */}
        <View style={styles.ctaGroup}>
          <Button
            title="Get Started (Enter Demo App)"
            variant="danger"
            size="lg"
            onPress={() => completeOnboardingAndNavigate('/(tabs)/home')}
            icon={<Ionicons name="arrow-forward" size={20} color={Colors.white} />}
            accessibilityLabel="Get Started and Enter Demo App"
            style={styles.mainBtn}
          />

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.skipBtn}
            onPress={() => completeOnboardingAndNavigate('/(tabs)/home')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Skip to Home Dashboard"
          >
            <Text style={styles.skipBtnText}>
              Skip Setup & Go to SOS Dashboard <Ionicons name="chevron-forward" size={13} color={Colors.navy[500]} />
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy[900],
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    alignItems: 'center',
  },

  // Branding
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  brandCol: {
    flex: 1,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  brandHighlight: {
    color: Colors.emergency.primary,
  },
  brandTagline: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.slate400,
    letterSpacing: 0.5,
  },

  // Hero Card
  heroCard: {
    width: '100%',
    backgroundColor: Colors.navy[800],
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.navy[700],
    marginBottom: 20,
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    width: 120,
    height: 120,
  },
  pulseOuter: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  pulseMiddle: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
  },
  heroIconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: Colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.emergency.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 6,
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 17, 40, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate200,
    letterSpacing: 1,
  },

  // Headline
  textSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  headline: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subheadline: {
    fontSize: 13,
    color: Colors.slate400,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Notice Banner
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    width: '100%',
  },
  noticeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.warning,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 12,
    color: Colors.slate200,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '800',
    color: Colors.white,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 1,
    marginLeft: 6,
  },

  // Features List
  featuresList: {
    width: '100%',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[800],
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  featureIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 12,
    color: Colors.slate400,
    lineHeight: 17,
  },

  // CTA Buttons
  ctaGroup: {
    width: '100%',
    alignItems: 'center',
  },
  mainBtn: {
    width: '100%',
    marginBottom: 12,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.slate400,
  },
});
