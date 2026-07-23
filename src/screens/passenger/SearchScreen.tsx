import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { PassengerStackParamList, NominatimResult, LocationPoint } from '../../types';
import Colors from '../../constants/Colors';
import { searchAddress, reverseGeocode } from '../../services/nominatim';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocation } from '../../hooks/useLocation';
import { getRoute } from '../../services/osrm';
import { SkeletonLoader } from '../../components/SkeletonLoader';

type SearchScreenNavigationProp = StackNavigationProp<PassengerStackParamList, 'Search'>;
type SearchScreenRouteProp = RouteProp<PassengerStackParamList, 'Search'>;

interface Props {
  navigation: SearchScreenNavigationProp;
  route: SearchScreenRouteProp;
}

export default function SearchScreen({ navigation, route }: Props): React.JSX.Element {
  const { location: gpsCoords } = useLocation();

  const [pickupText, setPickupText] = useState('');
  const [destText, setDestText] = useState('');
  const [activeField, setActiveField] = useState<'pickup' | 'dest'>('dest');

  const [pickupPoint, setPickupPoint] = useState<LocationPoint | null>(null);
  const [destPoint, setDestPoint] = useState<LocationPoint | null>(null);

  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Debounced inputs for geocoder query
  const debouncedPickup = useDebounce(pickupText, 600);
  const debouncedDest = useDebounce(destText, 600);

  // Auto-reverse geocode current position for Pickup
  useEffect(() => {
    const initPickup = async () => {
      if (gpsCoords) {
        setPickupText('My Location');
        const readableAddress = await reverseGeocode(gpsCoords.latitude, gpsCoords.longitude);
        const labelName = readableAddress || 'Current Location';
        setPickupPoint({
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
          label: labelName,
        });
      }
    };
    initPickup();
  }, [gpsCoords]);

  // Execute address search query when debounced text updates
  useEffect(() => {
    const runSearch = async () => {
      const activeQuery = activeField === 'pickup' ? debouncedPickup : debouncedDest;
      if (!activeQuery || activeQuery.trim().length < 3 || activeQuery === 'My Location') {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const places = await searchAddress(activeQuery);
        setSearchResults(places);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    };

    runSearch();
  }, [debouncedPickup, debouncedDest, activeField]);

  const handleSelectItem = (item: NominatimResult) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const shortLabel = item.display_name.split(',')[0];

    const selectedPoint: LocationPoint = {
      latitude: lat,
      longitude: lon,
      label: shortLabel,
    };

    if (activeField === 'pickup') {
      setPickupPoint(selectedPoint);
      setPickupText(shortLabel);
      setSearchResults([]);
      setActiveField('dest'); // Auto switch focus
    } else {
      setDestPoint(selectedPoint);
      setDestText(shortLabel);
      setSearchResults([]);
    }
  };

  const handleConfirmRoute = async () => {
    if (!pickupPoint || !destPoint) {
      Alert.alert('Validation Error', 'Please select both pickup and destination locations.');
      return;
    }

    try {
      setIsCalculatingRoute(true);
      // Calculate routing details using OSRM
      const osrmRoute = await getRoute(
        pickupPoint.latitude,
        pickupPoint.longitude,
        destPoint.latitude,
        destPoint.longitude
      );

      if (!osrmRoute) {
        throw new Error('Could not calculate a viable driving route.');
      }

      // Navigate to Bidding screen (FareBid)
      navigation.navigate('FareBid', {
        pickup: pickupPoint,
        destination: destPoint,
        route: osrmRoute,
      });
    } catch (error) {
      Alert.alert('Route Error', 'Unable to calculate route. Please try again.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        {/* Input Panel Card */}
        <View style={styles.inputCard}>
          <View style={styles.fieldRow}>
            <Text style={styles.bulletDot}>🟢</Text>
            <TextInput
              style={[styles.textInput, activeField === 'pickup' && styles.textInputFocused]}
              placeholder="Enter pickup point"
              placeholderTextColor={Colors.light.textTertiary}
              value={pickupText}
              onChangeText={(text) => {
                setPickupText(text);
                if (pickupPoint) setPickupPoint(null);
              }}
              onFocus={() => setActiveField('pickup')}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.bulletDot}>🔴</Text>
            <TextInput
              style={[styles.textInput, activeField === 'dest' && styles.textInputFocused]}
              placeholder="Where to?"
              placeholderTextColor={Colors.light.textTertiary}
              value={destText}
              onChangeText={(text) => {
                setDestText(text);
                if (destPoint) setDestPoint(null);
              }}
              onFocus={() => setActiveField('dest')}
            />
          </View>
        </View>

        {/* Suggestion List / Activity indicators */}
        <View style={styles.listContainer}>
          {isSearching ? (
            <View style={{ padding: 20, gap: 16 }}>
              <SkeletonLoader height={48} borderRadius={12} />
              <SkeletonLoader height={48} borderRadius={12} />
              <SkeletonLoader height={48} borderRadius={12} />
              <SkeletonLoader height={48} borderRadius={12} />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelectItem(item)}
                >
                  <Text style={styles.resultIcon}>📍</Text>
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle}>{item.display_name.split(',')[0]}</Text>
                    <Text style={styles.resultSubtitle} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {/* Continue confirmation button */}
        {pickupPoint && destPoint && (
          <View style={styles.actionPanel}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmRoute}
              disabled={isCalculatingRoute}
              activeOpacity={0.8}
            >
              {isCalculatingRoute ? (
                <ActivityIndicator color={Colors.light.textOnPrimary} />
              ) : (
                <Text style={styles.confirmButtonText}>Calculate Fare & Route</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  inputCard: {
    backgroundColor: Colors.light.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bulletDot: {
    fontSize: 14,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
  },
  textInputFocused: {
    borderColor: Colors.light.primary,
  },
  listContainer: {
    flex: 1,
  },
  spinner: {
    marginTop: 40,
  },
  resultItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    gap: 16,
  },
  resultIcon: {
    fontSize: 20,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  actionPanel: {
    padding: 20,
    backgroundColor: Colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  confirmButton: {
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
  confirmButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
});
