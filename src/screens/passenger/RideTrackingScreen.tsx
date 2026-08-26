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
  Linking,
  Share,
  Image,
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
import { getApiBaseUrl } from '../../config/apiConfig';

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

            // Sync cancellation with backend PostgreSQL
            try {
              await fetch(`${getApiBaseUrl()}/rides/${rideId}/status`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${state.token}`,
                },
                body: JSON.stringify({ status: 'cancelled' }),
              });
            } catch (backendErr) {
              console.warn('Backend cancel sync warning:', backendErr);
            }

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
      const vehicleDetails = `${driverData.vehicleInfo.color} ${driverData.vehicleInfo.make} ${driverData.vehicleInfo.model} (${driverData.vehicleInfo.plate})`;

      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, {
        status: 'accepted',
        driverId,
        driverName: driverData.name,
        driverPhone: driverData.phone,
        driverVehicle: vehicleDetails,
        currentFare: amount,
        updatedAt: Date.now(),
      });

      // Sync accepted status with backend PostgreSQL
      try {
        await fetch(`${getApiBaseUrl()}/rides/${rideId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`,
          },
          body: JSON.stringify({
            status: 'accepted',
            driverId,
            driverName: driverData.name,
            driverPhone: driverData.phone,
            driverVehicle: vehicleDetails,
            currentFare: amount,
          }),
        });
      } catch (backendErr) {
        console.warn('Backend accept bid sync warning:', backendErr);
      }

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

      // Sync rating with backend PostgreSQL
      try {
        await fetch(`${getApiBaseUrl()}/rides/${ride.rideId}/rating`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`,
          },
          body: JSON.stringify({
            rating: ratingVal,
            comment: ratingComment,
          }),
        });
      } catch (backendErr) {
        console.warn('Backend rating sync warning:', backendErr);
      }

      // Fetch driver profile to update their rating statistics in Firestore
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
      { id: 'pickup', lat: ride.pickup.latitude, lng: ride.pickup.longitude, emoji: '📍', title: 'Pickup', isCustomer: true },
      ...(ride.stops || []).map((s, idx) => ({
        id: `stop_${idx}`,
        lat: s.latitude,
        lng: s.longitude,
        emoji: s.completed ? '✅' : '🟡',
        title: `Stop #${idx + 1}: ${s.label} (${s.completed ? 'Completed' : 'Pending'})`,
        isCustomer: false,
      })),
      { id: 'dropoff', lat: ride.dropoff.latitude, lng: ride.dropoff.longitude, emoji: '🏁', title: 'Destination', isDestination: true },
    ];

    // Show driver vehicle moving on the map if accepted/arrived/enroute
    const dLat = ride.driverCoords?.latitude || driver?.latitude;
    const dLng = ride.driverCoords?.longitude || driver?.longitude;

    if (dLat && dLng) {
      markers.push({
        id: 'driver',
        lat: dLat,
        lng: dLng,
        emoji: '🚗',
        title: `${ride.driverName || driver?.name || 'Driver'} (${ride.status === 'accepted' ? 'Approaching' : 'On Trip'})`,
        isDriver: true,
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
            {ride.status === 'scheduled' && `🕒 Scheduled Ride: Departure at ${ride.scheduledFor ? new Date(ride.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'set time'}`}
            {ride.status === 'pending' && '🔍 Searching for nearby verified drivers...'}
            {ride.status === 'negotiating' && '💬 Negotiating fare...'}
            {ride.status === 'accepted' && '🚗 Driver is navigating to pickup point...'}
            {ride.status === 'arrived' && '📍 Driver has arrived! Share PIN to board.'}
            {ride.status === 'boarded' && '🔑 Ride Verification PIN Confirmed!'}
            {ride.status === 'started' && '🏎️ Ride Started! Driving to destination...'}
            {ride.status === 'enroute' && '🌟 Ride in progress...'}
          </Text>
        </View>

        {/* Multi-Stop Progress Indicator (Phase 10) */}
        {ride.stops && ride.stops.length > 0 && (
          <View style={{ marginHorizontal: 24, padding: 14, backgroundColor: Colors.light.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.light.textSecondary, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
              🗺️ Multi-Stop Route Progress
            </Text>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 14 }}>🟢</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.light.text, flex: 1 }} numberOfLines={1}>Pickup: {ride.pickup.label}</Text>
              </View>
              {ride.stops.map((s, idx) => (
                <View key={s.id || `stop-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 14 }}>{s.completed ? '✅' : '🟡'}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: s.completed ? '#10B981' : Colors.light.text, flex: 1 }} numberOfLines={1}>
                    Stop #{idx + 1}: {s.label} ({s.completed ? 'Completed' : 'Next'})
                  </Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 14 }}>🔴</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.light.text, flex: 1 }} numberOfLines={1}>Destination: {ride.dropoff.label}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Driver Counter Offers / Bids Section */}
        {driverOffers.length > 0 && (ride.status === 'pending' || ride.status === 'negotiating') && (
          <View style={{ marginHorizontal: 24, padding: 16, backgroundColor: Colors.light.surface, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.light.primary, marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: Colors.light.primary, marginBottom: 12 }}>
              💬 Driver Fare Counter-Offers ({driverOffers.length})
            </Text>
            {driverOffers.map((offer: FareOffer, idx: number) => {
              const driverIdToAccept = offer.userId || offer.senderId;
              return (
                <View key={idx} style={{ padding: 12, backgroundColor: Colors.light.background, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.light.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.light.text }}>
                      {offer.userName || 'Verified Driver'}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: Colors.light.primary }}>
                      Rs. {offer.amount}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: 10, backgroundColor: Colors.light.primary, borderRadius: 10, alignItems: 'center' }}
                      onPress={() => handleAcceptBid(idx, driverIdToAccept, offer.amount)}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>Accept Rs. {offer.amount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.light.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center' }}
                      onPress={() => handleDeclineBid(idx)}
                    >
                      <Text style={{ color: Colors.light.textSecondary, fontWeight: '600', fontSize: 13 }}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 4-Digit Ride Verification PIN Card */}
        {(ride.status === 'accepted' || ride.status === 'arrived') && (
          <View style={{ marginHorizontal: 24, padding: 16, backgroundColor: Colors.light.primaryGhost, borderRadius: 16, alignItems: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: Colors.light.primary }}>
            <Text style={{ fontSize: 13, color: Colors.light.textSecondary, fontWeight: '600', marginBottom: 4 }}>Ride Verification PIN</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: Colors.light.primary, letterSpacing: 6 }}>
              {ride.verificationPin || '4921'}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.light.textSecondary, marginTop: 4 }}>Share this PIN with your driver to confirm boarding</Text>
          </View>
        )}

        {/* Accepted Driver Details Card */}
        {ride.driverId && (
          <View style={{ marginHorizontal: 24, padding: 16, backgroundColor: Colors.light.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 20, elevation: 2 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.light.textSecondary, marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              🚗 Assigned Driver Partner
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: Colors.light.primaryGhost, justifyContent: 'center', alignItems: 'center' }}>
                {driver?.photoURL || driver?.selfieUrl ? (
                  <Image source={{ uri: driver?.photoURL || driver?.selfieUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                ) : (
                  <Text style={{ fontSize: 24 }}>👩</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: Colors.light.text }}>{ride.driverName || driver?.name || 'Driver Partner'}</Text>
                <Text style={{ fontSize: 13, color: Colors.light.textSecondary, marginTop: 2, fontWeight: '500' }}>
                  {driver?.vehicleInfo ? `${driver.vehicleInfo.make} ${driver.vehicleInfo.model} (${driver.vehicleInfo.color})` : (ride.driverVehicle || 'Vehicle Verified')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.light.primary }}>⭐ {driver?.rating?.toFixed(1) || '5.0'}</Text>
                  <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>• {driver?.totalRides || 1} completed trips</Text>
                </View>
              </View>
              {driver?.vehicleInfo?.plate && (
                <View style={{ backgroundColor: Colors.light.background, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.light.border }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.light.text }}>{driver.vehicleInfo.plate}</Text>
                </View>
              )}
            </View>

            {/* Quick Action Bar: Call, Chat, Share Ride */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: Colors.light.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                onPress={() => {
                  const phoneNum = ride.driverPhone || driver?.phone;
                  if (phoneNum) {
                    Linking.openURL(`tel:${phoneNum}`).catch(() => Alert.alert('Call Failed', 'Unable to open phone dialer.'));
                  } else {
                    Alert.alert('Phone Number', 'Driver phone number is unavailable.');
                  }
                }}
              >
                <Text style={{ fontSize: 15 }}>📞</Text>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>Call Driver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: Colors.light.primaryGhost, paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.light.primary }}
                onPress={() => navigation.navigate('Chat', {
                  rideId: ride.rideId,
                  otherUserName: ride.driverName || driver?.name || 'Driver',
                  otherUserRole: 'driver',
                })}
              >
                <Text style={{ fontSize: 15 }}>💬</Text>
                <Text style={{ color: Colors.light.primary, fontWeight: '800', fontSize: 13 }}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, backgroundColor: Colors.light.primaryGhost, paddingVertical: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: Colors.light.primary }}
                onPress={async () => {
                  try {
                    const res = await fetch(`${getApiBaseUrl()}/rides/share`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${state.token}`,
                      },
                      body: JSON.stringify({ rideId: ride.rideId }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      Alert.alert('Share Failed', data.error || 'Unable to create share link');
                      return;
                    }
                    Share.share({
                      message: `📌 Track my live SheDrive trip!\nDriver: ${ride.driverName || 'Partner'}\nPickup: ${ride.pickup.label}\nDestination: ${ride.dropoff.label}\nLive Tracking: ${data.shareUrl}`,
                      title: 'Share My SheDrive Ride',
                    }).catch(() => Alert.alert('Share Failed', 'Unable to open share sheet.'));
                  } catch (err) {
                    Alert.alert('Share Failed', 'Unable to create share link. Please try again.');
                  }
                }}
              >
                <Text style={{ fontSize: 15 }}>🔗</Text>
                <Text style={{ color: Colors.light.primary, fontWeight: '800', fontSize: 13 }}>Share Ride</Text>
              </TouchableOpacity>
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
                      token: state.token,
                    });
                  }
                }}
              >
                <Text style={styles.sosText}>🚨 EMERGENCY SOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.directCallBtn}
                onPress={() => Linking.openURL('tel:15').catch(() => Alert.alert('Call Failed', 'Unable to open phone dialer.'))}
              >
                <Text style={styles.directCallBtnText}>📞 Call 15 (Emergency)</Text>
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
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 16,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  driverMetaInfo: {
    gap: 4,
    flex: 1,
  },
  driverNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.text,
  },
  vehicleText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  ratingBadge: {
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  ratingText: {
    color: Colors.light.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  fareLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  fareVal: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  cancelBtn: {
    backgroundColor: Colors.light.errorLight,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.error + '30',
  },
  cancelBtnText: {
    color: Colors.light.error,
    fontSize: 15,
    fontWeight: '700',
  },
  safetyRow: {
    marginTop: 10,
  },
  sosButton: {
    backgroundColor: Colors.light.emergency,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.emergency,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  sosText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  directCallBtn: {
    backgroundColor: '#1565C0',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  directCallBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
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
