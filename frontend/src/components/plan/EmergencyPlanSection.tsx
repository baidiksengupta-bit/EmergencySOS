import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useSOS } from '../../context/SOSContext';
import { CountdownDuration } from '../../types';

interface EmergencyPlanSectionProps {
  onItemPress?: (screen: string) => void;
  style?: object;
}

const COUNTDOWN_OPTIONS: {
  value: CountdownDuration;
  label: string;
  badge: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 0,
    label: 'Instant (0s)',
    badge: 'NO DELAY',
    desc: 'Triggers immediately upon SOS button touch (skip timer)',
    icon: 'flash',
  },
  {
    value: 3,
    label: '3 Seconds',
    badge: 'FAST',
    desc: 'Quick emergency alert with brief cancellation window',
    icon: 'timer',
  },
  {
    value: 5,
    label: '5 Seconds',
    badge: 'RECOMMENDED',
    desc: 'Default balanced buffer to abort false alarms safely',
    icon: 'shield-checkmark',
  },
  {
    value: 10,
    label: '10 Seconds',
    badge: 'EXTENDED',
    desc: 'Extra buffer window for pocket dials and testing',
    icon: 'time',
  },
  {
    value: 15,
    label: '15 Seconds',
    badge: 'MAXIMUM',
    desc: 'Longest review time before local alert logging',
    icon: 'hourglass',
  },
];

