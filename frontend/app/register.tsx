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

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function RegisterScreen() {
  const { register, continueInDemoMode, isLoading, authError, clearAuthError } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [pin, setPin] = useState('1234');
  const [localError, setLocalError] = useState<string | null>(null);

  const activeError = localError || authError;

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setLocalError('Please provide your full legal name.');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.length < 7) {
      setLocalError('Please provide a valid emergency telephone number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setLocalError('Please provide a valid contact email address.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setLocalError('Please provide an account password with at least 6 characters.');
      return;
    }

    setLocalError(null);
    clearAuthError();

    const result = await register({
      full_name: fullName.trim(),
      phone_number: phoneNumber.trim(),
      email: email.trim(),
      password: password,
      blood_group: bloodGroup,
      allergies: allergies.trim() || 'None reported',
      medical_notes: medicalNotes.trim() || 'No special conditions',
      emergency_pin: pin,
    });

    if (result.success) {
      Alert.alert(
        'Profile Created Successfully',
        'Your Emergency SOS profile is now registered with the backend and ready to broadcast in critical moments.',
        [{ text: 'Proceed to Dashboard', onPress: () => router.replace('/(tabs)') }]
      );
    } else {
      Alert.alert(
        'Registration Failed',
        result.error || 'Unable to create account. Please check your information or continue in Demo Mode.',
        [
          { text: 'Review Form', style: 'cancel' },
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
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>STEP 1 OF 1</Text>
            </View>
          </View>

          {/* Header Block */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Register Emergency SOS</Text>
            <Text style={styles.subtitle}>
              Your information is encrypted and only relayed to verified emergency contacts and first responders when an SOS triggers.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {activeError && (
              <View style={styles.errorAlert}>
                <Ionicons name="alert-circle" size={18} color={Colors.emergency.primary} />
                <Text style={styles.errorAlertText}>{activeError}</Text>
              </View>
            )}

            <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>
            <Input
              label="Full Name"
              placeholder="e.g. Eleanor Vance"
              icon="person-outline"
              value={fullName}
              onChangeText={(val) => {
                setFullName(val);
                if (localError) setLocalError(null);
                if (authError) clearAuthError();
              }}
            />

            <Input
              label="Mobile Phone (Primary SOS Device)"
              placeholder="+1 (555) 012-3456"
              icon="call-outline"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(val) => {
                setPhoneNumber(val);
                if (localError) setLocalError(null);
                if (authError) clearAuthError();
              }}
            />

            <Input
              label="Email Address"
              placeholder="name@emergency.org"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(val) => {
                setEmail(val);
                if (localError) setLocalError(null);
                if (authError) clearAuthError();
              }}
            />

            <Input
              label="Account Password (Min 6 Characters)"
              placeholder="Create secure password"
              icon="lock-closed-outline"
              isPassword
              value={password}
              onChangeText={(val) => {
                setPassword(val);
                if (localError) setLocalError(null);
                if (authError) clearAuthError();
              }}
            />

            <Text style={styles.sectionHeader}>CRITICAL MEDICAL RELAY</Text>
            
            {/* Blood Group Selector Chips */}
            <Text style={styles.fieldLabel}>Blood Group</Text>
            <View style={styles.chipsRow}>
              {BLOOD_GROUPS.map((bg) => {
                const isSelected = bloodGroup === bg;
                return (
                  <TouchableOpacity
                    key={bg}
                    activeOpacity={0.75}
                    onPress={() => setBloodGroup(bg)}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {bg}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Input
              label="Known Allergies (Optional)"
              placeholder="e.g. Penicillin, Latex, Insect stings"
              icon="bandage-outline"
              value={allergies}
              onChangeText={setAllergies}
            />

            <Input
              label="Medical Conditions / Medications"
              placeholder="e.g. Type 1 Diabetic, Pacemaker"
              icon="medkit-outline"
              value={medicalNotes}
              onChangeText={setMedicalNotes}
            />

            <Input
              label="4-Digit False-Alarm Cancel PIN"
              placeholder="1234"
              icon="keypad-outline"
              keyboardType="number-pad"
              maxLength={4}
              value={pin}
              onChangeText={setPin}
            />

            <Button
              title="Complete Emergency Setup"
              variant="danger"
              size="lg"
              loading={isLoading}
              onPress={handleRegister}
              icon={<Ionicons name="shield-checkmark-outline" size={20} color={Colors.white} />}
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
            <Text style={styles.footerText}>Already registered?</Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.footerLink}> Sign In</Text>
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
  badge: {
    backgroundColor: Colors.navy[800],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    color: Colors.slate400,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerBlock: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.slate400,
    marginTop: 6,
    lineHeight: 19,
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
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.navy[700],
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.navy[900],
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: Colors.slate50,
    borderWidth: 1.5,
    borderColor: Colors.slate200,
  },
  chipSelected: {
    backgroundColor: Colors.emergency.primary,
    borderColor: Colors.emergency.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.navy[900],
  },
  chipTextSelected: {
    color: Colors.white,
  },
  submitBtn: {
    marginTop: 10,
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
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate400,
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
