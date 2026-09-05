import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import { signOutUser } from '../../firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionManager from '../../utils/sessionManager';

const DELETION_REASONS = [
  'No longer need the service',
  'Found a better alternative',
  'Privacy concerns',
  'Poor experience',
  'Technical issues',
  'Cost concerns',
  'Other',
];

export default function DeleteAccountScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { state, dispatch } = useApp();
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirmed) {
      Alert.alert('Confirmation Required', 'Please confirm that you want to delete your account.');
      return;
    }

    if (!selectedReason) {
      Alert.alert('Reason Required', 'Please select a reason for account deletion.');
      return;
    }

    if (selectedReason === 'Other' && !customReason.trim()) {
      Alert.alert('Details Required', 'Please provide details for your reason.');
      return;
    }

    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. Your account will be deactivated immediately and all your data will be permanently deleted within 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            const tokenToPurge = state.token;
            const reason = selectedReason === 'Other' ? customReason.trim() : selectedReason;

            // 1. Immediately reset in-memory state and redirect to Sign In screen
            dispatch({ type: 'LOGOUT' });

            // 2. Stop session monitoring & purge local storage keys
            sessionManager.stopSessionMonitoring();
            await AsyncStorage.multiRemove([
              '@shedrive_auth_token',
              '@shedrive_user_profile',
              'shedrive_token',
              'shedrive_user',
              '@shedrive_last_active_role',
              'user_session',
            ]).catch(() => {});

            // 3. Remote signout in background
            signOutUser().catch(() => {});

            // 4. Auto silently delete account and photos from Cloudinary and DB in background
            if (tokenToPurge) {
              fetch(`${getApiBaseUrl()}/user/delete-account`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${tokenToPurge}`,
                },
                body: JSON.stringify({ reason }),
              }).catch(() => {});
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      {/* Top Header with Back Navigation */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Delete Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Text style={styles.headerIcon}>⚠️</Text>
          </View>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <Text style={styles.headerSubtitle}>
            This action is permanent and cannot be undone
          </Text>
        </View>

      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>⚠️ Important Information</Text>
        <Text style={styles.warningText}>
          • Your account will be deactivated immediately
        </Text>
        <Text style={styles.warningText}>
          • All personal data will be permanently deleted within 30 days
        </Text>
        <Text style={styles.warningText}>
          • You will lose access to all ride history and account information
        </Text>
        <Text style={styles.warningText}>
          • You cannot restore your account after deletion
        </Text>
        <Text style={styles.warningText}>
          • Any active rides or pending payments will be cancelled
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeaderTitle}>Reason for Deletion</Text>
        <Text style={styles.cardSubtitle}>
          Please help us improve by letting us know why you're leaving
        </Text>

        <View style={styles.reasonsList}>
          {DELETION_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[
                styles.reasonOption,
                selectedReason === reason && styles.reasonOptionActive,
              ]}
              onPress={() => {
                setSelectedReason(reason);
                setCustomReason('');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.radioCircle}>
                {selectedReason === reason && <View style={styles.radioCircleActive} />}
              </View>
              <Text
                style={[
                  styles.reasonText,
                  selectedReason === reason && styles.reasonTextActive,
                ]}
              >
                {reason}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedReason === 'Other' && (
          <View style={styles.customReasonContainer}>
            <Text style={styles.label}>Please provide details</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Tell us more about your reason..."
              placeholderTextColor={Colors.light.textTertiary}
              value={customReason}
              onChangeText={setCustomReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isDeleting}
            />
          </View>
        )}
      </View>

      <View style={styles.confirmationCard}>
        <TouchableOpacity
          style={[styles.checkbox, confirmed && styles.checkboxActive]}
          onPress={() => setConfirmed(!confirmed)}
          activeOpacity={0.7}
        >
          {confirmed && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
        <Text style={styles.confirmationText}>
          I understand that this action is permanent and cannot be undone
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, (!confirmed || isDeleting) && styles.deleteButtonDisabled]}
        onPress={handleDeleteAccount}
        disabled={!confirmed || isDeleting}
        activeOpacity={0.8}
      >
        {isDeleting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.deleteButtonText}>Delete My Account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Text style={styles.cancelButtonText}>Keep My Account</Text>
      </TouchableOpacity>
    </ScrollView>
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.text,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.light.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.light.error,
  },
  headerIcon: {
    fontSize: 36,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    fontWeight: '500',
  },
  warningCard: {
    backgroundColor: Colors.light.errorLight,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.error,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.error,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.light.surface,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  reasonsList: {
    gap: 10,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  reasonOptionActive: {
    backgroundColor: Colors.light.errorLight,
    borderColor: Colors.light.error,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.light.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.error,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  reasonTextActive: {
    color: Colors.light.error,
  },
  customReasonContainer: {
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.light.text,
    minHeight: 100,
  },
  confirmationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.light.background,
    borderWidth: 2,
    borderColor: Colors.light.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  confirmationText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: Colors.light.error,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  cancelButtonText: {
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
