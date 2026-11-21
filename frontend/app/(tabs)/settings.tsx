import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/constants/Colors';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Input } from '../../src/components/common/Input';
import { Button } from '../../src/components/common/Button';
import { EmergencyPlanSection } from '../../src/components/plan/EmergencyPlanSection';
import { useSOS } from '../../src/context/SOSContext';
import { CountdownDuration, AppTheme } from '../../src/types';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const COUNTDOWN_DURATIONS: { label: string; value: CountdownDuration }[] = [
  { label: 'Instant (0s)', value: 0 },
  { label: '3s', value: 3 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '15s', value: 15 },
];

const DEFAULT_MESSAGE =
  'EMERGENCY SOS: I need immediate assistance! My current location is attached.';

const THEME_OPTIONS: {
  id: AppTheme;
  label: string;
  description: string;
  previewColors: [string, string];
}[] = [
  {
    id: 'navy',
    label: 'Midnight Navy',
    description: 'Deep navy surface with emergency crimson accents (Default)',
    previewColors: ['#0A1128', '#DC2626'],
  },
  {
    id: 'midnight',
    label: 'Pure Midnight',
    description: 'Deep OLED pitch black background for battery saving and contrast',
    previewColors: ['#030712', '#EF4444'],
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    description: 'Elevated borders and vivid high-visibility emergency alert styling',
    previewColors: ['#0F172A', '#F87171'],
  },
];

