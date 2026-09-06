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
import { LocationPoint, VehicleCategory, RideStop } from '../types';
import { formatCurrency } from '../utils/helpers';

interface Props {
  visible: boolean;
  pickup: LocationPoint;
  destination: LocationPoint;
  category: VehicleCategory;
  distanceKm: number;
  durationMin: number;
  estimatedFare: number;
  offeredFare: number;
  stops?: RideStop[];
  isScheduled?: boolean;
  scheduledFor?: number | null;
  paymentMethod?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const RideBookingSummaryModal: React.FC<Props> = ({
  visible,
  pickup,
  destination,
  category,
  distanceKm,
  durationMin,
  estimatedFare,
  offeredFare,
  stops = [],
  isScheduled = false,
  scheduledFor = null,
  paymentMethod = 'Cash on Arrival',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modalContent}>
          <ScrollView contentContainerStyle={styles.scrollBody}>
            <Text style={styles.modalTitle}>Confirm Booking Summary</Text>

            {/* Scheduled Booking Banner */}
            {isScheduled && scheduledFor && (
              <View style={{ backgroundColor: '#EEF2FF', padding: 12, borderRadius: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#C7D2FE' }}>
                <Text style={{ fontSize: 20 }}>🕒</Text>
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4338CA', textTransform: 'uppercase' }}>Scheduled Departure</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E1B4B' }}>{new Date(scheduledFor).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                </View>
              </View>
            )}

            {/* Vehicle Tier Badge */}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <View>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCapacity}>👥 {category.capacity} Passenger Capacity</Text>
              </View>
            </View>

            {/* Locations Summary */}
            <View style={styles.cardSection}>
              <View style={styles.locationRow}>
                <Text style={styles.dot}>🟢</Text>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabel}>PICKUP</Text>
                  <Text style={styles.locationValue} numberOfLines={1}>{pickup.label}</Text>
                </View>
              </View>

              {/* Intermediate Stops */}
              {stops && stops.length > 0 && stops.map((stop, idx) => (
                <React.Fragment key={stop.id || `stop-${idx}`}>
                  <View style={styles.locationDivider} />
                  <View style={styles.locationRow}>
                    <Text style={styles.dot}>🟡</Text>
                    <View style={styles.locationTextContainer}>
                      <Text style={styles.locationLabel}>STOP #{idx + 1}</Text>
                      <Text style={styles.locationValue} numberOfLines={1}>{stop.label}</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}

              <View style={styles.locationDivider} />
              <View style={styles.locationRow}>
                <Text style={styles.dot}>🔴</Text>
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabel}>DESTINATION</Text>
                  <Text style={styles.locationValue} numberOfLines={1}>{destination.label}</Text>
                </View>
              </View>
            </View>

            {/* Metrics */}
            <View style={styles.metricsRow}>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Distance</Text>
                <Text style={styles.metricValue}>{distanceKm.toFixed(1)} km</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Est. Duration</Text>
                <Text style={styles.metricValue}>{Math.round(durationMin)} mins</Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricLabel}>Payment</Text>
                <Text style={styles.metricValue}>{paymentMethod}</Text>
              </View>
            </View>

            {/* Fare Breakdown */}
            <View style={styles.fareBreakdownCard}>
              <View style={styles.fareRow}>
                <Text style={styles.fareRowLabel}>Recommended Fare</Text>
                <Text style={styles.fareRowVal}>{formatCurrency(estimatedFare)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.fareRowTotal}>
                <Text style={styles.totalLabel}>Your Offered Fare</Text>
                <Text style={styles.totalValue}>{formatCurrency(offeredFare)}</Text>
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onCancel}
                disabled={isLoading}
              >
                <Text style={styles.cancelBtnText}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={onConfirm}
                disabled={isLoading}
              >
                <Text style={styles.confirmBtnText}>
                  {isLoading ? 'Sending Request...' : 'Request Safety Ride'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Verified Guarantee Badge */}
            <View style={styles.guaranteeBadge}>
              <Text style={styles.guaranteeIcon}>🛡️</Text>
              <Text style={styles.guaranteeText}>Verified Female Driver Guarantee</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  scrollBody: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primaryGhost,
    padding: 14,
    borderRadius: 16,
    gap: 14,
    marginBottom: 16,
  },
  categoryIcon: {
    fontSize: 32,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  categoryCapacity: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  cardSection: {
    backgroundColor: Colors.light.background,
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    fontSize: 14,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.light.textTertiary,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  locationDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 10,
    marginLeft: 26,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.light.background,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  fareBreakdownCard: {
    backgroundColor: Colors.light.background,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fareRowLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  fareRowVal: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  fareRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.textOnPrimary,
    letterSpacing: 0.3,
  },
  guaranteeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCEFEF',
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F8BBD0',
  },
  guaranteeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  guaranteeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6A1B9A',
  },
});
