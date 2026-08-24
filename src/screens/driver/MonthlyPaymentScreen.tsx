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
  Image,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';

interface PaymentHistoryItem {
  month_year: string;
  total_rides: number;
  total_earnings: number;
  platform_fee: number;
  status: 'pending' | 'submitted' | 'paid' | 'overdue' | 'rejected';
  transaction_id?: string;
  receipt_url?: string;
  submitted_at?: number;
}

export default function MonthlyPaymentScreen(): React.JSX.Element {
  const { state } = useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Month state
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  // Fee Details
  const [totalRides, setTotalRides] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
  const [status, setStatus] = useState<'pending' | 'submitted' | 'paid' | 'overdue' | 'rejected'>('pending');
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);

  // Submission Form State
  const [transactionId, setTransactionId] = useState('');
  const [receiptImageUri, setReceiptImageUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  useEffect(() => {
    fetchMonthlyFeeInfo();
  }, [selectedMonth]);

  // Live countdown timer ticker
  useEffect(() => {
    if (countdownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownSeconds]);

  const fetchMonthlyFeeInfo = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/payments/driver/monthly?month=${selectedMonth}`, {
        headers: {
          Authorization: `Bearer ${state.token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Error', data.error || 'Failed to fetch monthly platform fee information');
        return;
      }

      setTotalRides(data.totalRides || 0);
      setTotalEarnings(data.totalEarnings || 0);
      setPlatformFee(data.platformFee || 0);
      setStatus(data.status || 'pending');
      setCountdownSeconds(data.countdownSeconds || 0);
      setBankDetails(data.bankDetails || null);
      setHistory(data.history || []);
      setTransactionId(data.transactionId || '');
      setReceiptImageUri(data.receiptUrl || null);
      setAdminNotes(data.adminNotes || '');
    } catch (err: any) {
      console.error('Fetch monthly fee error:', err);
      Alert.alert('Network Error', 'Unable to connect to server. Please check your internet connection.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handlePickReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery permission is required to upload payment receipts.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.base64) {
          setReceiptImageUri(`data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          setReceiptImageUri(asset.uri);
        }
      }
    } catch (err: any) {
      console.error('Pick receipt image error:', err);
      Alert.alert('Error', 'Failed to pick receipt image');
    }
  };

  const handleSubmitPayment = async () => {
    if (!transactionId.trim()) {
      Alert.alert('Transaction ID Required', 'Please enter the transaction reference / TID number.');
      return;
    }

    if (!receiptImageUri) {
      Alert.alert('Receipt Screenshot Required', 'Please upload a photo or screenshot of your payment receipt.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch(`${getApiBaseUrl()}/payments/driver/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({
          monthYear: selectedMonth,
          transactionId: transactionId.trim(),
          receiptUrl: receiptImageUri,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert('Submission Failed', data.error || 'Failed to submit payment proof.');
        return;
      }

      Alert.alert('Payment Submitted! 🚀', data.message || 'Payment proof submitted for admin review.');
      fetchMonthlyFeeInfo();
    } catch (err: any) {
      console.error('Submit payment error:', err);
      Alert.alert('Network Error', 'Failed to submit payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format countdown seconds into readable String (Days, Hours, Mins)
  const formatCountdown = (secs: number) => {
    if (secs <= 0) return 'OVERDUE';
    const days = Math.floor(secs / (3600 * 24));
    const hours = Math.floor((secs % (3600 * 24)) / 3600);
    const minutes = Math.floor((secs % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m Left`;
    return `${hours}h ${minutes}m Left`;
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'paid':
        return { text: '✓ PAID', style: styles.badgePaid };
      case 'submitted':
        return { text: '⏳ UNDER REVIEW', style: styles.badgeSubmitted };
      case 'rejected':
        return { text: '❌ REJECTED', style: styles.badgeRejected };
      case 'overdue':
        return { text: '⚠️ OVERDUE', style: styles.badgeOverdue };
      default:
        return { text: '💳 PENDING', style: styles.badgePending };
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            fetchMonthlyFeeInfo();
          }}
          tintColor={Colors.light.primary}
        />
      }
    >
      {/* Header Banner */}
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Text style={styles.headerIcon}>💳</Text>
        </View>
        <Text style={styles.headerTitle}>Monthly Platform Fee</Text>
        <Text style={styles.headerSubtitle}>
          SheDrive operates on a platform fee calculated on your completed monthly rides.
        </Text>
      </View>

      {/* Month Selector Pills */}
      <View style={styles.monthSelector}>
        <TouchableOpacity
          style={[styles.monthPill, selectedMonth === currentMonthStr && styles.monthPillActive]}
          onPress={() => setSelectedMonth(currentMonthStr)}
        >
          <Text style={[styles.monthPillText, selectedMonth === currentMonthStr && styles.monthPillTextActive]}>
            Current Month ({currentMonthStr})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Calculating monthly earnings &amp; platform fee...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* Status & Countdown Banner */}
          <View
            style={[
              styles.statusCard,
              status === 'paid' && styles.statusCardPaid,
              status === 'submitted' && styles.statusCardSubmitted,
              (status === 'overdue' || status === 'rejected') && styles.statusCardAlert,
            ]}
          >
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Payment Status:</Text>
              <View style={[styles.badge, getStatusBadge(status).style]}>
                <Text style={styles.badgeText}>{getStatusBadge(status).text}</Text>
              </View>
            </View>

            {status === 'paid' && (
              <Text style={styles.statusDescription}>
                Thank you! Your platform fee for {selectedMonth} has been verified and marked as Paid. You are fully authorized to go online.
              </Text>
            )}

            {status === 'submitted' && (
              <Text style={styles.statusDescription}>
                Your payment receipt is currently under review by SheDrive Admin. Verification typically takes less than 24 hours.
              </Text>
            )}

            {status === 'rejected' && (
              <View>
                <Text style={styles.statusDescriptionAlert}>
                  Your payment submission was rejected by Admin.
                </Text>
                {adminNotes ? <Text style={styles.adminNotesText}>Reason: {adminNotes}</Text> : null}
                <Text style={styles.statusDescriptionAlertSub}>Please re-verify your transaction receipt and re-submit below.</Text>
              </View>
            )}

            {(status === 'pending' || status === 'overdue') && (
              <View style={styles.countdownRow}>
                <Text style={styles.countdownTitle}>Due Date Countdown:</Text>
                <Text style={[styles.countdownValue, status === 'overdue' && styles.countdownOverdue]}>
                  ⏰ {formatCountdown(countdownSeconds)}
                </Text>
              </View>
            )}
          </View>

          {/* Earnings & Fee Summary Metrics */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricIcon}>🚗</Text>
              <Text style={styles.metricValue}>{totalRides}</Text>
              <Text style={styles.metricLabel}>Completed Rides</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricIcon}>💰</Text>
              <Text style={styles.metricValue}>PKR {totalEarnings.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Total Earnings</Text>
            </View>

            <View style={[styles.metricCard, styles.metricCardPrimary]}>
              <Text style={styles.metricIcon}>📊</Text>
              <Text style={styles.metricValuePrimary}>PKR {platformFee.toLocaleString()}</Text>
              <Text style={styles.metricLabelPrimary}>Platform Fee</Text>
            </View>
          </View>

          {/* Bank / Transfer Instructions */}
          {bankDetails && (
            <View style={styles.bankCard}>
              <Text style={styles.cardSectionTitle}>🏦 Official Transfer Instructions</Text>
              <Text style={styles.bankInstructions}>{bankDetails.instructions}</Text>
              
              <View style={styles.bankDetailRow}>
                <Text style={styles.bankDetailLabel}>Bank / Wallet:</Text>
                <Text style={styles.bankDetailValue}>{bankDetails.bankName}</Text>
              </View>

              <View style={styles.bankDetailRow}>
                <Text style={styles.bankDetailLabel}>Account Title:</Text>
                <Text style={styles.bankDetailValue}>{bankDetails.accountTitle}</Text>
              </View>

              <View style={styles.bankDetailRow}>
                <Text style={styles.bankDetailLabel}>Account Number / IBAN:</Text>
                <Text style={styles.bankDetailValueHighlight}>{bankDetails.accountNumber}</Text>
              </View>
            </View>
          )}

          {/* Payment Proof Submission Form (If Pending, Overdue, or Rejected) */}
          {(status === 'pending' || status === 'overdue' || status === 'rejected') && (
            <View style={styles.formCard}>
              <Text style={styles.cardSectionTitle}>📲 Submit Payment Proof</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Transaction Reference ID (TID / Ref #) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 987654321012"
                  placeholderTextColor={Colors.light.textTertiary}
                  value={transactionId}
                  onChangeText={setTransactionId}
                  editable={!isSubmitting}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Payment Receipt Screenshot *</Text>
                {receiptImageUri ? (
                  <View style={styles.receiptPreviewBox}>
                    <TouchableOpacity onPress={() => setPreviewImageModal(receiptImageUri)}>
                      <Image source={{ uri: receiptImageUri }} style={styles.receiptImage} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.repickButton} onPress={handlePickReceipt}>
                      <Text style={styles.repickText}>📷 Change Screenshot</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadButton} onPress={handlePickReceipt}>
                    <Text style={styles.uploadButtonIcon}>🖼️</Text>
                    <Text style={styles.uploadButtonText}>Upload Receipt Screenshot</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Optional Notes</Text>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  placeholder="Add any details for the SheDrive billing team..."
                  placeholderTextColor={Colors.light.textTertiary}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  editable={!isSubmitting}
                />
              </View>

              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitPayment}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.light.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Payment Proof</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Payment History List */}
          {history.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.cardSectionTitle}>📜 Payment History</Text>
              {history.map((item, idx) => (
                <View key={idx} style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyMonth}>{item.month_year}</Text>
                    <Text style={styles.historyRides}>{item.total_rides} rides • PKR {item.total_earnings.toLocaleString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.historyFee}>PKR {item.platform_fee.toLocaleString()}</Text>
                    <View style={[styles.badge, getStatusBadge(item.status).style, { marginTop: 4 }]}>
                      <Text style={[styles.badgeText, { fontSize: 10 }]}>{getStatusBadge(item.status).text}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Image Preview Modal */}
      <Modal visible={!!previewImageModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {previewImageModal && <Image source={{ uri: previewImageModal }} style={styles.modalImage} resizeMode="contain" />}
          <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPreviewImageModal(null)}>
            <Text style={styles.modalCloseText}>Close Preview</Text>
          </TouchableOpacity>
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
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  headerIcon: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  monthPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  monthPillActive: {
    backgroundColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  monthPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  monthPillTextActive: {
    color: '#FFFFFF',
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  content: {
    paddingHorizontal: 20,
  },
  statusCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 18,
  },
  statusCardPaid: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  statusCardSubmitted: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  statusCardAlert: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgePaid: { backgroundColor: '#10B981' },
  badgeSubmitted: { backgroundColor: '#F59E0B' },
  badgeRejected: { backgroundColor: '#EF4444' },
  badgeOverdue: { backgroundColor: '#DC2626' },
  badgePending: { backgroundColor: '#3B82F6' },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statusDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },
  statusDescriptionAlert: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  statusDescriptionAlertSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  adminNotesText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
    marginTop: 4,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  countdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  countdownValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  countdownOverdue: {
    color: '#DC2626',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  metricCardPrimary: {
    backgroundColor: Colors.light.primaryGhost,
    borderColor: Colors.light.primary,
  },
  metricIcon: { fontSize: 24, marginBottom: 6 },
  metricValue: { fontSize: 16, fontWeight: '800', color: Colors.light.text },
  metricValuePrimary: { fontSize: 16, fontWeight: '800', color: Colors.light.primary },
  metricLabel: { fontSize: 11, color: Colors.light.textSecondary, marginTop: 4, fontWeight: '600' },
  metricLabelPrimary: { fontSize: 11, color: Colors.light.primary, marginTop: 4, fontWeight: '700' },
  bankCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 18,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 10,
  },
  bankInstructions: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  bankDetailLabel: { fontSize: 13, color: Colors.light.textSecondary, fontWeight: '600' },
  bankDetailValue: { fontSize: 13, color: Colors.light.text, fontWeight: '700' },
  bankDetailValueHighlight: { fontSize: 13, color: Colors.light.primary, fontWeight: '800' },
  formCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 18,
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
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
  uploadButton: {
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonIcon: { fontSize: 24, marginBottom: 4 },
  uploadButtonText: { fontSize: 14, fontWeight: '700', color: Colors.light.primary },
  receiptPreviewBox: {
    alignItems: 'center',
  },
  receiptImage: {
    width: 140,
    height: 140,
    borderRadius: 14,
    marginBottom: 8,
  },
  repickButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  repickText: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  historySection: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  historyMonth: { fontSize: 14, fontWeight: '800', color: Colors.light.text },
  historyRides: { fontSize: 12, color: Colors.light.textSecondary, marginTop: 2 },
  historyFee: { fontSize: 14, fontWeight: '800', color: Colors.light.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalImage: {
    width: '100%',
    height: '75%',
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalCloseText: {
    color: '#000000',
    fontWeight: '800',
  },
});