export default function SettingsScreen() {
  const {
    profile,
    settings,
    contacts,
    history,
    updateProfile,
    updateSettings,
    resetDemoData,
  } = useSOS();

  // Modal State for Profile Editing
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(profile.full_name);
  const [medicalNotes, setMedicalNotes] = useState(profile.medical_notes || '');
  const [formError, setFormError] = useState<string | null>(null);

  // Custom Emergency Message State
  const [customMessage, setCustomMessage] = useState(
    settings?.custom_emergency_message || DEFAULT_MESSAGE
  );
  const [messageSavedFeedback, setMessageSavedFeedback] = useState(false);

  useEffect(() => {
    if (settings?.custom_emergency_message) {
      setCustomMessage(settings.custom_emergency_message);
    }
  }, [settings?.custom_emergency_message]);

  const openEditProfileModal = () => {
    setProfileName(profile.full_name);
    setMedicalNotes(profile.medical_notes || '');
    setFormError(null);
    setIsEditProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim() || profileName.trim().length < 2) {
      setFormError('Please enter a valid name (at least 2 characters).');
      return;
    }

    await updateProfile({
      full_name: profileName.trim(),
      medical_notes: medicalNotes.trim() || undefined,
    });

    setIsEditProfileModalOpen(false);
    Alert.alert('Profile Saved', 'Your local emergency profile has been updated.');
  };

  const handleSelectCountdown = async (duration: CountdownDuration) => {
    await updateSettings({ countdown_seconds: duration });
  };

  const handleToggleVibration = async (value: boolean) => {
    await updateSettings({ vibrate_enabled: value });
  };

  const handleToggleAlarm = async (value: boolean) => {
    await updateSettings({ sound_alarm_enabled: value });
  };

  const handleSaveMessage = async () => {
    const trimmed = customMessage.trim() || DEFAULT_MESSAGE;
    await updateSettings({ custom_emergency_message: trimmed });
    setCustomMessage(trimmed);
    setMessageSavedFeedback(true);
    setTimeout(() => setMessageSavedFeedback(false), 2500);
    Alert.alert('Template Saved', 'Emergency broadcast message template updated.');
  };

  const handleResetDefaultMessage = async () => {
    await updateSettings({ custom_emergency_message: DEFAULT_MESSAGE });
    setCustomMessage(DEFAULT_MESSAGE);
    Alert.alert('Reset to Default', 'Emergency broadcast message reset to standard alert.');
  };

  const handleSelectTheme = async (theme: AppTheme) => {
    await updateSettings({ theme });
  };

  const confirmResetDemoData = () => {
    Alert.alert(
      'Reset All Demo Data?',
      'Are you sure you want to reset all demo data? This will clear all locally saved emergency contacts, alert history, and restore profile and preferences to defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Reset All',
          style: 'destructive',
          onPress: async () => {
            await resetDemoData();
            Alert.alert(
              'Demo Data Reset',
              'All local contacts, alert history, profile, and settings have been restored to defaults.'
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Header
        title="Profile & Settings"
        subtitle="Local Preferences • UI Demonstration"
        variant="navy"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================== */}
        {/* Local Demo Disclaimer Banner                                       */}
        {/* ================================================================== */}
        <View style={styles.demoNoticeCard}>
          <View style={styles.demoNoticeTop}>
            <View style={styles.demoNoticeBadge}>
              <View style={styles.demoDot} />
              <Text style={styles.demoBadgeText}>LOCAL DEMONSTRATION MODE</Text>
            </View>
          </View>
          <Text style={styles.demoNoticeTitle}>Offline UI Demonstration</Text>
          <Text style={styles.demoNoticeText}>
            This version of EmergencySOS runs entirely on your local device. Triggering the SOS panic button does not contact 911, dispatch emergency services, send SMS, make phone calls, or track location.
          </Text>
        </View>

        {/* ================================================================== */}
        {/* Emergency Plan Section                                             */}
        {/* ================================================================== */}
        <EmergencyPlanSection
          onItemPress={(route) => {
            if (route === '/(tabs)/settings') {
              openEditProfileModal();
            } else {
              router.push(route as any);
            }
          }}
        />

        {/* ================================================================== */}
        {/* 1. Local Profile Section                                           */}
        {/* ================================================================== */}
        <View style={styles.sectionHeader}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.slate400} />
          <Text style={styles.sectionHeaderText}>LOCAL PROFILE</Text>
        </View>

        <Card variant="navy" style={styles.profileCard}>
          <View style={styles.profileHeaderRow}>
            {/* Avatar Circle */}
            <View style={styles.avatarCircle} accessible={true} accessibilityLabel={`Profile avatar for ${profile.full_name}`}>
              <Text style={styles.avatarText}>
                {profile.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </Text>
            </View>

            {/* Profile Info */}
            <View style={styles.profileInfoCol}>
              <Text style={styles.profileName}>{profile.full_name}</Text>
              <Text style={styles.profileRole}>EmergencySOS User • Local Profile</Text>
            </View>

            {/* Edit Button */}
            <TouchableOpacity
              onPress={openEditProfileModal}
              style={styles.editProfileBtn}
              activeOpacity={0.8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Edit Local Profile"
              accessibilityHint="Opens modal to edit full name and medical notes"
            >
              <Ionicons name="create-outline" size={15} color={Colors.white} />
              <Text style={styles.editProfileBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Medical Notes Box */}
          <View style={styles.medicalNotesBox}>
            <View style={styles.medicalNotesLabelRow}>
              <Ionicons name="medical" size={14} color={Colors.emergency.primary} />
              <Text style={styles.medicalNotesLabel}>MEDICAL NOTES & ALLERGIES</Text>
            </View>
            <Text style={styles.medicalNotesText}>
              {profile.medical_notes || 'No medical notes added. Tap Edit to add allergies or health conditions.'}
            </Text>
          </View>
        </Card>

        {/* ================================================================== */}
        {/* 2. SOS Preferences Section                                         */}
        {/* ================================================================== */}
        <View style={styles.sectionHeader}>
          <Ionicons name="options-outline" size={18} color={Colors.slate400} />
          <Text style={styles.sectionHeaderText}>SOS PREFERENCES</Text>
        </View>

        <Card variant="navy" style={styles.preferencesCard}>
          {/* Countdown Duration Picker */}
          <View style={styles.prefBlock}>
            <View style={styles.prefTextCol}>
              <Text style={styles.prefTitle}>Countdown Duration</Text>
              <Text style={styles.prefSub}>
                Seconds before simulated emergency broadcast is triggered
              </Text>
            </View>
            <View style={styles.chipsRow}>
              {COUNTDOWN_DURATIONS.map((dur) => {
                const isSelected = settings.countdown_seconds === dur.value;
                return (
                  <TouchableOpacity
                    key={dur.value}
                    onPress={() => handleSelectCountdown(dur.value)}
                    style={[styles.durationChip, isSelected && styles.durationChipSelected]}
                    activeOpacity={0.8}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`${dur.label} countdown duration`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        isSelected && styles.durationChipTextSelected,
                      ]}
                    >
                      {dur.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* Vibration Toggle */}
          <View style={styles.switchRow}>
            <View style={styles.switchIconBox}>
              <Ionicons name="phone-portrait-outline" size={18} color={Colors.navy[500]} />
            </View>
            <View style={styles.switchTextCol}>
              <Text style={styles.switchTitle}>Haptic Vibration</Text>
              <Text style={styles.switchSub}>
                Vibrate device during countdown and alert activation
              </Text>
            </View>
            <Switch
              value={settings.vibrate_enabled}
              onValueChange={handleToggleVibration}
              trackColor={{ false: Colors.navy[700], true: Colors.emergency.primary }}
              thumbColor={Colors.white}
              accessible={true}
              accessibilityLabel="Haptic Vibration Switch"
            />
          </View>

          <View style={styles.divider} />

          {/* Alarm Sound Toggle */}
          <View style={styles.switchRow}>
            <View style={styles.switchIconBox}>
              <Ionicons name="volume-high-outline" size={18} color={Colors.navy[500]} />
            </View>
            <View style={styles.switchTextCol}>
              <Text style={styles.switchTitle}>Audible Alarm Siren</Text>
              <Text style={styles.switchSub}>
                Sound simulated alarm siren during countdown
              </Text>
            </View>
            <Switch
              value={settings.sound_alarm_enabled}
              onValueChange={handleToggleAlarm}
              trackColor={{ false: Colors.navy[700], true: Colors.emergency.primary }}
              thumbColor={Colors.white}
              accessible={true}
              accessibilityLabel="Audible Alarm Siren Switch"
            />
          </View>
        </Card>

        {/* ================================================================== */}
        {/* 3. Emergency Broadcast Message Template                            */}
        {/* ================================================================== */}
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={Colors.slate400} />
          <Text style={styles.sectionHeaderText}>EMERGENCY BROADCAST MESSAGE</Text>
        </View>

        <Card variant="navy" style={styles.preferencesCard}>
          <View style={styles.prefBlock}>
            <View style={styles.templateHeaderRow}>
              <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                <Text style={styles.prefTitle}>Alert Message Template</Text>
                <Text style={styles.prefSub}>
                  Custom message payload simulated in emergency broadcasts
                </Text>
              </View>
              <Text style={styles.charCountText}>
                {customMessage.length}/160
              </Text>
            </View>

            <TextInput
              style={styles.messageTextInput}
              value={customMessage}
              onChangeText={(text) => {
                if (text.length <= 160) {
                  setCustomMessage(text);
                }
              }}
              multiline
              maxLength={160}
              placeholder="Enter custom emergency message..."
              placeholderTextColor={Colors.slate400}
              accessible={true}
              accessibilityLabel="Emergency broadcast message template input"
            />

            <View style={styles.messageActionsRow}>
              <TouchableOpacity
                onPress={handleResetDefaultMessage}
                style={styles.resetMsgBtn}
                activeOpacity={0.8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Reset to standard emergency message template"
              >
                <Ionicons name="reload-outline" size={14} color={Colors.slate400} />
                <Text style={styles.resetMsgBtnText}>Reset to Default</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveMessage}
                style={styles.saveMsgBtn}
                activeOpacity={0.8}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Save emergency message template"
              >
                <Ionicons name="checkmark-circle-outline" size={15} color={Colors.white} />
                <Text style={styles.saveMsgBtnText}>
                  {messageSavedFeedback ? 'Saved!' : 'Save Template'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Live Broadcast Preview Card */}
          <View style={styles.previewContainer}>
            <View style={styles.previewHeaderRow}>
              <View style={styles.previewTagGroup}>
                <Ionicons name="radio" size={14} color={Colors.emergency.light} />
                <Text style={styles.previewTagText}>LIVE BROADCAST PREVIEW</Text>
              </View>
              <Badge label="SMS SIMULATION" variant="danger" />
            </View>

            <View style={styles.previewBubble}>
              <Text style={styles.previewMessageText}>
                {customMessage || DEFAULT_MESSAGE}
              </Text>
              <View style={styles.previewGpsAttachment}>
                <Ionicons name="location" size={14} color={Colors.success} />
                <Text style={styles.previewGpsText} numberOfLines={1}>
                  37.78825° N, 122.43240° W • San Francisco, CA
                </Text>
              </View>
            </View>

            <View style={styles.previewFooterRow}>
              <Ionicons name="people-outline" size={13} color={Colors.slate400} />
              <Text style={styles.previewFooterText}>
                {contacts.length === 0
                  ? 'No contacts added • Demo alert logged to local history only'
                  : `Simulated dispatch to ${contacts.length} emergency contact${contacts.length === 1 ? '' : 's'}`}
              </Text>
            </View>
          </View>
        </Card>

        {/* ================================================================== */}
        {/* 4. Appearance & Theme Selection                                    */}
        {/* ================================================================== */}
        <View style={styles.sectionHeader}>
          <Ionicons name="color-palette-outline" size={18} color={Colors.slate400} />
          <Text style={styles.sectionHeaderText}>APP THEME & CONTRAST</Text>
        </View>

        <Card variant="navy" style={styles.preferencesCard}>
          <View style={styles.themeOptionsList}>
            {THEME_OPTIONS.map((themeOpt) => {
              const isSelected = (settings.theme || 'navy') === themeOpt.id;
              return (
                <TouchableOpacity
                  key={themeOpt.id}
                  style={[
                    styles.themeOptionCard,
                    isSelected && styles.themeOptionCardSelected,
                  ]}
                  onPress={() => handleSelectTheme(themeOpt.id)}
                  activeOpacity={0.8}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${themeOpt.label} theme`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.themePreviewSwatches}>
                    <View
                      style={[
                        styles.themeSwatchPrimary,
                        { backgroundColor: themeOpt.previewColors[0] },
                      ]}
                    />
                    <View
                      style={[
                        styles.themeSwatchAccent,
                        { backgroundColor: themeOpt.previewColors[1] },
                      ]}
                    />
                  </View>

                  <View style={styles.themeTextCol}>
                    <View style={styles.themeTitleRow}>
                      <Text style={styles.themeLabel}>{themeOpt.label}</Text>
                      {isSelected && (
                        <Badge label="ACTIVE" variant="success" />
                      )}
                    </View>
                    <Text style={styles.themeDesc}>{themeOpt.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* ================================================================== */}
        {/* 5. Demo Data & Storage Management                                  */}
        {/* ================================================================== */}
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.slate400} />
          <Text style={styles.sectionHeaderText}>DEMO DATA & STORAGE</Text>
        </View>

        <Card variant="navy" style={styles.dataCard}>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Stored Emergency Contacts</Text>
            <Badge label={`${contacts.length} Saved`} variant={contacts.length > 0 ? 'info' : 'navy'} />
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Local Demo Alert Records</Text>
            <Badge label={`${history.length} Logged`} variant={history.length > 0 ? 'danger' : 'navy'} />
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>Storage Location</Text>
            <Text style={styles.diagValue}>Device AsyncStorage</Text>
          </View>
          <View style={styles.diagRow}>
            <Text style={styles.diagLabel}>External Connectivity</Text>
            <Text style={[styles.diagValue, { color: Colors.success }]}>Offline Demo (Isolated)</Text>
          </View>

          {/* Replay Onboarding Guide Button */}
          <Button
            title="Replay Onboarding Guide"
            variant="outline"
            size="md"
            onPress={() => router.push('/welcome')}
            icon={<Ionicons name="book-outline" size={18} color={Colors.white} />}
            textStyle={{ color: Colors.white }}
            style={{ marginTop: 14 }}
            accessibilityLabel="Replay Onboarding Guide"
          />

          {/* Reset Demo Data Button */}
          <Button
            title="Reset All Demo Data"
            variant="outline"
            size="md"
            onPress={confirmResetDemoData}
            icon={<Ionicons name="refresh-circle-outline" size={18} color={Colors.emergency.light} />}
            textStyle={{ color: Colors.emergency.light }}
            style={styles.resetBtn}
            accessibilityLabel="Reset All Demo Data"
          />
        </Card>

        <Text style={styles.footerNote}>
          EmergencySOS Mobile App v1.0.0 • Local UI Demonstration Build
        </Text>
      </ScrollView>

      {/* ================================================================== */}
      {/* Edit Profile Modal                                                 */}
      {/* ================================================================== */}
      <Modal visible={isEditProfileModalOpen} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.modalSafeContainer}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Edit Local Profile</Text>
                    <Text style={styles.modalSubtitle}>Stored strictly on this device</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsEditProfileModalOpen(false)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={24} color={Colors.white} />
                  </TouchableOpacity>
                </View>

                {formError && (
                  <View style={styles.modalError}>
                    <Ionicons name="alert-circle" size={18} color={Colors.emergency.light} />
                    <Text style={styles.modalErrorText}>{formError}</Text>
                  </View>
                )}

                <Input
                  label="Full Name *"
                  placeholder="e.g. Alex Morgan"
                  icon="person-outline"
                  value={profileName}
                  onChangeText={(val) => {
                    setProfileName(val);
                    if (formError) setFormError(null);
                  }}
                />

                <Input
                  label="Medical Notes / Health Conditions (Optional)"
                  placeholder="e.g. Diabetic (Type 1), penicillin allergy, asthma"
                  icon="medical-outline"
                  multiline
                  numberOfLines={3}
                  value={medicalNotes}
                  onChangeText={setMedicalNotes}
                  style={styles.notesInput}
                />

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => setIsEditProfileModalOpen(false)}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title="Save Profile"
                    variant="danger"
                    onPress={handleSaveProfile}
                    style={{ flex: 1, marginLeft: 8 }}
                  />
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy[900],
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },

  // Demo Disclaimer Card
  demoNoticeCard: {
    backgroundColor: Colors.navy[800],
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  demoNoticeTop: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  demoNoticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  demoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.warning,
    marginRight: 6,
  },
  demoBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.warning,
    letterSpacing: 0.8,
  },
  demoNoticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
  },
  demoNoticeText: {
    fontSize: 12,
    color: Colors.slate400,
    lineHeight: 17,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 6,
    gap: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
  },

  // Profile Card
  profileCard: {
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
    padding: 18,
    marginBottom: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.emergency.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  profileInfoCol: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.white,
  },
  profileRole: {
    fontSize: 12,
    color: Colors.slate400,
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  editProfileBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  medicalNotesBox: {
    backgroundColor: Colors.navy[900],
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  medicalNotesLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  medicalNotesLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.emergency.light,
    letterSpacing: 0.6,
  },
  medicalNotesText: {
    fontSize: 12,
    color: Colors.white,
    lineHeight: 17,
  },

  // Preferences Card
  preferencesCard: {
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
    padding: 16,
    marginBottom: 16,
  },
  prefBlock: {
    marginBottom: 14,
  },
  prefTextCol: {
    marginBottom: 10,
  },
  prefTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  prefSub: {
    fontSize: 12,
    color: Colors.slate400,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    flexGrow: 1,
    minWidth: '28%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.navy[900],
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  durationChipSelected: {
    backgroundColor: Colors.emergency.primary,
    borderColor: Colors.emergency.primary,
  },
  durationChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.slate400,
  },
  durationChipTextSelected: {
    color: Colors.white,
  },

  // Broadcast Message Template Styles
  templateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  charCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate400,
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  messageTextInput: {
    backgroundColor: Colors.navy[900],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navy[700],
    padding: 12,
    color: Colors.white,
    fontSize: 13,
    lineHeight: 18,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  messageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  resetMsgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  resetMsgBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate400,
    marginLeft: 5,
  },
  saveMsgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: Colors.emergency.primary,
  },
  saveMsgBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
    marginLeft: 5,
    letterSpacing: 0.3,
  },

  // Live Broadcast Preview Card
  previewContainer: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    padding: 14,
    marginTop: 4,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  previewTagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.emergency.light,
    letterSpacing: 0.6,
  },
  previewBubble: {
    backgroundColor: Colors.navy[900],
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  previewMessageText: {
    fontSize: 13,
    color: Colors.white,
    lineHeight: 18,
    fontWeight: '600',
  },
  previewGpsAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 5,
  },
  previewGpsText: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '500',
    flex: 1,
  },
  previewFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  previewFooterText: {
    fontSize: 10,
    color: Colors.slate400,
    fontWeight: '600',
  },

  // Themes and Appearance
  themeOptionsList: {
    gap: 10,
  },
  themeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.navy[700],
  },
  themeOptionCardSelected: {
    borderColor: Colors.emergency.primary,
    backgroundColor: '#0E1E47',
  },
  themePreviewSwatches: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    width: 38,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  themeSwatchPrimary: {
    flex: 1,
    height: '100%',
  },
  themeSwatchAccent: {
    width: 14,
    height: '100%',
  },
  themeTextCol: {
    flex: 1,
    minWidth: 0,
  },
  themeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 2,
  },
  themeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  themeDesc: {
    fontSize: 11,
    color: Colors.slate400,
    lineHeight: 15,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.navy[700],
    marginVertical: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.navy[900],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  switchTextCol: {
    flex: 1,
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  switchSub: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 1,
    lineHeight: 15,
  },

  // Data Management Card
  dataCard: {
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
    padding: 16,
    marginBottom: 16,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.navy[700],
  },
  diagLabel: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '600',
  },
  diagValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: Colors.slate400,
  },
  resetBtn: {
    marginTop: 16,
    borderColor: 'rgba(220, 38, 38, 0.4)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },

  footerNote: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 10,
    marginBottom: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 17, 40, 0.94)',
  },
  modalSafeContainer: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.navy[900],
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: Colors.navy[700],
    shadowColor: Colors.navy.darkest,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.slate400,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
    marginLeft: 8,
  },
  modalError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.emergency.primary,
  },
  modalErrorText: {
    color: Colors.emergency.light,
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '700',
    flex: 1,
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
});
