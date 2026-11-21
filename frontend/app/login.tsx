import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../src/constants/Colors';
import { Input } from '../src/components/common/Input';
import { Button } from '../src/components/common/Button';
import { useAuth } from '../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { login, continueInDemoMode, isLoading, authError, clearAuthError } = useAuth();

  const [identifier, setIdentifier] = useState('alex.morgan@emergencysos.org');
  const [password, setPassword] = useState('emergency123');
  const [localError, setLocalError] = useState<string | null>(null);

  const activeError = localError || authError;

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setLocalError('Please provide an email or phone number.');
      return;
    }
    if (!password.trim() || password.length < 4) {
      setLocalError('Please provide your account password (at least 4 characters).');
      return;
    }

    setLocalError(null);
    clearAuthError();

    const result = await login(identifier, password);
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      Alert.alert(
        'Authentication Failed',
        result.error || 'Unable to verify credentials. Please try again or continue in Demo Mode.',
        [
          { text: 'Try Again', style: 'cancel' },
          {
            text: 'Continue in Demo Mode',
            onPress: async () => {
              await continueInDemoMode();
              router.replace('/(tabs)');
            },
          },
        ]
      );
    }
  };

  const handleContinueDemo = async () => {
    await continueInDemoMode();
    router.replace('/(tabs)');
  };

  const fillDemoAccount = () => {
    setIdentifier('alex.morgan@emergencysos.org');
    setPassword('EmergencySecret2026');
    setLocalError(null);
    clearAuthError();
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Bar with Back Navigation */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.brandBadge}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.emergency.primary} />
              <Text style={styles.brandBadgeText}>EMERGENCY SOS</Text>
            </View>
          </View>

          {/* Heading */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your emergency broadcast preferences, contacts, and personal medical profile.
            </Text>
          </View>

          {/* Form Card (Crisp White Card on Navy Base) */}
          <View style={styles.formCard}>
            {activeError && (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={18} color={Colors.emergency.primary} />
                <Text style={styles.errorAlertText}>{activeError}</Text>
              </View>
            )}

            <Input
              label="Email or Phone Number"
              placeholder="e.g. name@example.com or +1 555-0199"
              icon="mail-outline"
              value={identifier}
              onChangeText={(val) => {
                setIdentifier(val);
                if (localError) setLocalError(null);
                if (authError) clearAuthError();
              }}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Input
              label="Emergency Account Password"
              placeholder="Enter your password"
              icon="lock-closed-outline"
              isPassword
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (localError) setLocalError(null);
                if (authError) clearAuthError();
              }}
            />

            <View style={styles.quickFillRow}>
              <TouchableOpacity onPress={fillDemoAccount}>
                <Text style={styles.quickFillText}>⚡ Autofill Demo Credentials</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.forgotPassText}>Forgot PIN?</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Sign In to EmergencySOS"
              variant="danger"
              size="lg"
              loading={isLoading}
              onPress={handleLogin}
              icon={<Ionicons name="log-in-outline" size={20} color={Colors.white} />}
              style={styles.submitBtn}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continue in Demo Mode (Offline)"
              variant="navy"
              size="md"
              onPress={handleContinueDemo}
              icon={<Ionicons name="flash-outline" size={18} color={Colors.white} />}
            />
          </View>

          {/* Footer Navigation */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Don't have an emergency profile?</Text>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.footerLink}> Register Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.navy[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[800],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    marginLeft: 6,
    letterSpacing: 0.8,
  },
  headerBlock: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.slate400,
    marginTop: 6,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    shadowColor: Colors.navy.darkest,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.emergency.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.emergency.border,
    marginBottom: 16,
  },
  errorAlertText: {
    color: Colors.emergency.dark,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  quickFillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 20,
  },
  quickFillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.navy[700],
  },
  forgotPassText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.slate600,
  },
  submitBtn: {
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.slate200,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate400,
    paddingHorizontal: 12,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
    color: Colors.slate400,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.emergency.light,
  },
});
