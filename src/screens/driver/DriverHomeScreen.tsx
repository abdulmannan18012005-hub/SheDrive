import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import { doc, updateDoc, collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { DriverStackParamList, RideRequest, FareOffer, DriverProfile } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { LeafletMap, LeafletMapRef, MapMarker } from '../../components/LeafletMap';
import { useLocation } from '../../hooks/useLocation';
import { formatCurrency } from '../../utils/helpers';
import { getApiBaseUrl } from '../../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SideDrawer } from '../../components/SideDrawer';

type DriverHomeNavigationProp = StackNavigationProp<DriverStackParamList, 'DriverHome'>;

interface Props {
  navigation: DriverHomeNavigationProp;
}

export default function DriverHomeScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;

  const { location: currentCoords, errorMessage, isLoading: isLocationLoading, refreshLocation } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [availableRides, setAvailableRides] = useState<RideRequest[]>([]);
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [rideTimers, setRideTimers] = useState<Record<string, number>>({});

  const mapRef = useRef<LeafletMapRef>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);

  // Subscribe to available rides when online
  useEffect(() => {
    if (!isOnline) {
      setAvailableRides([]);
      setRideTimers({});
      return;
    }

    const ridesRef = collection(db, 'rides');
    const q = query(
      ridesRef,
      where('status', 'in', ['pending', 'negotiating'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const offersList: RideRequest[] = [];
        snapshot.forEach((docSnap) => {
          offersList.push(docSnap.data() as RideRequest);
        });
        // Filter rides to match driver's registered vehicle category
        const driverProfile = user as DriverProfile | null;
        const matchingRides = offersList.filter((ride) => {
          if (driverProfile?.vehicleInfo?.category && ride.vehicleCategory) {
            return ride.vehicleCategory === driverProfile.vehicleInfo.category;
          }
          return true;
        });
        setAvailableRides(matchingRides);

        // Initialize timers for new rides (10 seconds from ride creation)
        const now = Date.now();
        const newTimers: Record<string, number> = {};
        matchingRides.forEach((ride) => {
          const rideAge = now - (ride.createdAt || now);
          const remainingTime = Math.max(0, 10 - Math.floor(rideAge / 1000));
          newTimers[ride.rideId] = remainingTime;
        });
        setRideTimers(newTimers);
      },
      (error) => {
        console.error('Subscription to ride offers failed:', error);
      }
    );

    return () => unsubscribe();
  }, [isOnline]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOnline || availableRides.length === 0) return;

    const interval = setInterval(() => {
      setRideTimers((prevTimers) => {
        const updatedTimers: Record<string, number> = {};
        let hasActiveRides = false;

        availableRides.forEach((ride) => {
          const currentTime = prevTimers[ride.rideId] || 10;
          if (currentTime > 0) {
            updatedTimers[ride.rideId] = currentTime - 1;
            hasActiveRides = true;
          }
        });

        return updatedTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnline, availableRides]);

  // Stop watching location when component unmounts
  useEffect(() => {
    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
      }
    };
  }, []);

  const handleToggleOnline = async () => {
    if (!user) return;

    try {
      setIsUpdatingStatus(true);

      if (!isOnline) {
        // Request Location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Foreground location permission is required to accept rides.');
          setIsUpdatingStatus(false);
          return;
        }

        await refreshLocation();

        let tokenToUse = state.token;
        if (!tokenToUse) {
          tokenToUse = (await AsyncStorage.getItem('@shedrive_auth_token')) || undefined;
        }

        // Call backend API to go online (backend will verify driver status)
        const res = await fetch(`${getApiBaseUrl()}/driver/online`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenToUse}`,
          },
          body: JSON.stringify({
            isOnline: true,
            latitude: currentCoords?.latitude,
            longitude: currentCoords?.longitude,
            heading: 0,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          Alert.alert(
            res.status === 403 ? 'Account Under Review' : 'Cannot Go Online',
            data.error || 'Your account is currently under review. Please wait for admin approval.'
          );
          setIsUpdatingStatus(false);
          return;
        }

        // Start location watcher if backend approves
        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2500,
            distanceInterval: 2,
          },
          async (newLocation) => {
            const { latitude, longitude, heading } = newLocation.coords;

            // Update backend with new coordinates
            await fetch(`${getApiBaseUrl()}/driver/online`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.token}`,
              },
              body: JSON.stringify({
                isOnline: true,
                latitude,
                longitude,
                heading: heading || 0,
              }),
            });

            // Also update Firestore for real-time passenger visibility
            const driverRef = doc(db, 'drivers', user.uid);
            await updateDoc(driverRef, {
              isOnline: true,
              latitude,
              longitude,
              heading: heading || 0,
              lastUpdated: Date.now(),
            });

            if (mapRef.current) {
              mapRef.current.setCenter(latitude, longitude);
            }
          }
        );

        locationWatcherRef.current = watcher;
        setIsOnline(true);
      } else {
        // Go Offline
        if (locationWatcherRef.current) {
          locationWatcherRef.current.remove();
          locationWatcherRef.current = null;
        }

        // Call backend API to go offline
        await fetch(`${getApiBaseUrl()}/driver/online`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`,
          },
          body: JSON.stringify({
            isOnline: false,
          }),
        });

        // Also update Firestore
        const driverRef = doc(db, 'drivers', user.uid);
        await updateDoc(driverRef, {
          isOnline: false,
          lastUpdated: Date.now(),
        });

        setIsOnline(false);
      }
    } catch (error) {
      console.error('Error toggling online status:', error);
      Alert.alert('Status Error', 'Could not update online status. Please check your network connection.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAcceptRide = async (ride: RideRequest) => {
    if (!user) return;

    try {
      const rideRef = doc(db, 'rides', ride.rideId);
      const vehicleDetails = user.role === 'driver' ? 'Sedan' : 'Vehicle';

      await updateDoc(rideRef, {
        status: 'accepted',
        driverId: user.uid,
        driverName: user.name,
        driverPhone: user.phone,
        driverVehicle: vehicleDetails,
        autoMessageSent: true,
        updatedAt: Date.now(),
      });

      // Auto-send welcoming message to ride chat
      try {
        const chatCollectionRef = collection(db, 'rides', ride.rideId, 'messages');
        await addDoc(chatCollectionRef, {
          senderId: user.uid,
          senderName: user.name,
          senderRole: 'driver',
          text: `Assalam-o-Alaikum! I have accepted your SheDrive booking and I am on my way to your pickup location (${ride.pickup.label}). See you soon!`,
          timestamp: Date.now(),
        });
      } catch (chatErr) {
        console.warn('Auto message send warning:', chatErr);
      }

      Alert.alert('Success', 'Ride accepted! Navigating to ride progress dashboard.');
      navigation.navigate('ActiveRide', { rideId: ride.rideId });
    } catch (error) {
      console.error('Accept ride failed:', error);
      Alert.alert('Accept Failed', 'Could not accept ride offer. It might have been taken by another driver.');
    }
  };

  const openCounterModal = (ride: RideRequest) => {
    setSelectedRide(ride);
    setCounterAmount((ride.currentFare + 50).toString());
    setCounterModalVisible(true);
  };

  const handleSendCounterOffer = async () => {
    if (!user || !selectedRide) return;

    const amountNum = parseInt(counterAmount);
    if (isNaN(amountNum) || amountNum <= selectedRide.currentFare) {
      Alert.alert('Invalid Fare', `Counter bid must be greater than current fare: ${formatCurrency(selectedRide.currentFare)}`);
      return;
    }

    try {
      setIsSubmittingCounter(true);
      const rideRef = doc(db, 'rides', selectedRide.rideId);

      // Construct the counter offer object
      const driverOffer: FareOffer = {
        senderId: user.uid,
        role: 'driver',
        amount: amountNum,
        timestamp: Date.now(),
      };

      await updateDoc(rideRef, {
        status: 'negotiating',
        currentFare: amountNum,
        offers: [...selectedRide.offers, driverOffer],
        updatedAt: Date.now(),
      });

      Alert.alert('Counter-Offer Sent', `Proposals updated to ${formatCurrency(amountNum)}. Awaiting passenger confirmation.`);
      setCounterModalVisible(false);
      setSelectedRide(null);
    } catch (error) {
      console.error('Failed to submit counter offer:', error);
      Alert.alert('Error', 'Unable to submit counter offer. Please try again.');
    } finally {
      setIsSubmittingCounter(false);
    }
  };

  // Build marker array for the map
  const getMapMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];
    if (currentCoords) {
      markers.push({
        id: 'driver_current',
        lat: currentCoords.latitude,
        lng: currentCoords.longitude,
        emoji: '🚗',
        title: 'My Location',
        isDriver: true,
      });
    }

    // Show pickup markers for available rides on the map
    availableRides.forEach((ride) => {
      markers.push({
        id: ride.rideId,
        lat: ride.pickup.latitude,
        lng: ride.pickup.longitude,
        emoji: '📍',
        title: `Ride Offer: ${formatCurrency(ride.currentFare)}`,
        isCustomer: true,
      });
    });

    return markers;
  };

  if (isLocationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Fetching GPS Location...</Text>
      </View>
    );
  }

  const defaultCenter = currentCoords
    ? { lat: currentCoords.latitude, lng: currentCoords.longitude }
    : { lat: 31.5204, lng: 74.3587 };

  return (
    <SafeAreaView style={styles.container}>
      {/* Upper Status Panel with Hamburger Menu & Platform Fee Shortcut */}
      <View style={styles.topPanel}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => setDrawerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.welcomeText}>Hello, {user?.name || 'Driver'}</Text>
        </View>
        <TouchableOpacity
          style={styles.feeShortcutButton}
          onPress={() => navigation.navigate('MonthlyPayment')}
          activeOpacity={0.8}
        >
          <Text style={styles.feeShortcutText}>💳 Fee Statement</Text>
        </TouchableOpacity>
      </View>

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Embedded Leaflet Map */}
      <View style={styles.mapContainer}>
        <LeafletMap
          ref={mapRef}
          center={defaultCenter}
          markers={getMapMarkers()}
        />
      </View>

      {/* Available Ride Offers Dashboard */}
      {isOnline && (
        <View style={styles.offersContainer}>
          <Text style={styles.offersHeading}>
            Available Ride Offers ({availableRides.length})
          </Text>

          {availableRides.length === 0 ? (
            <View style={styles.emptyOffersBox}>
              <Text style={styles.emptyText}>Waiting for passenger ride requests...</Text>
            </View>
          ) : (
            <FlatList
              data={availableRides}
              keyExtractor={(item) => item.rideId}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.offersList}
              renderItem={({ item }) => {
                const timeRemaining = rideTimers[item.rideId] || 10;
                const isExpired = timeRemaining <= 0;

                return (
                  <View style={[styles.rideCard, isExpired && styles.rideCardExpired]}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.passengerLabel}>👩 {item.passengerName}</Text>
                      <Text style={styles.fareLabel}>{formatCurrency(item.currentFare)}</Text>
                    </View>

                    <View style={styles.routeContainer}>
                      <Text style={styles.routeText} numberOfLines={1}>🟢 {item.pickup.label}</Text>
                      <Text style={styles.routeText} numberOfLines={1}>🔴 {item.dropoff.label}</Text>
                    </View>

                    <View style={styles.cardDetails}>
                      <Text style={styles.detailText}>{item.distanceKm.toFixed(1)} km</Text>
                      <View style={styles.dotSeparator} />
                      <Text style={styles.detailText}>{Math.round(item.durationMin)} mins</Text>
                    </View>

                    {/* Timer Display */}
                    <View style={styles.timerContainer}>
                      <Text style={[styles.timerText, isExpired && styles.timerTextExpired]}>
                        {isExpired ? '⏰ Expired' : `⏱️ ${timeRemaining}s`}
                      </Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.counterBtn, isExpired && styles.actionBtnDisabled]}
                        onPress={() => openCounterModal(item)}
                        disabled={isExpired}
                      >
                        <Text style={styles.counterBtnText}>Counter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.acceptBtn, isExpired && styles.actionBtnDisabled]}
                        onPress={() => handleAcceptRide(item)}
                        disabled={isExpired}
                      >
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Bottom Panel containing Go Online Action */}
      <View style={styles.bottomPanel}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isOnline ? styles.buttonOffline : styles.buttonOnline,
            isUpdatingStatus && styles.buttonDisabled,
          ]}
          onPress={handleToggleOnline}
          disabled={isUpdatingStatus}
          activeOpacity={0.8}
        >
          {isUpdatingStatus ? (
            <ActivityIndicator color={Colors.light.textOnPrimary} />
          ) : (
            <Text style={styles.toggleButtonText}>
              {isOnline ? 'Go Offline' : 'Go Online'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Counter-Offer Proposal Modal */}
      <Modal
        visible={counterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCounterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Propose Counter Fare</Text>
            {selectedRide && (
              <Text style={styles.modalSubheading}>
                Passenger current bid: {formatCurrency(selectedRide.currentFare)}
              </Text>
            )}

            <View style={styles.modalInputRow}>
              <Text style={styles.modalCurrency}>PKR</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={counterAmount}
                onChangeText={setCounterAmount}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setCounterModalVisible(false);
                  setSelectedRide(null);
                }}
                disabled={isSubmittingCounter}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSendCounterOffer}
                disabled={isSubmittingCounter}
              >
                {isSubmittingCounter ? (
                  <ActivityIndicator color={Colors.light.textOnPrimary} />
                ) : (
                  <Text style={styles.modalSubmitText}>Send Offer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        user={user}
        role="driver"
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        dispatch={dispatch}
      />
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
  topPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  hamburgerIcon: {
    fontSize: 22,
    color: Colors.light.primary,
  },
  feeShortcutButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  feeShortcutText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  errorBanner: {
    backgroundColor: Colors.light.errorLight,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  errorText: {
    color: Colors.light.error,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  offersContainer: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  offersHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.text,
    marginLeft: 20,
    marginBottom: 8,
    textShadowColor: 'rgba(255, 255, 255, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  offersList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  rideCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 18,
    padding: 16,
    width: 280,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  rideCardExpired: {
    opacity: 0.6,
    backgroundColor: Colors.light.background,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  timerTextExpired: {
    color: Colors.light.textTertiary,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  passengerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  fareLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  routeContainer: {
    gap: 6,
    marginBottom: 12,
  },
  routeText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  detailText: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    fontWeight: '600',
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
    marginHorizontal: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  counterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
    alignItems: 'center',
  },
  counterBtnText: {
    color: Colors.light.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: Colors.light.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyOffersBox: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    paddingVertical: 20,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  bottomPanel: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    alignItems: 'center',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  toggleButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonOnline: {
    backgroundColor: Colors.light.success,
    shadowColor: Colors.light.success,
  },
  buttonOffline: {
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
  },
  buttonDisabled: {
    opacity: 0.8,
  },
  toggleButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 24,
    width: '100%',
  },
  modalCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.primary,
    marginRight: 10,
  },
  modalInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    padding: 0,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
  },
  modalCancelText: {
    color: Colors.light.textSecondary,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: Colors.light.textOnPrimary,
    fontWeight: '700',
  },
});
