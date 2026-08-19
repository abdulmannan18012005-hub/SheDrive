import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Colors from '../constants/Colors';
import { DriverProfile } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  driverProfile: DriverProfile | null;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | string;
  rejectionReason?: string;
  onRefresh?: () => void;
}

export const DriverVerificationStatusModal: React.FC<Props> = ({
  visible,
  onClose,
  driverProfile,
  verificationStatus = 'pending',
  rejectionReason,
  onRefresh,
}) => {
  const isApproved = verificationStatus === 'approved' || driverProfile?.isVerified;
  const isRejected = verificationStatus === 'rejected';

  // Determine individual document completion
  const hasCnic = Boolean(driverProfile?.cnicFrontUrl && driverProfile?.cnicBackUrl);
  const hasLicense = Boolean(driverProfile?.licenseFrontUrl && driverProfile?.licenseBackUrl);
  const hasVehicle = Boolean(driverProfile?.vehicleInfo?.make && driverProfile?.vehicleInfo?.plate);

  const steps = [
    {
      id: 1,
      title: 'Identity Verification (CNIC)',
      subtitle: hasCnic ? 'CNIC Front & Back Submitted' : 'Upload your National ID Card',
      isCompleted: hasCnic,
      isActive: !hasCnic,
    },
    {
      id: 2,
      title: 'Driving License Verification',
      subtitle: hasLicense ? 'Valid License Submitted' : 'Upload official Driving License',
      isCompleted: hasLicense,
      isActive: hasCnic && !hasLicense,
    },
    {
      id: 3,
      title: 'Vehicle & Safety Details',
      subtitle: hasVehicle ? `${driverProfile?.vehicleInfo?.make || 'Vehicle'} - ${driverProfile?.vehicleInfo?.plate || 'Active'}` : 'Submit Vehicle Model & Plate',
      isCompleted: hasVehicle,
      isActive: hasCnic && hasLicense && !hasVehicle,
    },
    {
      id: 4,
      title: 'Admin Verification & Activation',
      subtitle: isApproved
        ? 'Account Approved & Active'
        : isRejected
        ? `Action Required: ${rejectionReason || 'Documents need resubmission'}`
        : 'Under review by SheDrive Operations Team',
      isCompleted: isApproved,
      isActive: !isApproved && !isRejected && hasCnic && hasLicense && hasVehicle,
      isError: isRejected,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Verification Status</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.iconCircle}>
                <Text style={styles.heroIcon}>{isApproved ? '✅' : isRejected ? '⚠️' : '🔍'}</Text>
              </View>

              <Text style={styles.heroTitle}>
                {isApproved
                  ? 'Account Verified'
                  : isRejected
                  ? 'Action Required'
                  : 'Verification in Progress'}
              </Text>

              <Text style={styles.heroSubtitle}>
                {isApproved
                  ? 'Congratulations! You are officially verified to accept rides on SheDrive.'
                  : isRejected
                  ? (rejectionReason || 'Some documents did not pass verification standards. Please resubmit them.')
                  : "We're reviewing your submitted credentials. This typically completes within 24 hours."}
              </Text>

              {!isApproved && (
                <View style={styles.estimateBadge}>
                  <Text style={styles.estimateIcon}>⏱️</Text>
                  <Text style={styles.estimateText}>Estimated Review: Within 24 Hours</Text>
                </View>
              )}
            </View>

            {/* Stepper Section */}
            <Text style={styles.sectionHeading}>VERIFICATION STEPS</Text>

            <View style={styles.stepsContainer}>
              {steps.map((step, index) => {
                const isLast = index === steps.length - 1;

                return (
                  <View key={step.id} style={styles.stepItem}>
                    {/* Left Indicator & Connecting Line */}
                    <View style={styles.indicatorCol}>
                      <View
                        style={[
                          styles.stepDot,
                          step.isCompleted && styles.stepDotCompleted,
                          step.isActive && styles.stepDotActive,
                          step.isError && styles.stepDotError,
                        ]}
                      >
                        {step.isCompleted ? (
                          <Text style={styles.checkIcon}>✓</Text>
                        ) : step.isError ? (
                          <Text style={styles.errorIcon}>!</Text>
                        ) : step.isActive ? (
                          <View style={styles.innerDot} />
                        ) : (
                          <Text style={styles.pendingNum}>{step.id}</Text>
                        )}
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.connectorLine,
                            step.isCompleted && styles.connectorLineCompleted,
                          ]}
                        />
                      )}
                    </View>

                    {/* Right Content */}
                    <View style={styles.stepContent}>
                      <Text
                        style={[
                          styles.stepTitle,
                          step.isCompleted && styles.stepTitleCompleted,
                          step.isError && styles.stepTitleError,
                        ]}
                      >
                        {step.title}
                      </Text>
                      <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Bottom Notification Notice */}
            <View style={styles.bottomNotice}>
              <Text style={styles.noticeIcon}>ℹ️</Text>
              <Text style={styles.noticeText}>
                We'll notify you via push notification & SMS as soon as your account is approved.
              </Text>
            </View>

            {/* Action Button */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => {
                if (onRefresh) onRefresh();
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.doneButtonText}>{isApproved ? 'Go to Driver Home' : 'Got it'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FAFAFA',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#4A2060',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  scrollBody: {
    padding: 20,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FCEFEF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F8BBD0',
  },
  heroIcon: {
    fontSize: 32,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4A2060',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  estimateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F9',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFD1E3',
  },
  estimateIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  estimateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2060',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4A2060',
    letterSpacing: 0.8,
    marginBottom: 16,
    marginLeft: 4,
  },
  stepsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    minHeight: 64,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 32,
    marginRight: 14,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  stepDotActive: {
    borderColor: '#4A2060',
    backgroundColor: '#FFFFFF',
  },
  stepDotError: {
    borderColor: '#EF4444',
    backgroundColor: '#EF4444',
  },
  innerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4A2060',
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  errorIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pendingNum: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E9E9E',
  },
  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  connectorLineCompleted: {
    backgroundColor: '#10B981',
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 16,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepTitleCompleted: {
    color: '#065F46',
  },
  stepTitleError: {
    color: '#B91C1C',
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  bottomNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    marginBottom: 20,
  },
  noticeIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#4A2060',
    fontWeight: '600',
    lineHeight: 16,
  },
  doneButton: {
    backgroundColor: '#4A2060',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#4A2060',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
