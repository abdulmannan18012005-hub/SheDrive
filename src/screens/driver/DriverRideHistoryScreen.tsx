import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { RideRequest } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { formatCurrency } from '../../utils/helpers';

export default function DriverRideHistoryScreen(): React.JSX.Element {
  const { state } = useApp();
  const user = state.user;

  const [history, setHistory] = useState<RideRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const ridesRef = collection(db, 'rides');
        const q = query(
          ridesRef,
          where('driverId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const list: RideRequest[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data() as RideRequest);
        });
        setHistory(list);
      } catch (error) {
        console.error('Error fetching driver ride history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

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

  const getStatusColor = (status: RideRequest['status']) => {
    switch (status) {
      case 'completed':
        return Colors.light.primary;
      case 'cancelled':
        return Colors.light.error;
      default:
        return Colors.light.textSecondary;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading trip history...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>No Completed Rides</Text>
          <Text style={styles.emptySubtitle}>Go online to start completing rides on SheDrive.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.rideId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.rideCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.routeContainer}>
                <Text style={styles.routeText} numberOfLines={1}>🟢 {item.pickup.label}</Text>
                <Text style={styles.routeText} numberOfLines={1}>🔴 {item.dropoff.label}</Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.passengerLabel}>
                  Passenger: {item.passengerName}
                </Text>
                <Text style={styles.fareText}>{formatCurrency(item.currentFare)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 36,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  listContent: {
    padding: 20,
    gap: 16,
  },
  rideCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    paddingBottom: 10,
  },
  dateText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeContainer: {
    gap: 8,
    marginBottom: 14,
  },
  routeText: {
    fontSize: 14,
    color: Colors.light.text,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
  },
  passengerLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  fareText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.primary,
  },
});
