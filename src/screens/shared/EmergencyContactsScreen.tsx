import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  createdAt: number;
}

export default function EmergencyContactsScreen(): React.JSX.Element {
  const { state } = useApp();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Family');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetchEmergencyContacts();
  }, []);

  const fetchEmergencyContacts = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/user/emergency-contacts`, {
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to fetch emergency contacts');
        return;
      }

      setContacts(data.contacts || []);
    } catch (err: any) {
      console.error('Fetch emergency contacts error:', err);
      Alert.alert('Network Error', 'Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Required Fields', 'Please enter Contact Name and Phone Number.');
      return;
    }

    if (contacts.length >= 5) {
      Alert.alert('Maximum Limit Reached', 'You can add up to 5 emergency contacts.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${getApiBaseUrl()}/user/emergency-contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          relationship: relationship.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to add contact');
        return;
      }

      Alert.alert('Contact Added', 'Emergency contact added successfully.');
      setName('');
      setPhone('');
      setRelationship('Family');
      setModalVisible(false);
      fetchEmergencyContacts();
    } catch (err: any) {
      console.error('Add contact error:', err);
      Alert.alert('Error', 'Failed to add emergency contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = (id: string, contactName: string) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to remove ${contactName} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${getApiBaseUrl()}/user/emergency-contacts/${id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${state.token}`,
                },
              });

              if (res.ok) {
                setContacts((prev) => prev.filter((c) => c.id !== id));
              }
            } catch (err: any) {
              Alert.alert('Error', 'Failed to delete contact');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerIcon}>🚨</Text>
        </View>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <Text style={styles.headerSubtitle}>
          Add up to 5 trusted emergency contacts. In an emergency, tapping the SOS button will automatically alert them with your live GPS location.
        </Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Saved Contacts ({contacts.length}/5)
          </Text>
          {contacts.length < 5 && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>+ Add Contact</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.light.primary} />
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Emergency Contacts Added</Text>
            <Text style={styles.emptySubtitle}>
              Please add at least 1 emergency contact (father, sister, spouse, mother, or friend) for your safety during rides.
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { marginTop: 14 }]}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.addButtonText}>+ Add Emergency Contact</Text>
            </TouchableOpacity>
          </View>
        ) : (
          contacts.map((c) => (
            <View key={c.id} style={styles.contactCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{c.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{c.name}</Text>
                <Text style={styles.contactPhone}>📱 {c.phone}</Text>
                <View style={styles.relationBadge}>
                  <Text style={styles.relationText}>{c.relationship}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteContact(c.id, c.name)}
              >
                <Text style={styles.deleteIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Add Contact Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Emergency Contact</Text>
            <Text style={styles.modalSubtitle}>Enter details of your trusted contact person.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Fatima Ali"
                placeholderTextColor={Colors.light.textTertiary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Relationship *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sister / Mother / Father / Spouse"
                placeholderTextColor={Colors.light.textTertiary}
                value={relationship}
                onChangeText={setRelationship}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 03001234567"
                placeholderTextColor={Colors.light.textTertiary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddContact}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Save Contact</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  headerIcon: { fontSize: 32 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 18 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  addButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  loadingBox: { paddingVertical: 40 },
  emptyCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: Colors.light.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center', lineHeight: 18 },
  contactCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarLetter: { fontSize: 20, fontWeight: '800', color: Colors.light.primary },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  contactPhone: { fontSize: 13, color: Colors.light.textSecondary, marginTop: 2, fontWeight: '500' },
  relationBadge: {
    backgroundColor: Colors.light.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  relationText: { fontSize: 11, fontWeight: '700', color: Colors.light.primary },
  deleteButton: { padding: 8 },
  deleteIcon: { fontSize: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.light.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 18 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.light.text, marginBottom: 6 },
  input: {
    backgroundColor: Colors.light.background,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.light.text,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: Colors.light.border },
  cancelText: { fontSize: 14, fontWeight: '700', color: Colors.light.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: Colors.light.primary },
  saveText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
