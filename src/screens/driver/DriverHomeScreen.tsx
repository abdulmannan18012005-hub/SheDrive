import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  BackHandler,
  ToastAndroid,
  Platform,
  AppState,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIsFocused } from '@react-navigation/native';
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
import { DriverVerificationStatusModal } from '../../components/DriverVerificationStatusModal';

type DriverHomeNavigationProp = StackNavigationProp<DriverStackParamList, 'DriverHome'>;

interface Props {
  navigation: DriverHomeNavigationProp;
}

export default function DriverHomeScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;
  const isFocused = useIsFocused();
  const [unreadCount, setUnreadCount] = useState(0);

  // Safe fallback driver profile values
  const driverProfile = (user as DriverProfile) || null;
  const vehicle = driverProfile?.vehicleInfo || (driverProfile as any)?.vehicle_info || {
    make: (driverProfile as any)?.vehicle_make || '',
    model: (driverProfile as any)?.vehicle_model || '',
    plate: (driverProfile as any)?.vehicle_plate || '',
    plateNumber: (driverProfile as any)?.vehicle_plate || '',
    category: (driverProfile as any)?.vehicle_category || 'mini',
    color: (driverProfile as any)?.vehicle_color || '',
    year: (driverProfile as any)?.vehicle_year || '2022',
  };
  const driverCategory = vehicle.category || (driverProfile as any)?.vehicleCategory || 'mini';
  const verificationStatus =
    (driverProfile as any)?.verificationStatus ||
    (driverProfile as any)?.verification_status ||
    (user?.isVerified ? 'approved' : 'pending');
  const isDriverVerified = Boolean(user?.isVerified || verificationStatus === 'approved');
  const rejectionReason = (driverProfile as any)?.rejectionReason || (driverProfile as any)?.rejection_reason;

  useEffect(() => {
    const fetchUnread = async () => {
      if (!state.token) return;
      try {
        const res = await fetch(`${getApiBaseUrl()}/user/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${state.token}` },
        });
        const data = await res.json();
        if (res.ok && typeof data.count === 'number') {
          setUnreadCount(data.count);
        }
      } catch (err) {
        // Non-critical: unread badge simply remains at current state
      }
    };
    if (isFocused) fetchUnread();
  }, [isFocused, state.token]);

  const { location: currentCoords, errorMessage, isLoading: isLocationLoading, refreshLocation } = useLocation();
  const [isOnline, setIsOnline] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [verificationModalVisible, setVerificationModalVisible] = useState(false);

  const [availableRides, setAvailableRides] = useState<RideRequest[]>([]);
  const [counterModalVisible, setCounterModalVisible] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideRequest | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [rideTimers, setRideTimers] = useState<Record<string, number>>({});

  const mapRef = useRef<LeafletMapRef>(null);
  const isInitialMapReady = useRef(false);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const lastHttpLocationSyncRef = useRef<number>(0);
  const lastBackPressRef = useRef<number>(0);

  // Auto-center map strictly ONCE when initial real GPS location is acquired
  useEffect(() => {
    if (!isInitialMapReady.current && currentCoords?.latitude && currentCoords?.longitude && mapRef.current) {
      isInitialMapReady.current = true;
      mapRef.current.setCenter(currentCoords.latitude, currentCoords.longitude, 15);
    }
  }, [currentCoords?.latitude, currentCoords?.longitude]);

  // Android hardware back handler
  useEffect(() => {
    const onBackPress = () => {
      if (counterModalVisible) {
        setCounterModalVisible(false);
        return true;
      }
      if (verificationModalVisible) {
        setVerificationModalVisible(false);
        return true;
      }
      if (drawerVisible) {
        setDrawerVisible(false);
        return true;
      }

      if (!isFocused) return false;

      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }

      lastBackPressRef.current = now;
      if (Platform.OS === 'android') {
        ToastAndroid.show('Press back again to exit SheDrive', ToastAndroid.SHORT);
      }
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [counterModalVisible, verificationModalVisible, drawerVisible, isFocused]);

  // Subscribe to available rides when online
  useEffect(() => {
    if (!isOnline) {
      setAvailableRides([]);
      setRideTimers({});
      return;
    }

    try {
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
            const rData = docSnap.data();
            if (rData && rData.rideId) {
              offersList.push(rData as RideRequest);
            }
          });

          // Filter rides to match driver's registered vehicle category safely
          const matchingRides = offersList.filter((ride) => {
            if (!ride) return false;
            if (driverCategory && ride.vehicleCategory) {
              return ride.vehicleCategory === driverCategory;
            }
            return true;
          });

          setAvailableRides(matchingRides);

          // Initialize timers for new rides (10 seconds countdown from ride creation)
          const now = Date.now();
          const newTimers: Record<string, number> = {};
          matchingRides.forEach((ride) => {
            if (ride?.rideId) {
              const rideAge = now - (ride.createdAt || now);
              const remainingTime = Math.max(0, 10 - Math.floor(rideAge / 1000));
              newTimers[ride.rideId] = remainingTime;
            }
          });
          setRideTimers(newTimers);
        },
        (error) => {
          console.warn('[DriverHome] Subscription to ride offers warning:', error);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('[DriverHome] Failed to initialize Firestore listener:', e);
    }
  }, [isOnline, driverCategory]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOnline || !Array.isArray(availableRides) || availableRides.length === 0) return;

    const interval = setInterval(() => {
      setRideTimers((prevTimers) => {
        const updatedTimers: Record<string, number> = {};

        availableRides.forEach((ride) => {
          if (ride?.rideId) {
            const currentTime = prevTimers[ride.rideId] ?? 10;
            if (currentTime > 0) {
              updatedTimers[ride.rideId] = currentTime - 1;
            }
          }
        });

        return updatedTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOnline, availableRides]);

  // AppState minimize/resume location refresh listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        try {
          await refreshLocation();
        } catch (err) {
          console.warn('[Driver Location AppState Resume Warning]:', err);
        }
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Stop watching location when component unmounts
  useEffect(() => {
    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };
  }, []);

  const handleToggleOnline = async () => {
    if (!user) {
      Alert.alert('Authentication Error', 'Driver user session not found. Please log in again.');
      return;
    }

    // Strict verification gatekeeper: document status must be explicitly verified
    const isApproved = Boolean(
      (user?.isVerified || user?.verificationStatus === 'approved') &&
      ((driverProfile as any)?.verificationStatus === 'approved' || (driverProfile as any)?.verification_status === 'approved' || user?.verificationStatus === 'approved')
    );

    if (!isOnline && !isApproved) {
      setVerificationModalVisible(true);
      Alert.alert(
        'Account Under Review',
        'Your account documents are currently under review by our safety team. You can go online once approved.'
      );
      return;
    }

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

        await refreshLocation().catch(() => {});

        let tokenToUse = state.token;
        if (!tokenToUse) {
          tokenToUse = (await AsyncStorage.getItem('@shedrive_auth_token')) || undefined;
        }

        const resolvedLat = currentCoords?.latitude || 31.5204;
        const resolvedLng = currentCoords?.longitude || 74.3587;

        // Call backend API to go online (backend will verify driver status)
        const res = await fetch(`${getApiBaseUrl()}/driver/online`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenToUse}`,
          },
          body: JSON.stringify({
            isOnline: true,
            latitude: resolvedLat,
            longitude: resolvedLng,
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

        // Start location watcher if backend approves (throttled to 10m / 4s for zero-lag 60fps performance)
        try {
          const watcher = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 4000,
              distanceInterval: 10,
            },
            async (newLocation) => {
              try {
                if (!newLocation || !newLocation.coords) return;
                const { latitude, longitude, heading } = newLocation.coords;

                const nowMs = Date.now();
                // Update backend with new coordinates throttled to once per 15 seconds to prevent battery drain & network flooding
                if (nowMs - lastHttpLocationSyncRef.current >= 15000) {
                  lastHttpLocationSyncRef.current = nowMs;
                  fetch(`${getApiBaseUrl()}/driver/online`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${state.token}`,
                    },
                    body: JSON.stringify({
                      isOnline: true,
                      latitude,
                      longitude,
                      heading: heading || 0,
                    }),
                  }).catch((err) => console.warn('[Driver Location Sync Warning]:', err?.message));
                }

                // Also update Firestore for real-time passenger visibility
                if (user?.uid) {
                  const driverRef = doc(db, 'drivers', user.uid);
                  await updateDoc(driverRef, {
                    isOnline: true,
                    latitude,
                    longitude,
                    heading: heading || 0,
                    lastUpdated: Date.now(),
                  }).catch(() => {});
                }

                if (mapRef.current) {
                  mapRef.current.setCenter(latitude, longitude);
                }
              } catch (locErr) {
                console.warn('[Driver Location Watcher Callback Warning]:', locErr);
              }
            }
          );

          locationWatcherRef.current = watcher;
        } catch (watchErr) {
          console.warn('[Driver Location Watcher Init Warning]:', watchErr);
        }

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
            Authorization: `Bearer ${state.token}`,
          },
          body: JSON.stringify({
            isOnline: false,
          }),
        }).catch(() => {});

        // Also update Firestore
        if (user?.uid) {
          const driverRef = doc(db, 'drivers', user.uid);
          await updateDoc(driverRef, {
            isOnline: false,
            lastUpdated: Date.now(),
          }).catch(() => {});
        }

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
    if (!user || !ride) return;

    try {
      const rideRef = doc(db, 'rides', ride.rideId);
      const vehicleDetails = vehicle.make ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : 'Registered Vehicle';

      await updateDoc(rideRef, {
        status: 'accepted',
        driverId: user.uid,
        driverName: user.name || 'Driver',
        driverPhone: user.phone || '',
        driverVehicle: vehicleDetails,
        autoMessageSent: true,
        updatedAt: Date.now(),
      });

      // Auto-send welcoming message to ride chat
      try {
        const chatCollectionRef = collection(db, 'rides', ride.rideId, 'messages');
        await addDoc(chatCollectionRef, {
          senderId: user.uid,
          senderName: user.name || 'Driver',
          senderRole: 'driver',
          text: `Assalam-o-Alaikum! I have accepted your SheDrive booking and I am on my way to your pickup location (${ride.pickup?.label || 'pickup point'}). See you soon!`,
          timestamp: Date.now(),
        });
      } catch (chatErr) {
        console.warn('Auto message send warning:', chatErr);
      }

      // Sync accepted status to backend PostgreSQL
      try {
        await fetch(`${getApiBaseUrl()}/rides/${ride.rideId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`,
          },
          body: JSON.stringify({
            status: 'accepted',
            driverId: user.uid,
            driverName: user.name,
            driverPhone: user.phone,
            driverVehicle: vehicleDetails,
            currentFare: ride.currentFare,
          }),
        });
      } catch (backendErr) {
        console.warn('Backend ride accept sync warning:', backendErr);
      }

      Alert.alert('Success', 'Ride accepted! Navigating to trip tracking.');
      navigation.navigate('ActiveRide', { rideId: ride.rideId });
    } catch (error) {
      console.error('Accept ride failed:', error);
      Alert.alert('Accept Failed', 'Could not accept ride offer. It might have been taken by another driver.');
    }
  };

  const openCounterModal = (ride: RideRequest) => {
    if (!ride) return;
    setSelectedRide(ride);
    setCounterAmount(((ride.currentFare || 0) + 50).toString());
    setCounterModalVisible(true);
  };

  const handleSendCounterOffer = async () => {
    if (!user || !selectedRide) return;

    const amountNum = parseInt(counterAmount, 10);
    if (isNaN(amountNum) || amountNum <= (selectedRide.currentFare || 0)) {
      Alert.alert('Invalid Fare', `Counter bid must be greater than current fare: ${formatCurrency(selectedRide.currentFare || 0)}`);
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

      const existingOffers = Array.isArray(selectedRide.offers) ? selectedRide.offers : [];

      await updateDoc(rideRef, {
        status: 'negotiating',
        currentFare: amountNum,
        offers: [...existingOffers, driverOffer],
        updatedAt: Date.now(),
      });

      // Sync counter offer to backend PostgreSQL
      try {
        await fetch(`${getApiBaseUrl()}/rides/${selectedRide.rideId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`,
          },
          body: JSON.stringify({
            status: 'negotiating',
            currentFare: amountNum,
          }),
        });
      } catch (backendErr) {
        console.warn('Backend counter offer sync warning:', backendErr);
      }

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
  const mapMarkers = useMemo((): MapMarker[] => {
    const markers: MapMarker[] = [];
    if (currentCoords && typeof currentCoords.latitude === 'number' && typeof currentCoords.longitude === 'number') {
      markers.push({
        id: 'driver_current',
        lat: currentCoords.latitude,
        lng: currentCoords.longitude,
        emoji: '🚗',
        title: 'My Location',
        isDriver: true,
      });
    }

    // Show pickup markers for available rides on the map safely
    if (Array.isArray(availableRides)) {
      availableRides.forEach((ride) => {
        if (ride?.rideId && ride.pickup && typeof ride.pickup.latitude === 'number' && typeof ride.pickup.longitude === 'number') {
          markers.push({
            id: ride.rideId,
            lat: ride.pickup.latitude,
            lng: ride.pickup.longitude,
            emoji: '📍',
            title: `Ride Offer: ${formatCurrency(ride.currentFare || 0)}`,
            isCustomer: true,
          });
        }
      });
    }

    return markers;
  }, [currentCoords, availableRides]);

  const defaultCenter = useMemo(() => {
    if (currentCoords && typeof currentCoords.latitude === 'number' && typeof currentCoords.longitude === 'number') {
      return { lat: currentCoords.latitude, lng: currentCoords.longitude };
    }
    return { lat: 31.5204, lng: 74.3587 };
  }, [currentCoords]);

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
        <View style={{ position: 'relative', marginRight: 8 }}>
          <TouchableOpacity
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primaryGhost, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => navigation.navigate('NotificationCenter')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>🔔</Text>
          </TouchableOpacity>
          {unreadCount > 0 && (
            <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.feeShortcutButton}
          onPress={() => navigation.navigate('MonthlyPayment')}
          activeOpacity={0.8}
        >
          <Text style={styles.feeShortcutText}>💳 Fee Statement</Text>
        </TouchableOpacity>
      </View>

      {/* Driver Verification Status Banner */}
      {!isDriverVerified && (
        <TouchableOpacity
          style={styles.verificationBanner}
          onPress={() => setVerificationModalVisible(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.verificationBannerIcon}>🔍</Text>
          <View style={styles.verificationBannerTextContainer}>
            <Text style={styles.verificationBannerTitle}>Verification in Progress</Text>
            <Text style={styles.verificationBannerSub}>Tap to view 4-step approval checklist</Text>
          </View>
          <Text style={styles.verificationBannerChevron}>›</Text>
        </TouchableOpacity>
      )}

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Embedded Map */}
      <View style={styles.mapContainer}>
        <LeafletMap
          ref={mapRef}
          center={defaultCenter}
          markers={mapMarkers}
        />
        {/* Non-blocking smooth loading indicator over map */}
        {isLocationLoading && !currentCoords && (
          <View style={styles.mapLoadingBadge}>
            <ActivityIndicator size="small" color={Colors.light.primary} />
            <Text style={styles.mapLoadingText}>Loading map...</Text>
          </View>
        )}
      </View>

      {/* Available Ride Offers Dashboard */}
      {isOnline && (
        <View style={styles.offersContainer}>
          <Text style={styles.offersHeading}>
            Available Ride Offers ({Array.isArray(availableRides) ? availableRides.length : 0})
          </Text>

          {!Array.isArray(availableRides) || availableRides.length === 0 ? (
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
                const timeRemaining = rideTimers[item.rideId] ?? 10;
                const isExpired = timeRemaining <= 0;

                return (
                  <View style={[styles.rideCard, isExpired && styles.rideCardExpired]}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.passengerLabel}>👩 {item.passengerName || 'Passenger'}</Text>
                      <Text style={styles.fareLabel}>{formatCurrency(item.currentFare || 0)}</Text>
                    </View>

                    <View style={styles.routeContainer}>
                      <Text style={styles.routeText} numberOfLines={1}>🟢 {item.pickup?.label || 'Pickup point'}</Text>
                      <Text style={styles.routeText} numberOfLines={1}>🔴 {item.dropoff?.label || 'Drop-off point'}</Text>
                    </View>

                    <View style={styles.cardDetails}>
                      <Text style={styles.detailText}>{(item.distanceKm || 0).toFixed(1)} km</Text>
                      <View style={styles.dotSeparator} />
                      <Text style={styles.detailText}>{Math.round(item.durationMin || 0)} mins</Text>
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

      {/* Floating Recenter GPS Target Button */}
      <TouchableOpacity
        style={styles.floatingRecenterBtn}
        onPress={async () => {
          try {
            await refreshLocation();
            if (currentCoords?.latitude && currentCoords?.longitude && mapRef.current) {
              mapRef.current.setCenter(currentCoords.latitude, currentCoords.longitude, 16);
            }
          } catch (err) {
            console.warn('[Driver Recenter Location Warning]:', err);
          }
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingRecenterIcon}>🎯</Text>
      </TouchableOpacity>

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
                Passenger current bid: {formatCurrency(selectedRide.currentFare || 0)}
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

      {/* Driver Step-by-Step Verification Status Stepper Modal */}
      <DriverVerificationStatusModal
        visible={verificationModalVisible}
        onClose={() => setVerificationModalVisible(false)}
        driverProfile={driverProfile}
        verificationStatus={verificationStatus}
        rejectionReason={rejectionReason}
        onRefresh={() => refreshLocation()}
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
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  verificationBannerIcon: {
    fontSize: 18,
  },
  verificationBannerTextContainer: {
    flex: 1,
  },
  verificationBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  verificationBannerSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  verificationBannerChevron: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400E',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: 8,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapLoadingBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
    zIndex: 10,
  },
  mapLoadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    marginLeft: 6,
  },
  offersContainer: {
    position: 'absolute',
    bottom: 84,
    left: 0,
    right: 0,
    maxHeight: 220,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  offersHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  emptyOffersBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  offersList: {
    paddingHorizontal: 12,
    gap: 12,
  },
  rideCard: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  rideCardExpired: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  passengerLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  fareLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  routeContainer: {
    gap: 3,
    marginBottom: 6,
  },
  routeText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  detailText: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    fontWeight: '600',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.light.textTertiary,
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  timerTextExpired: {
    color: '#EF4444',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  counterBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.light.primaryGhost,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    alignItems: 'center',
  },
  counterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  floatingRecenterBtn: {
    position: 'absolute',
    right: 18,
    bottom: 95,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    zIndex: 99,
  },
  floatingRecenterIcon: {
    fontSize: 22,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  toggleButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonOnline: {
    backgroundColor: Colors.light.primary,
  },
  buttonOffline: {
    backgroundColor: '#EF4444',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 4,
  },
  modalSubheading: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 20,
    gap: 8,
  },
  modalCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  modalInput: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    minWidth: 100,
    textAlign: 'center',
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
    borderRadius: 12,
    backgroundColor: Colors.light.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
