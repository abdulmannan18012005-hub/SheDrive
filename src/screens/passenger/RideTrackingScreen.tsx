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
  Modal,
  TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { doc, onSnapshot, updateDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { PassengerStackParamList, RideRequest, DriverProfile, FareOffer } from '../../types';
import Colors from '../../constants/Colors';
import { formatCurrency } from '../../utils/helpers';
import { LeafletMap, LeafletMapRef, MapMarker } from '../../components/LeafletMap';
import { triggerEmergencySOS } from '../../utils/safety';
import { useApp } from '../../contexts/AppContext';

type RideTrackingNavigationProp = StackNavigationProp<PassengerStackParamList, 'RideTracking'>;
type RideTrackingRouteProp = RouteProp<PassengerStackParamList, 'RideTracking'>;

interface Props {
  navigation: RideTrackingNavigationProp;
  route: RideTrackingRouteProp;
}

export default function RideTrackingScreen({ navigation, route }: Props): React.JSX.Element {
  const { rideId } = route.params;
  const { state, dispatch } = useApp();
  const user = state.user;
  const [ride, setRide] = useState<RideRequest | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRatingValue] = useState(5);
  const [comment, setComment] = useState('');

  const mapRef = useRef<LeafletMapRef>(null);
  const driverUnsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to real-time updates for this ride request
  useEffect(() => {
    const rideRef = doc(db, 'rides', rideId);

    const unsubscribe = onSnapshot(
      rideRef,
      async (docSnapshot) => {
        if (!docSnapshot.exists()) {
          Alert.alert('Error', 'Ride request not found.');
          navigation.navigate('PassengerHome');
          return;
        }

        const rideData = docSnapshot.data() as RideRequest;
        setRide(rideData);
        setIsLoading(false);

        // If a driver is assigned and we haven't subscribed to driver location yet
        if (rideData.driverId && (!driver || driver.uid !== rideData.driverId)) {
          subscribeToDriver(rideData.driverId);
        }

        // Handle completed or cancelled states
        if (rideData.status === 'completed') {
          setShowRatingModal(true);
        } else if (rideData.status === 'cancelled') {
          Alert.alert('Ride Cancelled', 'This ride request was cancelled.');
          navigation.navigate('PassengerHome');
        }
      },
      (error) => {
        console.error('Ride tracking snapshot error:', error);
      }
    );

    return () => {
      unsubscribe();
      if (driverUnsubscribeRef.current) {
        driverUnsubscribeRef.current();
      }
    };
  }, [rideId, driver]);

  // Subscribe to driver location coordinates in real-time
  const subscribeToDriver = (driverId: string) => {
    if (driverUnsubscribeRef.current) {
      driverUnsubscribeRef.current();
    }

    const driverRef = doc(db, 'drivers', driverId);
    const unsubscribe = onSnapshot(driverRef, (docSnap) => {
      if (docSnap.exists()) {
        setDriver(docSnap.data() as DriverProfile);
      }
    });

    driverUnsubscribeRef.current = unsubscribe;
  };

  const handleCancelRide = async () => {
    Alert.alert('Cancel Ride', 'Are you sure you want to cancel your ride request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            const rideRef = doc(db, 'rides', rideId);
            await updateDoc(rideRef, { status: 'cancelled' });
            navigation.navigate('PassengerHome');
          } catch (err) {
            Alert.alert('Cancel Failed', 'Could not cancel request. Please try again.');
          }
        },
      },
    ]);
  };

  const handleAcceptBid = async (offerIndex: number, driverId: string, amount: number) => {
    try {
      setIsLoading(true);
      // Fetch full driver profile first to assign
      const driverSnap = await getDoc(doc(db, 'drivers', driverId));
      if (!driverSnap.exists()) {
        throw new Error('Driver profile details not found.');
      }
      const driverData = driverSnap.data() as DriverProfile;

      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, {
        status: 'accepted',
        driverId,
        driverName: driverData.name,
        driverPhone: driverData.phone,
        driverVehicle: `${driverData.vehicleInfo.color} ${driverData.vehicleInfo.make} ${driverData.vehicleInfo.model} (${driverData.vehicleInfo.plate})`,
        currentFare: amount,
        updatedAt: Date.now(),
      });

      Alert.alert('Offer Accepted', `You have accepted the offer from ${driverData.name}.`);
    } catch (error) {
      Alert.alert('Accept Offer Failed', 'Could not accept this offer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineBid = async (offerIndex: number) => {
    if (!ride) return;
    try {
      setIsLoading(true);
      const updatedOffers = [...ride.offers];
      updatedOffers.splice(offerIndex, 1);

      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, {
        offers: updatedOffers,
        updatedAt: Date.now(),
      });
    } catch (error) {
      Alert.alert('Decline Failed', 'Could not decline offer.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRating = async (ratingVal: number, ratingComment: string) => {
    if (!ride) return;
    try {
      setIsLoading(true);
      // Save rating record to Firestore
      const ratingCollectionRef = collection(db, 'ratings');
      await addDoc(ratingCollectionRef, {
        rideId: ride.rideId,
        fromUserId: ride.passengerId,
        toUserId: ride.driverId || '',
        rating: ratingVal,
        comment: ratingComment,
        createdAt: Date.now(),
      });

      // Fetch driver profile to update their rating statistics
      if (ride.driverId) {
        const driverDocRef = doc(db, 'drivers', ride.driverId);
        const driverSnap = await getDoc(driverDocRef);
        if (driverSnap.exists()) {
          const driverData = driverSnap.data() as DriverProfile;
          const currentTotalRides = driverData.totalRides || 0;
          const currentRating = driverData.rating || 5.0;

          // Simple moving average calculation
          const newTotalRides = currentTotalRides + 1;
          const newRating = (currentRating * currentTotalRides + ratingVal) / newTotalRides;

          await updateDoc(driverDocRef, {
            rating: parseFloat(newRating.toFixed(2)),
            totalRides: newTotalRides,
          });
        }
      }

      Alert.alert('Thank You', 'Your rating review has been submitted.');
      setShowRatingModal(false);
      dispatch({ type: 'RESET_RIDE' }); // Reset passenger context
      navigation.navigate('PassengerHome');
    } catch (err) {
      console.warn('Failed to submit rating:', err);
      setShowRatingModal(false);
      navigation.navigate('PassengerHome');
    } finally {
      setIsLoading(false);
    }
  };

  // Deserialize polyline string and convert to Leaflet-compatible [lat, lng]
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
      { id: 'pickup', lat: ride.pickup.latitude, lng: ride.pickup.longitude, emoji: '🟢', title: 'Pickup' },
      { id: 'dropoff', lat: ride.dropoff.latitude, lng: ride.dropoff.longitude, emoji: '🔴', title: 'Dropoff' },
    ];

    // Show driver vehicle moving on the map if accepted/arrived/enroute
    if (driver && driver.latitude && driver.longitude) {
      markers.push({
        id: 'driver',
        lat: driver.latitude,
        lng: driver.longitude,
        emoji: '🚗',
        title: `${driver.name} (Arriving)`,
      });
    }

    return markers;
  };

  if (isLoading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Connecting to SheDrive network...</Text>
      </View>
    );
  }

  const driverOffers = ride.offers.filter((b: FareOffer) => b.role === 'driver');

  return (
    <SafeAreaView style={styles.container}>
      {/* Map Preview */}
      <View style={styles.mapPreview}>
        <LeafletMap
          ref={mapRef}
          center={{ lat: ride.pickup.latitude, lng: ride.pickup.longitude }}
          markers={getMapMarkers()}
          routeCoordinates={getLeafletCoordinates()}
        />
      </View>

      <ScrollView style={styles.detailsCard}>
        {/* State Banner */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusLabel}>
            {ride.status === 'pending' && '🔍 Searching for nearby drivers...'}
            {ride.status === 'negotiating' && '💬 Negotiating fare...'}
            {ride.status === 'accepted' && '🚗 Driver is arriving...'}
            {ride.status === 'arrived' && '📍 Driver has arrived!'}
            {ride.status === 'enroute' && '🌟 Ride in progress...'}
          </Text>
        </View>

        {/* Driver offers list during 'pending'/'negotiating' status */}
        {(ride.status === 'pending' || ride.status === 'negotiating') && (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Driver Offers ({driverOffers.length})</Text>

            {driverOffers.length === 0 ? (
              <View style={styles.emptyOffersBox}>
                <ActivityIndicator size="small" color={Colors.light.primary} style={{ marginRight: 8 }} />
                <Text style={styles.emptyText}>Waiting for bids from Lahore drivers...</Text>
              </View>
            ) : (
              driverOffers.map((offer: FareOffer, index: number) => {
                const globalIndex = ride.offers.findIndex((b: FareOffer) => b.timestamp === offer.timestamp);
                return (
                  <View key={offer.timestamp} style={styles.offerItem}>
                    <View style={styles.driverMeta}>
                      <Text style={styles.driverName}>👩 Driver Partner</Text>
                      <Text style={styles.bidPrice}>{formatCurrency(offer.amount)}</Text>
                    </View>
                    <View style={styles.offerActions}>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => handleDeclineBid(globalIndex)}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => handleAcceptBid(globalIndex, offer.senderId, offer.amount)}
                      >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Assigned Driver Details Panel */}
        {(ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'enroute') && driver && (
          <View style={styles.driverDetailsPanel}>
            <View style={styles.driverRow}>
              <View style={styles.driverMetaInfo}>
                <Text style={styles.driverNameText}>{ride.driverName || 'Driver'}</Text>
                <Text style={styles.vehicleText}>{ride.driverVehicle || 'Vehicle details'}</Text>
              </View>
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>⭐ {driver.rating?.toFixed(1) || '5.0'}</Text>
              </View>
            </View>

            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Agreed Fare</Text>
              <Text style={styles.fareVal}>{formatCurrency(ride.currentFare)}</Text>
            </View>
          </View>
        )}

        {/* General Action Buttons */}
        <View style={styles.actionsContainer}>
          {(ride.status === 'pending' || ride.status === 'negotiating') && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelRide}>
              <Text style={styles.cancelBtnText}>Cancel Request</Text>
            </TouchableOpacity>
          )}

          {ride.status !== 'pending' && ride.status !== 'negotiating' && ride.status !== 'cancelled' && (
            <View style={styles.safetyRow}>
              <TouchableOpacity
                style={styles.sosButton}
                onPress={() => {
                  if (user) {
                    triggerEmergencySOS({
                      userId: user.uid,
                      userName: user.name,
                      userRole: 'passenger',
                      coords: { latitude: ride.pickup.latitude, longitude: ride.pickup.longitude },
                      activeRideId: ride.rideId,
                    });
                  }
                }}
              >
                <Text style={styles.sosText}>🚨 EMERGENCY SOS</Text>
              </TouchableOpacity>
            </View>
          )}
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
            <Text style={styles.modalHeading}>Rate Your Trip</Text>
            <Text style={styles.modalSubheading}>
              How was your experience with driver {ride.driverName || 'Partner'}?
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
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
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
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 14,
  },
  emptyOffersBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  offerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  driverMeta: {
    gap: 4,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  bidPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  offerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  declineBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.border,
    borderRadius: 8,
  },
  declineBtnText: {
    color: Colors.light.textSecondary,
    fontWeight: '700',
  },
  acceptBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.primary,
    borderRadius: 8,
  },
  acceptBtnText: {
    color: Colors.light.textOnPrimary,
    fontWeight: '700',
  },
  driverDetailsPanel: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.background,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 16,
  },
  driverMetaInfo: {
    gap: 4,
  },
  driverNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  vehicleText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  ratingBadge: {
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ratingText: {
    color: Colors.light.primary,
    fontWeight: '700',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  fareLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
  },
  fareVal: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  actionsContainer: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  cancelBtn: {
    backgroundColor: Colors.light.errorLight,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.light.error,
    fontSize: 16,
    fontWeight: '700',
  },
  safetyRow: {
    marginTop: 10,
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
