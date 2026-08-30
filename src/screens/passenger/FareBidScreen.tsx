import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  TextInput,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  BackHandler,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { PassengerStackParamList, RideRequest, VehicleCategory, LocationPoint, OSRMRoute } from '../../types';
import Colors from '../../constants/Colors';
import { VEHICLE_CATEGORIES, DEFAULT_VEHICLE_CATEGORY } from '../../constants/VehicleCategories';
import { calculateFare, adjustFareStep, validateFareOffer, calculateUrbanTripDuration } from '../../utils/fareCalculator';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import { formatCurrency } from '../../utils/helpers';
import { LeafletMap } from '../../components/LeafletMap';
import { GoogleMapViewRef } from '../../components/GoogleMapView';
import { RideBookingSummaryModal } from '../../components/RideBookingSummaryModal';

type FareBidScreenNavigationProp = StackNavigationProp<PassengerStackParamList, 'FareBid'>;
type FareBidScreenRouteProp = RouteProp<PassengerStackParamList, 'FareBid'>;

interface Props {
  navigation: FareBidScreenNavigationProp;
  route: FareBidScreenRouteProp;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_PEEK = Math.round(SCREEN_HEIGHT * 0.22);
const SNAP_HALF = Math.round(SCREEN_HEIGHT * 0.52);
const SNAP_FULL = Math.round(SCREEN_HEIGHT * 0.88);

export default function FareBidScreen({ navigation, route }: Props): React.JSX.Element {
  const { pickup: initPickup, destination: initDestination, route: initRouteData, stops = [], isScheduled: initScheduled = false, scheduledFor: initScheduledFor = null } = route.params;
  const { state } = useApp();
  const user = state.user;

  // Reactive state for pickup, destination, and calculated route
  const [pickup, setPickup] = useState<LocationPoint>(initPickup);
  const [destination, setDestination] = useState<LocationPoint>(initDestination);
  const [routeData, setRouteData] = useState<OSRMRoute>(initRouteData);

  // Sync state if navigation params update (e.g. returning from re-selecting location)
  useEffect(() => {
    if (route.params.pickup) setPickup(route.params.pickup);
    if (route.params.destination) setDestination(route.params.destination);
    if (route.params.route) setRouteData(route.params.route);
  }, [route.params.pickup, route.params.destination, route.params.route]);

  // Route metrics
  const distanceKm = (routeData?.distance || 0) / 1000;
  const initialDurationMin = calculateUrbanTripDuration(DEFAULT_VEHICLE_CATEGORY.id, distanceKm);

  // Vehicle Category Selection State
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>(DEFAULT_VEHICLE_CATEGORY);
  const [durationMin, setDurationMin] = useState<number>(initialDurationMin);

  // Compute estimated fare for current selection
  const estimatedFare = calculateFare(selectedCategory, distanceKm, durationMin);

  // User Custom Bid Offer & Summary Modal state
  const [bidAmount, setBidAmount] = useState<number>(estimatedFare);
  const [bidInput, setBidInput] = useState<string>(estimatedFare.toString());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState<boolean>(false);

  // Payment Method Selection (Cash)
  const [paymentMethod] = useState<'cash' | 'jazzcash' | 'easypaisa'>('cash');

  // Scheduled Booking State
  const [isScheduled, setIsScheduled] = useState<boolean>(Boolean(initScheduled));
  const [scheduledHoursAdvance, setScheduledHoursAdvance] = useState<number>(1);
  const scheduledTimestamp = Date.now() + scheduledHoursAdvance * 60 * 60 * 1000;

  // Map Ref for recentering
  const mapRef = useRef<GoogleMapViewRef>(null);

  // Bottom Sheet Animation & Gestures
  const sheetHeight = useRef(new Animated.Value(SNAP_HALF)).current;
  const lastHeight = useRef(SNAP_HALF);
  const [snapState, setSnapState] = useState<'peek' | 'half' | 'full'>('half');

  const animateToSnap = useCallback(
    (targetSnap: number, stateName: 'peek' | 'half' | 'full') => {
      lastHeight.current = targetSnap;
      setSnapState(stateName);
      Animated.spring(sheetHeight, {
        toValue: targetSnap,
        friction: 8,
        tension: 50,
        useNativeDriver: false,
      }).start();
    },
    [sheetHeight]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        const newHeight = lastHeight.current - gestureState.dy;
        if (newHeight >= SNAP_PEEK * 0.85 && newHeight <= SNAP_FULL * 1.05) {
          sheetHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentH = lastHeight.current - gestureState.dy;
        const vy = gestureState.vy;

        // Fast flick handling
        if (vy > 0.4) {
          if (currentH > SNAP_HALF + 40) {
            animateToSnap(SNAP_HALF, 'half');
          } else {
            animateToSnap(SNAP_PEEK, 'peek');
          }
          return;
        }
        if (vy < -0.4) {
          if (currentH < SNAP_HALF - 40) {
            animateToSnap(SNAP_HALF, 'half');
          } else {
            animateToSnap(SNAP_FULL, 'full');
          }
          return;
        }

        // Positional snapping
        const distToPeek = Math.abs(currentH - SNAP_PEEK);
        const distToHalf = Math.abs(currentH - SNAP_HALF);
        const distToFull = Math.abs(currentH - SNAP_FULL);

        if (distToPeek <= distToHalf && distToPeek <= distToFull) {
          animateToSnap(SNAP_PEEK, 'peek');
        } else if (distToHalf <= distToPeek && distToHalf <= distToFull) {
          animateToSnap(SNAP_HALF, 'half');
        } else {
          animateToSnap(SNAP_FULL, 'full');
        }
      },
    })
  ).current;

  // Android hardware/gesture back handler
  useEffect(() => {
    const backAction = () => {
      if (isSummaryVisible) {
        setIsSummaryVisible(false);
        return true;
      }
      navigation.goBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isSummaryVisible, navigation]);

  // Switch Vehicle Category
  const handleSelectCategory = (category: VehicleCategory) => {
    setSelectedCategory(category);
    const newDuration = calculateUrbanTripDuration(category.id, distanceKm);
    setDurationMin(newDuration);
    const newEstFare = calculateFare(category, distanceKm, newDuration);
    setBidAmount(newEstFare);
    setBidInput(newEstFare.toString());
  };

  // Adjust fare by ±5 PKR respecting dynamic minimum floor
  const handleAdjustStep = (delta: number) => {
    const dynamicFloor = Math.max(selectedCategory.minimumFare, Math.round(calculateFare(selectedCategory, distanceKm, durationMin) * 0.85));
    const nextFare = adjustFareStep(bidAmount, delta, dynamicFloor);
    setBidAmount(nextFare);
    setBidInput(nextFare.toString());
  };

  // Direct numeric input change
  const handleInputChange = (text: string) => {
    setBidInput(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      setBidAmount(parsed);
    }
  };

  const handleOpenSummary = () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to book a ride.');
      return;
    }

    const dynamicFloor = Math.max(selectedCategory.minimumFare, Math.round(calculateFare(selectedCategory, distanceKm, durationMin) * 0.85));
    const validation = validateFareOffer(bidAmount, dynamicFloor);
    if (!validation.isValid) {
      Alert.alert('Fare Floor Protection', `Your offered fare cannot be lower than PKR ${dynamicFloor} for this ${distanceKm.toFixed(1)} km trip.`);
      return;
    }

    setIsSummaryVisible(true);
  };

  const handleConfirmBooking = async () => {
    try {
      setIsLoading(true);

      const ridesCollectionRef = collection(db, 'rides');
      const rideDocRef = doc(ridesCollectionRef);
      const rideId = rideDocRef.id;

      const polylineString = JSON.stringify(routeData.geometry.coordinates);
      const effectiveScheduledFor = isScheduled ? scheduledTimestamp : null;

      const rideRequest: RideRequest = {
        rideId,
        vehicleCategory: selectedCategory.id,
        passengerId: user!.uid,
        passengerName: user!.name,
        passengerPhone: user!.phone,
        pickup,
        dropoff: destination,
        stops: stops.length > 0 ? stops : undefined,
        distanceKm,
        durationMin,
        initialBid: bidAmount,
        currentFare: bidAmount,
        status: isScheduled ? 'scheduled' : 'pending',
        driverId: null,
        driverName: null,
        driverPhone: null,
        driverVehicle: null,
        driverCoords: null,
        offers: [
          {
            senderId: user!.uid,
            role: 'passenger',
            amount: bidAmount,
            timestamp: Date.now(),
          },
        ],
        polyline: polylineString,
        paymentMethod: 'cash',
        isScheduled,
        scheduledFor: effectiveScheduledFor,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(rideDocRef, {
        ...rideRequest,
        serverCreatedAt: serverTimestamp(),
      });

      // Sync to Node.js / PostgreSQL backend server
      try {
        const res = await fetch(`${getApiBaseUrl()}/rides/request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.token}`,
          },
          body: JSON.stringify({
            rideId,
            vehicleCategory: selectedCategory.id,
            pickupLocation: {
              address: pickup.label,
              latitude: pickup.latitude,
              longitude: pickup.longitude,
            },
            destinationLocation: {
              address: destination.label,
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
            distanceKm,
            durationMin,
            estimatedFare: bidAmount,
            offeredFare: bidAmount,
            paymentMethod: 'cash',
            multiStopWaypoints: stops.length > 0 ? stops : undefined,
            isScheduled,
            scheduledFor: effectiveScheduledFor,
          }),
        });

        if (!res.ok) {
          console.warn('Backend ride request sync non-200 response');
        }
      } catch (backendErr) {
        console.warn('Backend ride request sync warning:', backendErr);
      }

      setIsSummaryVisible(false);
      navigation.navigate('RideTracking', { rideId });
    } catch (error: any) {
      console.error('Failed to create ride request:', error);
      Alert.alert('Request Failed', 'Unable to send ride request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getLeafletCoordinates = (): [number, number][] => {
    if (!routeData?.geometry?.coordinates) return [];
    return routeData.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
  };

  const mapMarkers = [
    { id: 'pickup', lat: pickup.latitude, lng: pickup.longitude, emoji: '📍', title: 'Pickup point', isCustomer: true },
    ...(stops || []).map((s, idx) => ({
      id: `stop_${idx}`,
      lat: s.latitude,
      lng: s.longitude,
      emoji: '🟡',
      title: `Stop #${idx + 1}: ${s.label}`,
      isCustomer: false,
    })),
    { id: 'destination', lat: destination.latitude, lng: destination.longitude, emoji: '🏁', title: 'Destination', isDestination: true },
  ];

  // Recenter Map Camera to Route
  const handleRecenterRoute = () => {
    const coords = getLeafletCoordinates();
    if (mapRef.current && coords.length > 0) {
      mapRef.current.fitToCoordinates(
        coords.map((c) => ({ latitude: c[0], longitude: c[1] })),
        true
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Full-Screen Underlying Map */}
      <View style={styles.mapContainer}>
        <LeafletMap
          ref={mapRef}
          center={{ lat: pickup.latitude, lng: pickup.longitude }}
          markers={mapMarkers}
          routeCoordinates={getLeafletCoordinates()}
        />

        {/* Floating Top Back Button */}
        <TouchableOpacity
          style={styles.floatingBackButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.floatingBackText}>←</Text>
        </TouchableOpacity>

        {/* Floating Recenter Route Button */}
        <Animated.View
          style={[
            styles.floatingRecenterContainer,
            {
              bottom: Animated.add(sheetHeight, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={handleRecenterRoute}
            activeOpacity={0.85}
          >
            <Text style={styles.recenterIcon}>🎯</Text>
            <Text style={styles.recenterText}>Recenter Route</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Multi-Snap Gesture-Driven Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheetContainer,
          {
            height: sheetHeight,
          },
        ]}
      >
        {/* Drag Handle & Gesture Target */}
        <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
          <View style={styles.dragIndicator} />
        </View>

        {/* Peek Mode Compact Preview Bar */}
        {snapState === 'peek' && (
          <TouchableOpacity
            style={styles.peekBar}
            onPress={() => animateToSnap(SNAP_HALF, 'half')}
            activeOpacity={0.9}
          >
            <View style={styles.peekVehicleInfo}>
              <Text style={styles.peekIcon}>{selectedCategory.icon}</Text>
              <View>
                <Text style={styles.peekTitle}>{selectedCategory.name}</Text>
                <Text style={styles.peekSub}>
                  {distanceKm.toFixed(1)} km • {Math.round(durationMin)} mins
                </Text>
              </View>
            </View>
            <View style={styles.peekActionRow}>
              <Text style={styles.peekFare}>{formatCurrency(bidAmount)}</Text>
              <TouchableOpacity
                style={styles.peekConfirmPill}
                onPress={handleOpenSummary}
                activeOpacity={0.8}
              >
                <Text style={styles.peekConfirmPillText}>Book</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        {/* Full / Half Sheet Content ScrollView */}
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Two-Way Interactive Location Re-Selection Header */}
          <View style={styles.locationCard}>
            <TouchableOpacity
              style={styles.locationRow}
              onPress={() =>
                navigation.navigate('Search', {
                  pickupPoint: pickup,
                  destPoint: destination,
                  targetField: 'pickup',
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.locationDotGreen} />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>PICKUP LOCATION</Text>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {pickup.label}
                </Text>
              </View>
              <View style={styles.editBadge}>
                <Text style={styles.editText}>✏️ Edit</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.locationDivider} />

            <TouchableOpacity
              style={styles.locationRow}
              onPress={() =>
                navigation.navigate('Search', {
                  pickupPoint: pickup,
                  destPoint: destination,
                  targetField: 'dest',
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.locationDotRed} />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>DESTINATION</Text>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {destination.label}
                </Text>
              </View>
              <View style={styles.editBadge}>
                <Text style={styles.editText}>✏️ Edit</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Route Distance & Live Duration Specs */}
          <View style={styles.specsRow}>
            <View style={styles.specBox}>
              <Text style={styles.specVal}>{distanceKm.toFixed(1)} km</Text>
              <Text style={styles.specLabel}>Distance</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specBox}>
              <Text style={styles.specVal}>{Math.round(durationMin)} mins</Text>
              <Text style={styles.specLabel}>Live Traffic ETA</Text>
            </View>
          </View>

          {/* Vehicle Categories Selection Carousel */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Select Vehicle Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.vehicleCategoriesList}
            >
              {VEHICLE_CATEGORIES.map((cat) => {
                const isSelected = cat.id === selectedCategory.id;
                const catDuration = calculateUrbanTripDuration(cat.id, distanceKm);
                const catFare = calculateFare(cat, distanceKm, catDuration);
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                    onPress={() => handleSelectCategory(cat)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
                      {cat.name}
                    </Text>
                    <Text style={styles.categoryEta}>⏱ {catDuration} mins trip</Text>
                    <Text style={styles.categoryCapacity}>👥 {cat.capacity} seats</Text>
                    <Text style={[styles.categoryPrice, isSelected && styles.categoryPriceSelected]}>
                      {formatCurrency(catFare)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Selected Category Description Banner */}
          <View style={styles.descriptionBanner}>
            <Text style={styles.descriptionText}>{selectedCategory.description}</Text>
            <Text style={styles.minFareNotice}>Min. Fare Protection: PKR {selectedCategory.minimumFare}</Text>
          </View>

          {/* Fare Bidding Stepper Control Panel (±5 PKR) */}
          <View style={styles.bidPanel}>
            <Text style={styles.bidHeading}>Offer Your Price</Text>
            <Text style={styles.estFareLabel}>Est. Base: {formatCurrency(estimatedFare)}</Text>

            <View style={styles.bidSelector}>
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustStep(-5)}
                disabled={isLoading || bidAmount <= selectedCategory.minimumFare}
              >
                <Text style={styles.adjustText}>-5</Text>
              </TouchableOpacity>

              <View style={styles.bidAmountBox}>
                <Text style={styles.bidCurrency}>PKR</Text>
                <TextInput
                  style={styles.bidInput}
                  value={bidInput}
                  onChangeText={handleInputChange}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>

              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => handleAdjustStep(5)}
                disabled={isLoading}
              >
                <Text style={styles.adjustText}>+5</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Departure Time Options (Ride Now vs Scheduled) */}
          <View style={styles.sectionContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>Departure Time</Text>
              <TouchableOpacity
                onPress={() => setIsScheduled(!isScheduled)}
                style={{
                  backgroundColor: isScheduled ? Colors.light.primary : Colors.light.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isScheduled ? Colors.light.primary : Colors.light.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: isScheduled ? Colors.light.textOnPrimary : Colors.light.text }}>
                  {isScheduled ? '🕒 Scheduled' : '⚡ Ride Now'}
                </Text>
              </TouchableOpacity>
            </View>

            {isScheduled && (
              <View style={styles.scheduledWindowCard}>
                <Text style={{ fontSize: 13, color: Colors.light.textSecondary }}>Select advance booking window:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { label: '+1 Hour', hours: 1 },
                    { label: '+2 Hours', hours: 2 },
                    { label: '+4 Hours', hours: 4 },
                    { label: 'Tomorrow', hours: 24 },
                  ].map((preset) => {
                    const isPresetActive = scheduledHoursAdvance === preset.hours;
                    return (
                      <TouchableOpacity
                        key={preset.label}
                        onPress={() => setScheduledHoursAdvance(preset.hours)}
                        style={{
                          backgroundColor: isPresetActive ? Colors.light.primary : Colors.light.background,
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isPresetActive ? Colors.light.primary : Colors.light.border,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isPresetActive ? Colors.light.textOnPrimary : Colors.light.text }}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.light.primary, marginTop: 4 }}>
                  🕒 Scheduled for: {new Date(scheduledTimestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
              </View>
            )}
          </View>

          {/* Payment Method Badge (Direct Cash) */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.cashPaymentCard}>
              <Text style={{ fontSize: 22 }}>💵</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#065F46' }}>Cash on Completion</Text>
                <Text style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>Direct cash payment to driver upon arrival</Text>
              </View>
            </View>
          </View>

          {/* Main Action Request Button */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.requestButton,
                bidAmount < selectedCategory.minimumFare && styles.requestButtonDisabled,
              ]}
              onPress={handleOpenSummary}
              disabled={isLoading || bidAmount < selectedCategory.minimumFare}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.light.textOnPrimary} />
              ) : (
                <Text style={styles.requestButtonText}>
                  {isScheduled ? 'Schedule' : 'Request'} {selectedCategory.name} ({formatCurrency(bidAmount)})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Ride Booking Summary Modal */}
      <RideBookingSummaryModal
        visible={isSummaryVisible}
        pickup={pickup}
        destination={destination}
        stops={stops}
        isScheduled={isScheduled}
        scheduledFor={isScheduled ? scheduledTimestamp : null}
        paymentMethod={paymentMethod === 'cash' ? 'Cash on Arrival' : paymentMethod === 'jazzcash' ? 'JazzCash MWALLET' : 'Easypaisa MA'}
        category={selectedCategory}
        distanceKm={distanceKm}
        durationMin={durationMin}
        estimatedFare={estimatedFare}
        offeredFare={bidAmount}
        onConfirm={handleConfirmBooking}
        onCancel={() => setIsSummaryVisible(false)}
        isLoading={isLoading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  floatingBackButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 10,
    padding: 0,
  },
  floatingBackText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    lineHeight: Platform.OS === 'ios' ? 24 : 26,
    includeFontPadding: false,
    marginTop: Platform.OS === 'ios' ? -2 : -1,
  },
  floatingRecenterContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  recenterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  recenterIcon: {
    fontSize: 16,
  },
  recenterText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  bottomSheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  dragHandleArea: {
    width: '100%',
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dragIndicator: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  peekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  peekVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peekIcon: {
    fontSize: 28,
  },
  peekTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
  },
  peekSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  peekActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  peekFare: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  peekConfirmPill: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  peekConfirmPillText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingBottom: 40,
  },
  locationCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    backgroundColor: Colors.light.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  locationDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  locationDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 2,
  },
  editBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  editText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  locationDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
    marginLeft: 24,
  },
  specsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  specBox: {
    flex: 1,
    alignItems: 'center',
  },
  specVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
  },
  specLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  specDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.light.border,
  },
  sectionContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  vehicleCategoriesList: {
    gap: 12,
    paddingRight: 10,
  },
  categoryCard: {
    width: 110,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    alignItems: 'center',
    gap: 4,
  },
  categoryCardSelected: {
    backgroundColor: '#FFF0F5',
    borderColor: Colors.light.primary,
  },
  categoryIcon: {
    fontSize: 26,
    marginBottom: 2,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  categoryNameSelected: {
    color: Colors.light.primary,
    fontWeight: '800',
  },
  categoryEta: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  categoryCapacity: {
    fontSize: 10,
    color: Colors.light.textTertiary,
  },
  categoryPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.light.text,
    marginTop: 4,
  },
  categoryPriceSelected: {
    color: Colors.light.primary,
  },
  descriptionBanner: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  descriptionText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  minFareNotice: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  bidPanel: {
    marginHorizontal: 16,
    backgroundColor: Colors.light.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  bidHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.text,
  },
  estFareLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  bidSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  adjustBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
  },
  adjustText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  bidAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: 120,
    justifyContent: 'center',
    gap: 6,
  },
  bidCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  bidInput: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.light.text,
    padding: 0,
  },
  scheduledWindowCard: {
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 8,
  },
  cashPaymentCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionContainer: {
    marginHorizontal: 16,
    marginTop: 10,
  },
  requestButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  requestButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
