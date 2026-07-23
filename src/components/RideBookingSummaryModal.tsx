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
import { LocationPoint, VehicleCategory } from '../types';
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
                <Text style={styles.fareRowLabel}>Category Minimum Fare</Text>
                <Text style={styles.fareRowVal}>{formatCurrency(category.minimumFare)}</Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareRowLabel}>Standard Est. Fare</Text>
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
                  {isLoading ? 'Sending...' : 'Confirm & Book'}
                </Text>
              </TouchableOpacity>
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
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.textOnPrimary,
  },
});