export const EmergencyPlanSection: React.FC<EmergencyPlanSectionProps> = ({
  onItemPress,
  style,
}) => {
  const { profile, settings, contacts, locationPermission, emergencyPlanStatus, updateSettings, themeColors } = useSOS();
  const [showCountdownModal, setShowCountdownModal] = useState(false);

  const {
    isProfileComplete,
    isContactsComplete,
    isLocationComplete,
    isCountdownComplete,
    completedCount,
    totalCount,
    progressPercent,
    isReady,
  } = emergencyPlanStatus;

  const handleNavigate = (route: string, itemId: string) => {
    if (itemId === 'countdown') {
      setShowCountdownModal(true);
      return;
    }

    if (onItemPress) {
      onItemPress(route);
    } else {
      router.push(route as any);
    }
  };

  const handleSelectQuickCountdown = async (duration: CountdownDuration) => {
    await updateSettings({ countdown_seconds: duration, countdown_preference_set: true });
    setShowCountdownModal(false);
  };

  const getCountdownLabel = (seconds: CountdownDuration) => {
    if (seconds === 0) return 'Instant (0s)';
    return `${seconds}s`;
  };

  const checklistItems = [
    {
      id: 'profile',
      title: 'Emergency Profile',
      isComplete: isProfileComplete,
      completeSubtitle: `${profile.full_name || 'Configured'} • Health details stored`,
      incompleteSubtitle: 'Profile missing • Tap to enter name & health notes',
      route: '/(tabs)/settings',
      icon: 'person-circle-outline' as const,
      actionHint: 'Edit Profile',
    },
    {
      id: 'contacts',
      title: 'Emergency Contacts',
      isComplete: isContactsComplete,
      completeSubtitle: `${contacts.length} Contact${contacts.length === 1 ? '' : 's'} saved on device`,
      incompleteSubtitle: 'No contacts added • Tap to add at least 1 contact',
      route: '/(tabs)/contacts',
      icon: 'people-outline' as const,
      actionHint: 'Add Contact',
    },
    {
      id: 'location',
      title: 'GPS Location Access',
      isComplete: isLocationComplete,
      completeSubtitle: 'Foreground GPS active • Sensor telemetry ready',
      incompleteSubtitle:
        locationPermission === 'denied'
          ? 'Location access denied • Tap to configure in Radar tab'
          : 'Permission required • Tap to enable device location',
      route: '/(tabs)/location',
      icon: 'navigate-outline' as const,
      actionHint: 'Enable GPS',
    },
    {
      id: 'countdown',
      title: 'SOS Countdown Preference',
      isComplete: isCountdownComplete,
      completeSubtitle: `${getCountdownLabel(settings.countdown_seconds)} duration selected for panic button`,
      incompleteSubtitle: 'Preference not set • Tap to choose duration',
      route: '/(tabs)/settings',
      icon: 'timer-outline' as const,
      actionHint: 'Set Duration',
    },
  ];

  return (
    <View style={[styles.container, style]}>
      {/* ==================================================================== */}
      {/* Section Header                                                       */}
      {/* ==================================================================== */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="clipboard" size={15} color={Colors.white} />
          </View>
          <Text style={styles.sectionTitle}>EMERGENCY PLAN</Text>
        </View>

        {isReady ? (
          <View style={styles.readyBadgePill}>
            <View style={styles.readyDot} />
            <Text style={styles.readyBadgeText}>READY</Text>
          </View>
        ) : (
          <View style={styles.actionRequiredPill}>
            <View style={styles.actionDot} />
            <Text style={styles.actionRequiredText}>
              {totalCount - completedCount} INCOMPLETE
            </Text>
          </View>
        )}
      </View>

      {/* ==================================================================== */}
      {/* Readiness Status Banner                                              */}
      {/* ==================================================================== */}
      <View
        style={[
          styles.statusCard,
          {
            backgroundColor: isReady
              ? themeColors.isDark ? '#081E26' : '#F0FDF4'
              : themeColors.cardNavyBackground,
            borderColor: isReady
              ? 'rgba(16, 185, 129, 0.4)'
              : themeColors.cardBorder,
          },
        ]}
      >
        <View style={styles.statusContentRow}>
          <View
            style={[
              styles.statusIconBox,
              isReady ? styles.statusIconBoxReady : styles.statusIconBoxIncomplete,
            ]}
          >
            <Ionicons
              name={isReady ? 'shield-checkmark' : 'shield-outline'}
              size={24}
              color={isReady ? Colors.success : Colors.warning}
            />
          </View>

          <View style={styles.statusTextCol}>
            <Text style={[styles.statusStateTitle, { color: themeColors.textPrimary }, isReady && styles.statusStateTitleReady]} numberOfLines={1}>
              {isReady ? 'Safety Plan: 100% Ready' : 'Emergency Plan Incomplete'}
            </Text>
            <Text style={[styles.statusStateSubtitle, { color: themeColors.textSecondary }]} numberOfLines={2}>
              {isReady
                ? 'All essential local setup tasks are complete. Standby mode is ready for emergency simulation.'
                : `Complete ${totalCount - completedCount} remaining item${totalCount - completedCount === 1 ? '' : 's'} below to ensure full readiness.`}
            </Text>
          </View>
        </View>

        {/* Progress Bar Container */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelsRow}>
            <Text style={[styles.progressLabelText, { color: themeColors.textSecondary }]}>SETUP COMPLETION</Text>
            <Text style={[styles.progressPercentText, isReady && styles.progressPercentTextReady]}>
              {progressPercent}%
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: themeColors.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` },
                isReady ? styles.progressFillReady : styles.progressFillIncomplete,
              ]}
            />
          </View>

          <View style={styles.progressSubRow}>
            <Text style={[styles.progressSubText, { color: themeColors.textSecondary }]}>
              {completedCount} of {totalCount} safety checks completed
            </Text>
            {isReady && (
              <View style={styles.readyCheckPill}>
                <Ionicons name="checkmark" size={11} color={Colors.success} />
                <Text style={styles.readyCheckText}>Verified</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ==================================================================== */}
      {/* Interactive Setup Checklist                                          */}
      {/* ==================================================================== */}
      <View
        style={[
          styles.checklistCard,
          {
            backgroundColor: themeColors.cardNavyBackground,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <Text style={[styles.checklistHeading, { color: themeColors.textSecondary }]}>SETUP CHECKLIST</Text>

        <View style={styles.checklistWrapper}>
          {checklistItems.map((item, index) => {
            const isLast = index === checklistItems.length - 1;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.75}
                onPress={() => handleNavigate(item.route, item.id)}
                style={[
                  styles.checklistItem,
                  {
                    backgroundColor: themeColors.isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: themeColors.cardBorderSubtle,
                  },
                  !isLast && styles.checklistItemBorder,
                  !item.isComplete && styles.checklistItemIncompleteHighlight,
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${item.isComplete ? 'Complete' : 'Action Required'}. ${item.isComplete ? item.completeSubtitle : item.incompleteSubtitle}`}
                accessibilityHint={`Double tap to configure ${item.title}`}
              >
                {/* Status Indicator Icon */}
                <View
                  style={[
                    styles.itemStatusCircle,
                    item.isComplete
                      ? styles.itemStatusCircleComplete
                      : styles.itemStatusCircleIncomplete,
                  ]}
                >
                  <Ionicons
                    name={item.isComplete ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={item.isComplete ? Colors.success : Colors.warning}
                  />
                </View>

                {/* Title & Description with non-colliding layout */}
                <View style={styles.itemTextCol}>
                  <View style={styles.itemTitleRow}>
                    <Text style={[styles.itemTitleText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Badge
                      label={item.isComplete ? 'READY' : 'ACTION REQUIRED'}
                      variant={item.isComplete ? 'success' : 'warning'}
                    />
                  </View>

                  <Text
                    style={[
                      styles.itemSubtitleText,
                      { color: themeColors.textSecondary },
                      !item.isComplete && styles.itemSubtitleTextIncomplete,
                    ]}
                    numberOfLines={2}
                  >
                    {item.isComplete ? item.completeSubtitle : item.incompleteSubtitle}
                  </Text>
                </View>

                {/* Navigation Arrow */}
                <View style={[styles.arrowContainer, { backgroundColor: themeColors.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }]}>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={item.isComplete ? themeColors.textSecondary : Colors.warning}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ==================================================================== */}
      {/* Short Safety Notice Banner                                           */}
      {/* ==================================================================== */}
      <View style={[styles.safetyNoticeCard, { backgroundColor: themeColors.cardNavyBackground, borderColor: themeColors.cardBorder }]}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.warning} />
        <View style={styles.safetyNoticeTextGroup}>
          <Text style={styles.safetyNoticeTitle}>DEMO SAFETY NOTICE</Text>
          <Text style={[styles.safetyNoticeBody, { color: themeColors.textSecondary }]}>
            This app is currently a UI demo and does not contact emergency services (National Emergency: 112 / Police: 100) or send live SMS/call alerts.
          </Text>
        </View>
      </View>

      {/* ==================================================================== */}
      {/* Quick Countdown Duration Bottom Sheet / Modal                        */}
      {/* ==================================================================== */}
      <Modal
        visible={showCountdownModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowCountdownModal(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.modalSafeContainer}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>SOS Countdown Duration</Text>
                  <Text style={styles.modalSubtitle}>
                    Choose countdown window before emergency demo triggers
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowCountdownModal(false)}
                  style={styles.modalCloseBtn}
                  accessible={true}
                  accessibilityLabel="Close countdown options"
                >
                  <Ionicons name="close" size={20} color={Colors.white} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {COUNTDOWN_OPTIONS.map((opt) => {
                  const isSelected = settings.countdown_seconds === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      activeOpacity={0.75}
                      onPress={() => handleSelectQuickCountdown(opt.value)}
                      style={[
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                      ]}
                    >
                      <View
                        style={[
                          styles.optionIconCircle,
                          isSelected && styles.optionIconCircleSelected,
                        ]}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={18}
                          color={isSelected ? Colors.white : Colors.slate400}
                        />
                      </View>

                      <View style={styles.optionTextCol}>
                        <View style={styles.optionTitleRow}>
                          <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                            {opt.label}
                          </Text>
                          <Badge
                            label={opt.badge}
                            variant={isSelected ? 'danger' : 'navy'}
                          />
                        </View>
                        <Text style={styles.optionDesc} numberOfLines={2}>
                          {opt.desc}
                        </Text>
                      </View>

                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={isSelected ? Colors.emergency.primary : Colors.slate600}
                        style={{ marginLeft: 8 }}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Button
                title="Manage All Settings & Profile"
                variant="outline"
                size="md"
                onPress={() => {
                  setShowCountdownModal(false);
                  handleNavigate('/(tabs)/settings', 'profile');
                }}
                icon={<Ionicons name="settings-outline" size={16} color={Colors.white} />}
                textStyle={{ color: Colors.white }}
                style={{ marginTop: 12 }}
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },

  // 1. Header Row
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#0D1B3E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 1.2,
  },
  readyBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    flexShrink: 0,
  },
  readyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  readyBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.success,
    letterSpacing: 0.8,
  },
  actionRequiredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    flexShrink: 0,
  },
  actionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.warning,
    marginRight: 6,
  },
  actionRequiredText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.warning,
    letterSpacing: 0.5,
  },

  // 2. Status Card & Progress Bar
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#0D1B3E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  statusCardReady: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: '#081E26',
  },
  statusCardIncomplete: {
    borderColor: 'rgba(245, 158, 11, 0.25)',
    backgroundColor: '#0D1B3E',
  },
  statusContentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  statusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  statusIconBoxReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusIconBoxIncomplete: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusTextCol: {
    flex: 1,
    minWidth: 0,
  },
  statusStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 3,
  },
  statusStateTitleReady: {
    color: Colors.success,
  },
  statusStateSubtitle: {
    fontSize: 12,
    color: Colors.slate400,
    lineHeight: 17,
  },

  // Progress Bar
  progressSection: {
    backgroundColor: 'rgba(5, 11, 20, 0.5)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  progressLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
  },
  progressPercentText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.warning,
  },
  progressPercentTextReady: {
    color: Colors.success,
  },
  progressTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressFillReady: {
    backgroundColor: Colors.success,
  },
  progressFillIncomplete: {
    backgroundColor: Colors.warning,
  },
  progressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSubText: {
    fontSize: 11,
    color: Colors.slate400,
    fontWeight: '500',
  },
  readyCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  readyCheckText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.success,
    marginLeft: 3,
  },

  // 3. Checklist Items Card
  checklistCard: {
    backgroundColor: '#0D1B3E',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  checklistHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 1,
    marginBottom: 10,
  },
  checklistWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  checklistItemBorder: {
    marginBottom: 6,
  },
  checklistItemIncompleteHighlight: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  itemStatusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  itemStatusCircleComplete: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  itemStatusCircleIncomplete: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  itemTextCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
    minWidth: 0,
  },
  itemTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
    flexShrink: 1,
    minWidth: 0,
  },
  itemSubtitleText: {
    fontSize: 11,
    color: Colors.slate400,
    lineHeight: 15,
  },
  itemSubtitleTextIncomplete: {
    color: Colors.warning,
  },
  arrowContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flexShrink: 0,
  },

  // 4. Safety Notice
  safetyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 12,
  },
  safetyNoticeTextGroup: {
    flex: 1,
    marginLeft: 8,
  },
  safetyNoticeTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.warning,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  safetyNoticeBody: {
    fontSize: 11,
    color: Colors.slate400,
    lineHeight: 16,
  },

  // 5. Quick Countdown Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 20, 0.85)',
    justifyContent: 'flex-end',
  },
  modalSafeContainer: {
    width: '100%',
  },
  modalCard: {
    backgroundColor: '#0D1B3E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.slate400,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  optionCardSelected: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: Colors.emergency.primary,
  },
  optionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  optionIconCircleSelected: {
    backgroundColor: Colors.emergency.primary,
  },
  optionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  optionTitleSelected: {
    color: Colors.white,
  },
  optionDesc: {
    fontSize: 11,
    color: Colors.slate400,
    lineHeight: 15,
  },
});
