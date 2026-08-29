import React, { useState } from 'react';
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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { PassengerStackParamList, RideRequest, VehicleCategory } from '../../types';
import Colors from '../../constants/Colors';
import { VEHICLE_CATEGORIES, DEFAULT_VEHICLE_CATEGORY } from '../../constants/VehicleCategories';
import { calculateFare, adjustFareStep, validateFareOffer, calculateUrbanTripDuration } from '../../utils/fareCalculator';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';
import { formatCurrency } from '../../utils/helpers';
import { LeafletMap } from '../../components/LeafletMap';
import { RideBookingSummaryModal } from '../../components/RideBookingSummaryModal';

type FareBidScreenNavigationProp = StackNavigationProp<PassengerStackParamList, 'FareBid'>;
type FareBidScreenRouteProp = RouteProp<PassengerStackParamList, 'FareBid'>;

interface Props {
  navigation: FareBidScreenNavigationProp;
  route: FareBidScreenRouteProp;
}

export default function FareBidScreen({ navigation, route }: Props): React.JSX.Element {
  const { pickup, destination, route: routeData, stops = [], isScheduled: initScheduled = false, scheduledFor: initScheduledFor = null } = route.params;
  const { state, dispatch } = useApp();
  const user = state.user;

  // Route metrics
  const distanceKm = routeData.distance / 1000;
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

  // Payment Method Selection (Phase 10: Cash, JazzCash Sandbox, Easypaisa Sandbox)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'jazzcash' | 'easypaisa'>('cash');
  const [mobileAccountNo, setMobileAccountNo] = useState<string>(user?.phone || '');

  // Scheduled Booking State (Phase 10: Book in advance)
  const [isScheduled, setIsScheduled] = useState<boolean>(Boolean(initScheduled));
  const [scheduledHoursAdvance, setScheduledHoursAdvance] = useState<number>(1);
  const scheduledTimestamp = Date.now() + scheduledHoursAdvance * 60 * 60 * 1000;

  // Switch Vehicle Category
  const handleSelectCategory = (category: VehicleCategory) => {
    setSelectedCategory(category);
    const newDuration = calculateUrbanTripDuration(category.id, distanceKm);
    setDurationMin(newDuration);
    const newEstFare = calculateFare(category, distanceKm, newDuration);
    setBidAmount(newEstFare);
    setBidInput(newEstFare.toString());
  };

  // Adjust fare by ±5 PKR
  const handleAdjustStep = (delta: number) => {
    const nextFare = adjustFareStep(bidAmount, delta, selectedCategory.minimumFare);
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

    const validation = validateFareOffer(bidAmount, selectedCategory.minimumFare);
    if (!validation.isValid) {
      Alert.alert('Minimum Fare Protection', validation.errorMessage || 'Invalid fare offer.');
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
          const errData = await res.json().catch(() => ({}));
          console.warn('Backend ride request sync non-200:', errData.error);
        }
      } catch (backendErr: any) {
        console.error('Backend ride request sync error:', backendErr?.message || backendErr);
      }

      setIsSummaryVisible(false);
      dispatch({ type: 'SET_ACTIVE_RIDE', payload: rideRequest });
      navigation.navigate('RideTracking', { rideId });
    } catch (error: any) {
      console.error('Failed to create ride request:', error);
      Alert.alert('Request Failed', 'Unable to send ride request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getLeafletCoordinates = (): [number, number][] => {
    if (!routeData.geometry || !routeData.geometry.coordinates) return [];
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Route Map Preview */}
      <View style={styles.mapPreview}>
        <LeafletMap
          center={{ lat: pickup.latitude, lng: pickup.longitude }}
          markers={mapMarkers}
          routeCoordinates={getLeafletCoordinates()}
        />
      </View>

      <ScrollView style={styles.detailsCard} contentContainerStyle={styles.scrollContent}>
        {/* Route header */}
        <View style={styles.routeHeader}>
          <View style={styles.locationContainer}>
            <Text style={styles.dot}>🟢</Text>
            <Text style={styles.locationText} numberOfLines={1}>{pickup.label}</Text>
          </View>
          <View style={styles.locationContainer}>
            <Text style={styles.dot}>🔴</Text>
            <Text style={styles.locationText} numberOfLines={1}>{destination.label}</Text>
          </View>
        </View>

        {/* Distance/Duration specs */}
        <View style={styles.specsRow}>
          <View style={styles.specBox}>
            <Text style={styles.specVal}>{distanceKm.toFixed(1)} km</Text>
            <Text style={styles.specLabel}>Distance</Text>
          </View>
          <View style={styles.specDivider} />
          <View style={styles.specBox}>
            <Text style={styles.specVal}>{Math.round(durationMin)} mins</Text>
            <Text style={styles.specLabel}>Est. Duration</Text>
          </View>
        </View>

        {/* Vehicle Categories Selection */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Select Vehicle Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleCategoriesList}>
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
                  <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>{cat.name}</Text>
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

        {/* Selected Category Description */}
        <View style={styles.descriptionBanner}>
          <Text style={styles.descriptionText}>{selectedCategory.description}</Text>
          <Text style={styles.minFareNotice}>Min. Fare Protection: PKR {selectedCategory.minimumFare}</Text>
        </View>

        {/* Fare Control Panel (±5 PKR steps & manual typing) */}
        <View style={styles.bidPanel}>
          <Text style={styles.bidHeading}>Offer Your Price</Text>
          <Text style={styles.estFareLabel}>Est. Fare: {formatCurrency(estimatedFare)}</Text>

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

        {/* Scheduled Booking Options (Phase 10) */}
        <View style={styles.sectionContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionTitle}>Departure Time</Text>
            <TouchableOpacity 
              onPress={() => setIsScheduled(!isScheduled)}
              style={{ backgroundColor: isScheduled ? Colors.light.primary : Colors.light.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: isScheduled ? Colors.light.primary : Colors.light.border }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: isScheduled ? Colors.light.textOnPrimary : Colors.light.text }}>
                {isScheduled ? '🕒 Scheduled' : '⚡ Ride Now'}
              </Text>
            </TouchableOpacity>
          </View>

          {isScheduled && (
            <View style={{ backgroundColor: Colors.light.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.light.border, gap: 10 }}>
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

        {/* Payment Method Display (Cash Only) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={{
            backgroundColor: '#ECFDF5',
            borderColor: '#10B981',
            borderWidth: 1.5,
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginHorizontal: 20,
          }}>
            <Text style={{ fontSize: 22 }}>💵</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#065F46' }}>Cash on Completion</Text>
              <Text style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>Direct cash payment to driver upon arrival at destination</Text>
            </View>
          </View>
        </View>

        {/* Action confirmation button */}
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
  mapPreview: {
    height: '35%',
    width: '100%',
  },
  detailsCard: {
    flex: 1,
    backgroundColor: Colors.light.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingTop: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  routeHeader: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    fontSize: 14,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  specsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  specBox: {
    flex: 1,
    alignItems: 'center',
  },
  specVal: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  specLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  specDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.light.border,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  vehicleCategoriesList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryCard: {
    width: 124,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
    shadowColor: Colors.light.primary,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryNameSelected: {
    color: Colors.light.primary,
  },
  categoryEta: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
  },
  categoryCapacity: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  categoryPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.light.text,
  },
  categoryPriceSelected: {
    color: Colors.light.primary,
  },
  descriptionBanner: {
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: Colors.light.primaryGhost,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '500',
  },
  minFareNotice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
    textAlign: 'center',
  },
  bidPanel: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    backgroundColor: Colors.light.surface,
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  bidHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 2,
  },
  estFareLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
    fontWeight: '500',
  },
  bidSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  adjustBtn: {
    width: 56,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustText: {
    color: Colors.light.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  bidAmountBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
    borderBottomWidth: 2.5,
    borderBottomColor: Colors.light.primary,
    paddingHorizontal: 12,
  },
  bidCurrency: {
    fontSize: 11,
    color: Colors.light.primary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bidInput: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.light.text,
    textAlign: 'center',
    minWidth: 80,
    paddingVertical: 2,
  },
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  requestButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  requestButtonDisabled: {
    backgroundColor: Colors.light.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  requestButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
