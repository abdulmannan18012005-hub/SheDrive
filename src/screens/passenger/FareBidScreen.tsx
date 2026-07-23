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
import { calculateFare, adjustFareStep, validateFareOffer } from '../../utils/fareCalculator';
import { useApp } from '../../contexts/AppContext';
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
  const { pickup, destination, route: routeData } = route.params;
  const { state, dispatch } = useApp();
  const user = state.user;

  // Route metrics
  const distanceKm = routeData.distance / 1000;
  const durationMin = routeData.duration / 60;

  // Vehicle Category Selection State
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>(DEFAULT_VEHICLE_CATEGORY);

  // Compute estimated fare for current selection
  const estimatedFare = calculateFare(selectedCategory, distanceKm, durationMin);

  // User Custom Bid Offer & Summary Modal state
  const [bidAmount, setBidAmount] = useState<number>(estimatedFare);
  const [bidInput, setBidInput] = useState<string>(estimatedFare.toString());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState<boolean>(false);

  // Switch Vehicle Category
  const handleSelectCategory = (category: VehicleCategory) => {
    setSelectedCategory(category);
    const newEstFare = calculateFare(category, distanceKm, durationMin);
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

      const rideRequest: RideRequest = {
        rideId,
        vehicleCategory: selectedCategory.id,
        passengerId: user!.uid,
        passengerName: user!.name,
        passengerPhone: user!.phone,
        pickup,
        dropoff: destination,
        distanceKm,
        durationMin,
        initialBid: bidAmount,
        currentFare: bidAmount,
        status: 'pending',
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(rideDocRef, {
        ...rideRequest,
        serverCreatedAt: serverTimestamp(),
      });

      setIsSummaryVisible(false);
      dispatch({ type: 'SET_ACTIVE_RIDE', payload: rideRequest });
      navigation.navigate('RideTracking', { rideId });
    } catch (error) {
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
    { id: 'pickup', lat: pickup.latitude, lng: pickup.longitude, emoji: '🟢', title: 'Pickup point' },
    { id: 'destination', lat: destination.latitude, lng: destination.longitude, emoji: '🔴', title: 'Destination' },
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
              const catFare = calculateFare(cat, distanceKm, durationMin);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  onPress={() => handleSelectCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>{cat.name}</Text>
                  <Text style={styles.categoryEta}>⏱ {cat.estimatedEtaMins} min</Text>
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
                Review {selectedCategory.name} Request ({formatCurrency(bidAmount)})
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
    width: 120,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.surface,
    alignItems: 'center',
  },
  categoryCardSelected: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
  },
  categoryIcon: {
    fontSize: 28,
    marginBottom: 6,
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
  },
  categoryCapacity: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  categoryPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.light.text,
  },
  categoryPriceSelected: {
    color: Colors.light.primary,
  },
  descriptionBanner: {
    marginHorizontal: 20,
    padding: 12,
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  minFareNotice: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
    textAlign: 'center',
  },
  bidPanel: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  bidHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  estFareLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  bidSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  adjustBtn: {
    width: 54,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustText: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  bidAmountBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    borderBottomWidth: 2,
    borderBottomColor: Colors.light.primary,
    paddingHorizontal: 8,
  },
  bidCurrency: {
    fontSize: 11,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  bidInput: {
    fontSize: 26,
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
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  requestButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  requestButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
});
