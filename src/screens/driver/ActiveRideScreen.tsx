import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { doc, onSnapshot, updateDoc, collection, addDoc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../config/firebaseConfig';
import { DriverStackParamList, RideRequest } from '../../types';
import Colors from '../../constants/Colors';
import { formatCurrency } from '../../utils/helpers';
import { LeafletMap, LeafletMapRef, MapMarker } from '../../components/LeafletMap';
import { triggerEmergencySOS } from '../../utils/safety';
import { useApp } from '../../contexts/AppContext';

type ActiveRideScreenNavigationProp = StackNavigationProp<DriverStackParamList, 'ActiveRide'>;
type ActiveRideScreenRouteProp = RouteProp<DriverStackParamList, 'ActiveRide'>;

interface Props {
  navigation: ActiveRideScreenNavigationProp;
  route: ActiveRideScreenRouteProp;
}

export default function ActiveRideScreen({ navigation, route }: Props): React.JSX.Element {
  const { rideId } = route.params;
  const { state } = useApp();
  const [ride, setRide] = useState<RideRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [driverCoords, setDriverCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRatingValue] = useState(5);
  const [comment, setComment] = useState('');

  const mapRef = useRef<LeafletMapRef>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

  // Subscribe to ride updates in real-time
  useEffect(() => {
    const rideRef = doc(db, 'rides', rideId);

    const unsubscribe = onSnapshot(
      rideRef,
      (docSnapshot) => {
        if (!docSnapshot.exists()) {
          Alert.alert('Error', 'Active ride record not found.');
          navigation.navigate('DriverHome');
          return;
        }

        const rideData = docSnapshot.data() as RideRequest;
        setRide(rideData);
        setIsLoading(false);

        // If cancelled by passenger, clean up and return home
        if (rideData.status === 'cancelled') {
          Alert.alert('Ride Cancelled', 'The passenger has cancelled this ride request.');
          navigation.navigate('DriverHome');
        }
      },
      (error) => {
        console.error('Subscription to active ride updates failed:', error);
      }
    );

    return () => {
      unsubscribe();
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
      }
    };
  }, [rideId]);

  // Track driver's GPS location and sync to ride document coordinates
  useEffect(() => {
    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 4000,
            distanceInterval: 4,
          },
          async (newLocation) => {
            const { latitude, longitude } = newLocation.coords;
            setDriverCoords({ latitude, longitude });

            // Sync driver location inside the ride document
            const rideRef = doc(db, 'rides', rideId);
            await updateDoc(rideRef, {
              driverCoords: { latitude, longitude },
              updatedAt: Date.now(),
            });

            // Keep map centering on driver coords
            if (mapRef.current) {
              mapRef.current.setCenter(latitude, longitude);
            }
          }
        );

        locationWatcherRef.current = watcher;
      } catch (err) {
        console.warn('Driver tracking initialization failed:', err);
      }
    };

    if (!isLoading && ride) {
      startTracking();
    }
  }, [isLoading]);

  const handleAdvanceStatus = async () => {
    if (!ride) return;

    let nextStatus: RideRequest['status'];
    let statusAlertTitle = '';
    let statusAlertMsg = '';

    switch (ride.status) {
      case 'accepted':
        nextStatus = 'arrived';
        statusAlertTitle = 'Arrived at Pickup';
        statusAlertMsg = 'Confirming arrival. Passenger has been notified.';
        break;
      case 'arrived':
        nextStatus = 'enroute';
        statusAlertTitle = 'Start Ride';
        statusAlertMsg = 'Starting ride route to dropoff destination.';
        break;
      case 'enroute':
        nextStatus = 'completed';
        statusAlertTitle = 'Complete Ride';
        statusAlertMsg = 'Arrived at destination. Trip marked as completed.';
        break;
      default:
        return;
    }

    try {
      setIsUpdatingStatus(true);
      const rideRef = doc(db, 'rides', rideId);

      await updateDoc(rideRef, {
        status: nextStatus,
        updatedAt: Date.now(),
      });

      Alert.alert(statusAlertTitle, statusAlertMsg);

      // If ride is completed, open rating review modal
      if (nextStatus === 'completed') {
        setShowRatingModal(true);
      }
    } catch (error) {
      console.error('Failed to update ride status:', error);
      Alert.alert('Status Error', 'Could not update ride status. Please check connection.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSubmitRating = async (ratingVal: number, ratingComment: string) => {
    if (!ride) return;
    try {
      setIsUpdatingStatus(true);
      // Save rating record to Firestore
      const ratingCollectionRef = collection(db, 'ratings');
      await addDoc(ratingCollectionRef, {
        rideId: ride.rideId,
        fromUserId: ride.driverId || '',
        toUserId: ride.passengerId,
        rating: ratingVal,
        comment: ratingComment,
        createdAt: Date.now(),
      });

      Alert.alert('Success', 'Rating submitted.');
      setShowRatingModal(false);
      navigation.navigate('DriverHome');
    } catch (err) {
      console.warn('Failed to submit rating:', err);
      setShowRatingModal(false);
      navigation.navigate('DriverHome');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCallPassenger = () => {
    if (!ride?.passengerPhone) return;
    Linking.openURL(`tel:${ride.passengerPhone}`).catch(() => {
      Alert.alert('Calling Failed', 'Device dialer cannot be launched.');
    });
  };

  // Convert polyline string coordinates back to Leaflet-compatible array
  const getLeafletCoordinates = (): [number, number][] => {
    if (!ride || !ride.polyline) return [];
    try {
      const coords: [number, number][] = JSON.parse(ride.polyline);
      return coords.map((coord) => [coord[1], coord[0]]);
    } catch {
      return [];
    }
  };

  const getMapMarkers = (): MapMarker[] => {
    if (!ride) return [];
    const markers: MapMarker[] = [
      { id: 'pickup', lat: ride.pickup.latitude, lng: ride.pickup.longitude, emoji: '🟢', title: 'Pickup point' },
      { id: 'destination', lat: ride.dropoff.latitude, lng: ride.dropoff.longitude, emoji: '🔴', title: 'Dropoff point' },
    ];

    if (driverCoords) {
      markers.push({
        id: 'driver',
        lat: driverCoords.latitude,
        lng: driverCoords.longitude,
        emoji: '🚗',
        title: 'My Position',
      });
    }

    return markers;
  };

  const getActionButtonText = () => {
    if (!ride) return '';
    switch (ride.status) {
      case 'accepted':
        return "I've Arrived at Pickup";
      case 'arrived':
        return 'Start Ride';
      case 'enroute':
        return 'Complete Ride';
      default:
        return '';
    }
  };

  if (isLoading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading ride tracking route...</Text>
      </View>
    );
  }

  const defaultCenter = driverCoords
    ? { lat: driverCoords.latitude, lng: driverCoords.longitude }
    : { lat: ride.pickup.latitude, lng: ride.pickup.longitude };

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Preview */}
      <View style={styles.mapPreview}>
        <LeafletMap
          ref={mapRef}
          center={defaultCenter}
          markers={getMapMarkers()}
          routeCoordinates={getLeafletCoordinates()}
        />
      </View>

      <ScrollView style={styles.detailsCard}>
        {/* Status Tracker */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusLabel}>
            {ride.status === 'accepted' && '🚗 Driving to passenger pickup point'}
            {ride.status === 'arrived' && '📍 Waiting for passenger to enter vehicle'}
            {ride.status === 'enroute' && '🌟 Driving to dropoff destination'}
          </Text>
        </View>

        {/* Passenger Information */}
        <View style={styles.passengerCard}>
          <View style={styles.passengerRow}>
            <View style={styles.passengerMeta}>
              <Text style={styles.passengerName}>Passenger: {ride.passengerName}</Text>
              <Text style={styles.routeText} numberOfLines={1}>🟢 {ride.pickup.label}</Text>
              <Text style={styles.routeText} numberOfLines={1}>🔴 {ride.dropoff.label}</Text>
            </View>
            <TouchableOpacity style={styles.callButton} onPress={handleCallPassenger}>
              <Text style={styles.callIcon}>📞</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>Trip Fare</Text>
            <Text style={styles.fareValue}>{formatCurrency(ride.currentFare)}</Text>
          </View>
        </View>

        {/* Actions Button */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, isUpdatingStatus && styles.actionButtonDisabled]}
            onPress={handleAdvanceStatus}
            disabled={isUpdatingStatus}
            activeOpacity={0.8}
          >
            {isUpdatingStatus ? (
              <ActivityIndicator color={Colors.light.textOnPrimary} />
            ) : (
              <Text style={styles.actionButtonText}>{getActionButtonText()}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sosButton}
            onPress={() => {
              const driverUser = state.user;
              if (driverUser) {
                triggerEmergencySOS({
                  userId: driverUser.uid,
                  userName: driverUser.name,
                  userRole: 'driver',
                  coords: driverCoords,
                  activeRideId: ride.rideId,
                });
              }
            }}
          >
            <Text style={styles.sosText}>🚨 EMERGENCY SOS</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Post-Ride Rating Review Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Rate Your Passenger</Text>
            <Text style={styles.modalSubheading}>
              How was your experience with passenger {ride.passengerName || 'Partner'}?
            </Text>

            {/* Stars selection row */}
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((starVal) => (
                <TouchableOpacity
                  key={starVal}
                  onPress={() => setRatingValue(starVal)}
                >
                  <Text style={[styles.starIcon, rating >= starVal ? styles.starIconActive : null]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Comments input box */}
            <TextInput
              style={styles.modalCommentInput}
              placeholder="Leave a comment (optional)..."
              placeholderTextColor={Colors.light.textTertiary}
              value={comment}
              onChangeText={setComment}
              multiline
            />

            {/* Action button */}
            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={() => handleSubmitRating(rating, comment)}
              disabled={isUpdatingStatus}
              activeOpacity={0.8}
            >
              {isUpdatingStatus ? (
                <ActivityIndicator color={Colors.light.textOnPrimary} />
              ) : (
                <Text style={styles.modalSubmitText}>Submit Rating</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  mapPreview: {
    height: '45%',
    width: '100%',
  },
  detailsCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -20,
    paddingTop: 20,
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
  statusBanner: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.light.primaryGhost,
    marginHorizontal: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
    textAlign: 'center',
  },
  passengerCard: {
    backgroundColor: Colors.light.background,
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 20,
  },
  passengerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: 12,
    marginBottom: 12,
  },
  passengerMeta: {
    flex: 1,
    gap: 4,
    marginRight: 10,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  routeText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIcon: {
    fontSize: 18,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  fareValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 40,
    gap: 12,
  },
  actionButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonDisabled: {
    opacity: 0.8,
  },
  actionButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  sosButton: {
    backgroundColor: Colors.light.error,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  sosText: {
    color: Colors.light.textOnPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
  },
  modalSubheading: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  starRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  starIcon: {
    fontSize: 40,
    color: Colors.light.border,
  },
  starIconActive: {
    color: '#FFD700',
  },
  modalCommentInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: Colors.light.text,
    fontSize: 14,
  },
  modalSubmitBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: Colors.light.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
});
