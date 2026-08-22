import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Colors from '../constants/Colors';
import { RideRequest } from '../types';
import { formatCurrency } from '../utils/helpers';

interface TripReceiptModalProps {
  visible: boolean;
  ride: RideRequest | null;
  viewerRole: 'passenger' | 'driver';
  onClose: () => void;
}

export const TripReceiptModal: React.FC<TripReceiptModalProps> = ({
  visible,
  ride,
  viewerRole,
  onClose,
}) => {
  if (!ride) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (durationMin?: number) => {
    if (!durationMin) return 'N/A';
    if (durationMin < 60) return `${durationMin} min`;
    const hours = Math.floor(durationMin / 60);
    const mins = durationMin % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Trip Receipt</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Status Badge */}
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, { backgroundColor: ride.status === 'completed' ? '#10B981' : '#EF4444' }]}>
                <Text style={styles.statusText}>{ride.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.rideId}>Ride ID: {ride.rideId}</Text>
            </View>

            {/* Date/Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Date & Time</Text>
              <Text style={styles.sectionValue}>{formatDate(ride.createdAt)}</Text>
            </View>

            {/* Route */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Route</Text>
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, { backgroundColor: '#10B981' }]} />
                <View style={styles.routeTextContainer}>
                  <Text style={styles.routeLabel}>Pickup</Text>
                  <Text style={styles.routeAddress}>{ride.pickup.label}</Text>
                </View>
              </View>
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, { backgroundColor: '#E91E63' }]} />
                <View style={styles.routeTextContainer}>
                  <Text style={styles.routeLabel}>Dropoff</Text>
                  <Text style={styles.routeAddress}>{ride.dropoff.label}</Text>
                </View>
              </View>
            </View>

            {/* Trip Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trip Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Distance</Text>
                <Text style={styles.detailValue}>{ride.distanceKm?.toFixed(2)} km</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{formatDuration(ride.durationMin)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vehicle Category</Text>
                <Text style={styles.detailValue}>{ride.vehicleCategory?.toUpperCase() || 'N/A'}</Text>
              </View>
            </View>

            {/* Fare Breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Fare Breakdown</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Initial Bid</Text>
                <Text style={styles.detailValue}>{formatCurrency(ride.initialBid)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Final Fare</Text>
                <Text style={[styles.detailValue, styles.finalFare]}>{formatCurrency(ride.currentFare)}</Text>
              </View>
            </View>

            {/* Driver/Passenger Info */}
            {viewerRole === 'passenger' && ride.driverName && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Driver Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{ride.driverName}</Text>
                </View>
                {ride.driverPhone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{ride.driverPhone}</Text>
                  </View>
                )}
                {ride.driverVehicle && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Vehicle</Text>
                    <Text style={styles.detailValue}>{ride.driverVehicle}</Text>
                  </View>
                )}
              </View>
            )}

            {viewerRole === 'driver' && ride.passengerName && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Passenger Information</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name</Text>
                  <Text style={styles.detailValue}>{ride.passengerName}</Text>
                </View>
                {ride.passengerPhone && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{ride.passengerPhone}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Payment Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Status</Text>
              <Text style={[styles.paymentStatus, { color: ride.status === 'completed' ? '#10B981' : '#F59E0B' }]}>
                {ride.status === 'completed' ? 'PAID' : 'PENDING'}
              </Text>
            </View>
          </ScrollView>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonTextBottom}>Close Receipt</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.light.text,
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rideId: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  section: {
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '700',
  },
  finalFare: {
    fontSize: 18,
    color: Colors.light.primary,
  },
  paymentStatus: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  closeButtonBottom: {
    backgroundColor: Colors.light.primary,
    margin: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonTextBottom: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
