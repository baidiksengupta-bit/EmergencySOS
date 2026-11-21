import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../src/constants/Colors';
import { Header } from '../../src/components/common/Header';
import { Card } from '../../src/components/common/Card';
import { Badge } from '../../src/components/common/Badge';
import { Input } from '../../src/components/common/Input';
import { Button } from '../../src/components/common/Button';
import { useSOS } from '../../src/context/SOSContext';
import { EmergencyContact, ContactPriority } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

const RELATIONSHIP_OPTIONS = [
  'Family',
  'Spouse',
  'Parent',
  'Child',
  'Doctor',
  'Sibling',
  'Friend',
  'Work',
  'Other',
];

const PRIORITY_OPTIONS: { label: string; value: ContactPriority; desc: string }[] = [
  { label: 'Primary', value: 'PRIMARY', desc: 'First responder' },
  { label: 'High', value: 'HIGH', desc: 'Secondary responder' },
  { label: 'Standard', value: 'STANDARD', desc: 'General contact' },
];

export default function ContactsScreen() {
  const { contacts, addContact, updateContact, deleteContact } = useSOS();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('Family');
  const [priority, setPriority] = useState<ContactPriority>('STANDARD');
  const [formError, setFormError] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingContact(null);
    setName('');
    setPhone('');
    setRelationship('Family');
    // Default to PRIMARY if first contact, else STANDARD
    setPriority(contacts.length === 0 ? 'PRIMARY' : 'STANDARD');
    setFormError(null);
    setModalVisible(true);
  };

  const openEditModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setName(contact.name);
    setPhone(contact.phone_number);
    setRelationship(contact.relationship_label);
    setPriority(contact.priority_level || (contact.is_primary ? 'PRIMARY' : 'STANDARD'));
    setFormError(null);
    setModalVisible(true);
  };

  const validateForm = (): boolean => {
    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Contact name cannot be empty. Please enter a full name.');
      return false;
    }

    if (cleanName.length < 2) {
      setFormError('Contact name is too short (minimum 2 characters).');
      return false;
    }

    if (cleanName.length > 50) {
      setFormError('Contact name must be 50 characters or fewer.');
      return false;
    }

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setFormError('Phone number cannot be empty. Please enter an emergency contact phone number.');
      return false;
    }

    // Phone format validation: allows optional +, digits, spaces, hyphens, parentheses, dots
    const phonePattern = /^(\+)?[\d\s\-().]{3,25}$/;
    const digits = cleanPhone.replace(/\D/g, '');
    if (!phonePattern.test(cleanPhone) || digits.length < 3 || digits.length > 15) {
      setFormError(
        'Please enter a valid emergency phone number (3 to 15 digits, e.g. +1 555-123-4567 or 911).'
      );
      return false;
    }

    if (!relationship.trim()) {
      setFormError('Please select a relationship category.');
      return false;
    }

    return true;
  };

  const handleSaveContact = async () => {
    if (!validateForm()) return;

    const isPrimary = priority === 'PRIMARY';
    const contactName = name.trim();

    try {
      if (editingContact) {
        await updateContact(editingContact.id, {
          name: contactName,
          phone_number: phone.trim(),
          relationship_label: relationship,
          priority_level: priority,
          is_primary: isPrimary,
        });
        Alert.alert('Contact Updated', `${contactName} has been updated on your device.`);
      } else {
        await addContact({
          name: contactName,
          phone_number: phone.trim(),
          relationship_label: relationship,
          priority_level: priority,
          is_primary: isPrimary,
        });
        Alert.alert('Contact Added', `${contactName} has been added to your emergency contacts.`);
      }
      setModalVisible(false);
    } catch (e: any) {
      setFormError(e?.message || 'Failed to save contact. Please try again.');
    }
  };

  const confirmRemoveContact = (contact: EmergencyContact) => {
    Alert.alert(
      'Remove Emergency Contact?',
      `Are you sure you want to remove ${contact.name} (${contact.relationship_label}) from your emergency contacts list? This contact will be deleted from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteContact(contact.id);
            Alert.alert('Contact Removed', `${contact.name} was removed from your device.`);
          },
        },
      ]
    );
  };

  const getPriorityBadgeVariant = (level?: ContactPriority, isPrimary?: boolean) => {
    if (level === 'PRIMARY' || isPrimary) return 'danger';
    if (level === 'HIGH') return 'warning';
    return 'info';
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <StatusBar barStyle="light-content" />

      <Header
        title="Emergency Contacts"
        subtitle={
          contacts.length === 0
            ? 'No Contacts Stored'
            : `${contacts.length} Contact${contacts.length === 1 ? '' : 's'} Stored Locally`
        }
        variant="navy"
        showBack={true}
        onBack={() => router.push('/(tabs)/home')}
        rightAction={
          contacts.length > 0
            ? {
                icon: 'person-add',
                onPress: openAddModal,
              }
            : undefined
        }
      />

      <View style={styles.content}>
        {/* Device-Only Privacy Notice */}
        <View style={styles.privacyBanner}>
          <Ionicons name="shield-checkmark" size={18} color={Colors.success} />
          <View style={styles.privacyTextCol}>
            <Text style={styles.privacyBannerTitle}>100% DEVICE-ONLY STORAGE</Text>
            <Text style={styles.privacyBannerSub}>
              Contacts are saved locally on this device. No contact book access, no external uploads, and no calls or texts are made.
            </Text>
          </View>
        </View>

        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            contacts.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card
              variant="navy"
              style={styles.contactCard}
              accessible={true}
              accessibilityLabel={`Emergency contact: ${item.name}, relationship: ${item.relationship_label}, phone: ${item.phone_number}`}
            >
              <View style={styles.cardHeaderRow}>
                {/* Initials Avatar */}
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: item.avatar_color || Colors.navy[700] },
                  ]}
                  accessible={true}
                  accessibilityLabel={`Avatar for ${item.name}`}
                >
                  <Text style={styles.avatarText}>
                    {item.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>

                {/* Details */}
                <View style={styles.detailsCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.contactName}>{item.name}</Text>
                  </View>
                  <Text style={styles.contactRelation}>{item.relationship_label}</Text>
                </View>

                {/* Priority Badge */}
                <Badge
                  label={
                    item.priority_level === 'PRIMARY' || item.is_primary
                      ? 'PRIMARY'
                      : item.priority_level === 'HIGH'
                      ? 'HIGH'
                      : 'STANDARD'
                  }
                  variant={getPriorityBadgeVariant(item.priority_level, item.is_primary)}
                />
              </View>

              {/* Phone number row */}
              <View style={styles.phoneBox}>
                <Ionicons name="call" size={15} color={Colors.emergency.light} />
                <Text style={styles.phoneText}>{item.phone_number}</Text>
              </View>

              {/* Card Footer Actions */}
              <View style={styles.cardFooter}>
                {!(item.priority_level === 'PRIMARY' || item.is_primary) && (
                  <TouchableOpacity
                    onPress={() => updateContact(item.id, { priority_level: 'PRIMARY', is_primary: true })}
                    style={styles.setPrimaryBtn}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Set ${item.name} as primary contact`}
                  >
                    <Ionicons name="star-outline" size={14} color={Colors.slate400} />
                    <Text style={styles.setPrimaryText}>Set as Primary</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => openEditModal(item)}
                  style={styles.editBtn}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit contact ${item.name}`}
                >
                  <Ionicons name="create-outline" size={15} color={Colors.white} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmRemoveContact(item)}
                  style={styles.deleteBtn}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove contact ${item.name}`}
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.emergency.light} />
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={54} color={Colors.slate400} />
              </View>
              <Text style={styles.emptyTitle}>No Emergency Contacts Added</Text>
              <Text style={styles.emptySubtitle}>
                Add trusted family members, physicians, or friends manually to your emergency list. Your contacts are saved privately on this device.
              </Text>
              <Button
                title="Add Emergency Contact"
                variant="danger"
                size="lg"
                onPress={openAddModal}
                icon={<Ionicons name="person-add" size={18} color={Colors.white} />}
                style={styles.emptyAddBtn}
              />
              <Button
                title="Back to Home Dashboard"
                variant="outline"
                size="md"
                onPress={() => router.push('/(tabs)/home')}
                icon={<Ionicons name="arrow-back" size={16} color={Colors.white} />}
                textStyle={{ color: Colors.white }}
                accessibilityLabel="Back to Home Dashboard"
                style={{ marginTop: 12, width: '100%', maxWidth: 280 }}
              />
            </View>
          }
        />

        {/* Floating Add Contact Button when contacts exist */}
        {contacts.length > 0 && (
          <Button
            title="+ Add Emergency Contact"
            variant="danger"
            size="lg"
            onPress={openAddModal}
            icon={<Ionicons name="person-add" size={18} color={Colors.white} />}
            accessibilityLabel="Add New Emergency Contact"
            style={styles.floatingAddBtn}
          />
        )}
      </View>

      {/* ================================================================== */}
      {/* Add / Edit Contact Modal                                           */}
      {/* ================================================================== */}
      <Modal visible={modalVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.modalSafeContainer}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalCard}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {editingContact ? 'Edit Emergency Contact' : 'New Emergency Contact'}
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      Manual entry • Stored locally on this phone
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={Colors.white} />
                  </TouchableOpacity>
                </View>

                {/* Validation Error Banner */}
                {formError && (
                  <View style={styles.modalError}>
                    <Ionicons name="alert-circle" size={18} color={Colors.emergency.light} />
                    <Text style={styles.modalErrorText}>{formError}</Text>
                  </View>
                )}

                {/* 1. Name */}
                <Input
                  label="Contact Full Name *"
                  placeholder="e.g. Sarah Morgan"
                  icon="person-outline"
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (formError) setFormError(null);
                  }}
                />

                {/* 2. Phone */}
                <Input
                  label="Emergency Phone Number *"
                  placeholder="e.g. +1 (555) 234-5678 or 911"
                  icon="call-outline"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    if (formError) setFormError(null);
                  }}
                />

                {/* 3. Relationship Chips */}
                <Text style={styles.fieldSectionLabel}>RELATIONSHIP *</Text>
                <View style={styles.chipsRow}>
                  {RELATIONSHIP_OPTIONS.map((rel) => {
                    const isSelected = relationship === rel;
                    return (
                      <TouchableOpacity
                        key={rel}
                        onPress={() => {
                          setRelationship(rel);
                          if (formError) setFormError(null);
                        }}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {rel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* 4. Priority Level (Optional) */}
                <Text style={styles.fieldSectionLabel}>PRIORITY LEVEL (OPTIONAL)</Text>
                <View style={styles.priorityCardsCol}>
                  {PRIORITY_OPTIONS.map((opt) => {
                    const isSelected = priority === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => setPriority(opt.value)}
                        activeOpacity={0.8}
                        style={[
                          styles.priorityCard,
                          isSelected && styles.priorityCardSelected,
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={isSelected ? Colors.emergency.primary : Colors.slate400}
                        />
                        <View style={styles.priorityTextCol}>
                          <Text
                            style={[
                              styles.priorityLabel,
                              isSelected && styles.priorityLabelSelected,
                            ]}
                          >
                            {opt.label} Priority
                          </Text>
                          <Text style={styles.priorityDesc}>{opt.desc}</Text>
                        </View>
                        {opt.value === 'PRIMARY' && (
                          <Badge label="FIRST" variant="danger" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Privacy Guarantee Note */}
                <View style={styles.modalPrivacyNote}>
                  <Ionicons name="lock-closed" size={14} color={Colors.navy[500]} />
                  <Text style={styles.modalPrivacyText}>
                    Stored exclusively on your device storage. No contact book access or remote uploads.
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => setModalVisible(false)}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                  <Button
                    title={editingContact ? 'Save Changes' : 'Add Contact'}
                    variant="danger"
                    onPress={handleSaveContact}
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Privacy Banner
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  privacyTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  privacyBannerTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.success,
    letterSpacing: 0.8,
  },
  privacyBannerSub: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 2,
    lineHeight: 15,
  },

  listContent: {
    paddingBottom: 110,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  // Contact Cards
  contactCard: {
    padding: 16,
    marginBottom: 12,
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '900',
  },
  detailsCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
  },
  contactRelation: {
    fontSize: 12,
    color: Colors.slate400,
    marginTop: 2,
  },

  phoneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[900],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  phoneText: {
    fontSize: 13,
    color: Colors.white,
    marginLeft: 8,
    fontFamily: 'monospace',
    fontWeight: '700',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.navy[700],
  },
  setPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: Colors.navy[900],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  setPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.slate400,
    marginLeft: 4,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    padding: 6,
    backgroundColor: Colors.navy[900],
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  editBtnText: {
    fontSize: 12,
    color: Colors.white,
    marginLeft: 4,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  deleteBtnText: {
    fontSize: 12,
    color: Colors.emergency.light,
    marginLeft: 4,
    fontWeight: '700',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.navy[800],
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.navy[700],
    marginVertical: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.slate400,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  emptyAddBtn: {
    marginTop: 20,
    width: '100%',
    maxWidth: 280,
  },

  floatingAddBtn: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
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
    marginTop: 3,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 10,
  },
  modalError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
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

  fieldSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.slate400,
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.navy[800],
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  chipSelected: {
    backgroundColor: Colors.emergency.primary,
    borderColor: Colors.emergency.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.slate400,
  },
  chipTextSelected: {
    color: Colors.white,
  },

  priorityCardsCol: {
    gap: 8,
    marginBottom: 16,
  },
  priorityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[800],
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navy[700],
  },
  priorityCardSelected: {
    borderColor: Colors.emergency.primary,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  priorityTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  priorityLabelSelected: {
    color: Colors.emergency.light,
  },
  priorityDesc: {
    fontSize: 11,
    color: Colors.slate400,
    marginTop: 1,
  },

  modalPrivacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.navy[800],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalPrivacyText: {
    fontSize: 11,
    color: Colors.slate400,
    marginLeft: 6,
    flex: 1,
    lineHeight: 15,
  },

  modalActions: {
    flexDirection: 'row',
  },
});
