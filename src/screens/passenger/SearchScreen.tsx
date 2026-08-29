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
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { PassengerStackParamList, LocationPoint, RideStop } from '../../types';
import Colors from '../../constants/Colors';
import { getPlaceAutocomplete, getPlaceDetailsById, GooglePlacePrediction } from '../../services/googlePlaces';
import { searchAddress, reverseGeocode } from '../../services/nominatim';
import { useDebounce } from '../../hooks/useDebounce';
import { useLocation } from '../../hooks/useLocation';
import { getRoute, getMultiStopRoute } from '../../services/osrm';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { useApp } from '../../contexts/AppContext';
import { getApiBaseUrl } from '../../config/apiConfig';

type SearchScreenNavigationProp = StackNavigationProp<PassengerStackParamList, 'Search'>;
type SearchScreenRouteProp = RouteProp<PassengerStackParamList, 'Search'>;

interface Props {
  navigation: SearchScreenNavigationProp;
  route: SearchScreenRouteProp;
}

// Unified Search Result item supporting Google Places and Fallbacks
interface SearchItem {
  id: string;
  placeId?: string;
  title: string;
  subtitle: string;
  fullAddress: string;
  latitude?: number;
  longitude?: number;
  source: 'google' | 'nominatim' | 'saved';
}

export default function SearchScreen({ navigation, route }: Props): React.JSX.Element {
  const { location: gpsCoords } = useLocation();
  const { state } = useApp();

  const initialPickup = route?.params?.pickupPoint;
  const initialField = route?.params?.targetField || 'dest';

  const [pickupText, setPickupText] = useState(initialPickup?.label || '');
  const [destText, setDestText] = useState('');
  const [activeField, setActiveField] = useState<'pickup' | 'dest'>(initialField);

  const [pickupPoint, setPickupPoint] = useState<LocationPoint | null>(initialPickup || null);
  const [destPoint, setDestPoint] = useState<LocationPoint | null>(null);

  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<any[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);

  // Intermediate stops state (Phase 10: Multi-stop rides, max 3 intermediate stops)
  const [intermediateStops, setIntermediateStops] = useState<LocationPoint[]>([]);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);

  // Debounced inputs for geocoder query (300ms fast response)
  const debouncedPickup = useDebounce(pickupText, 300);
  const debouncedDest = useDebounce(destText, 300);

  // Fetch saved places from backend
  useEffect(() => {
    const fetchSavedPlaces = async () => {
      try {
        setIsLoadingPlaces(true);
        const res = await fetch(`${getApiBaseUrl()}/user/saved-places`, {
          headers: {
            Authorization: `Bearer ${state.token}`,
          },
        });

        const data = await res.json();
        if (res.ok && Array.isArray(data.places)) {
          setSavedPlaces(data.places);
          // If quick targetLabel passed (e.g. 'home' or 'work'), auto-select matching place
          const target = route?.params?.targetLabel;
          if (target) {
            const matched = data.places.find((p: any) => p?.label === target);
            if (matched) {
              const matchedLat = parseFloat(matched.latitude) || 0;
              const matchedLon = parseFloat(matched.longitude) || 0;
              setDestPoint({
                latitude: matchedLat,
                longitude: matchedLon,
                label: matched.name || (target === 'home' ? 'Home' : 'Work'),
              });
              setDestText(matched.name || (target === 'home' ? 'Home' : 'Work'));
            }
          }
        } else {
          setSavedPlaces([]);
        }
      } catch (err) {
        console.error('Fetch saved places error:', err);
        setSavedPlaces([]);
      } finally {
        setIsLoadingPlaces(false);
      }
    };

    fetchSavedPlaces();
  }, [state.token, route?.params?.targetLabel]);

  // Auto-reverse geocode current position for Pickup if not provided
  useEffect(() => {
    const initPickup = async () => {
      if (!pickupPoint && gpsCoords) {
        setPickupText('Current Location');
        const readableAddress = await reverseGeocode(gpsCoords.latitude, gpsCoords.longitude);
        const labelName = readableAddress || 'Current Location';
        setPickupPoint({
          latitude: gpsCoords.latitude,
          longitude: gpsCoords.longitude,
          label: labelName,
        });
        setPickupText(labelName);
      }
    };
    initPickup();
  }, [gpsCoords, pickupPoint]);

  // Execute address search query when debounced text updates using Google Places (New)
  useEffect(() => {
    const runSearch = async () => {
      const activeQuery = activeField === 'pickup' ? debouncedPickup : debouncedDest;
      if (!activeQuery || activeQuery.trim().length < 2 || activeQuery === 'My Location') {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);

        // 1. Query Google Places API (New) Autocomplete
        const googlePredictions = await getPlaceAutocomplete(activeQuery, gpsCoords);

        if (googlePredictions && googlePredictions.length > 0) {
          const items: SearchItem[] = googlePredictions.map((pred) => ({
            id: pred.placeId,
            placeId: pred.placeId,
            title: pred.title,
            subtitle: pred.subtitle,
            fullAddress: pred.fullText,
            source: 'google',
          }));
          setSearchResults(items);
        } else {
          // 2. Graceful Fallback to Nominatim if Google Places returns empty or quota issue
          const nominatimPlaces = await searchAddress(activeQuery);
          const items: SearchItem[] = nominatimPlaces.map((np) => ({
            id: `nom_${np.place_id}`,
            title: np.display_name.split(',')[0],
            subtitle: np.display_name,
            fullAddress: np.display_name,
            latitude: parseFloat(np.lat),
            longitude: parseFloat(np.lon),
            source: 'nominatim',
          }));
          setSearchResults(items);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    };

    runSearch();
  }, [debouncedPickup, debouncedDest, activeField, gpsCoords]);

  const handleSelectItem = async (item: SearchItem) => {
    let lat = item.latitude;
    let lon = item.longitude;
    let label = item.title;

    // If result came from Google Places autocomplete, resolve exact coordinates via Place Details
    if (item.placeId && (lat === undefined || lon === undefined)) {
      try {
        setIsSearching(true);
        const details = await getPlaceDetailsById(item.placeId);
        if (details) {
          lat = details.coordinates.latitude;
          lon = details.coordinates.longitude;
          label = details.name || item.title;
        }
      } catch (err) {
        console.error('Error resolving place details:', err);
      } finally {
        setIsSearching(false);
      }
    }

    if (lat === undefined || lon === undefined) {
      Alert.alert('Location Error', 'Unable to resolve coordinates for this place. Please try another location.');
      return;
    }

    const selectedPoint: LocationPoint = {
      latitude: lat,
      longitude: lon,
      label: label,
    };

    if (activeField === 'pickup') {
      setPickupPoint(selectedPoint);
      setPickupText(label);
      setSearchResults([]);
      setActiveField('dest');
    } else {
      setDestPoint(selectedPoint);
      setDestText(label);
      setSearchResults([]);

      // Auto-navigate to booking screen if pickup exists
      const pPoint =
        pickupPoint ||
        (gpsCoords
          ? { latitude: gpsCoords.latitude, longitude: gpsCoords.longitude, label: 'Current Location' }
          : null);

      if (pPoint) {
        try {
          setIsCalculatingRoute(true);
          const osrmRoute = await getRoute(pPoint.latitude, pPoint.longitude, lat, lon);
          if (osrmRoute) {
            navigation.navigate('FareBid', {
              pickup: pPoint,
              destination: selectedPoint,
              route: osrmRoute,
            });
          } else {
            Alert.alert('Routing Failed', 'Could not calculate road route between these points. Please check locations.');
          }
        } catch (e) {
          console.warn('Auto route calculation error:', e);
        } finally {
          setIsCalculatingRoute(false);
        }
      }
    }
  };

  const handleConfirmRoute = async () => {
    if (!pickupPoint || !destPoint) {
      Alert.alert('Validation Error', 'Please select both pickup and destination locations.');
      return;
    }

    try {
      setIsCalculatingRoute(true);

      let osrmRoute;

      if (intermediateStops.length > 0) {
        // Build ordered waypoints: pickup -> stops -> destination
        const waypoints = [
          pickupPoint,
          ...intermediateStops,
          destPoint,
        ];
        osrmRoute = await getMultiStopRoute(waypoints);
      } else {
        // Standard point-to-point routing
        osrmRoute = await getRoute(
          pickupPoint.latitude,
          pickupPoint.longitude,
          destPoint.latitude,
          destPoint.longitude
        );
      }

      if (!osrmRoute) {
        throw new Error('Could not calculate a viable driving route.');
      }

      // Build stops for navigation
      const rideStops: RideStop[] = intermediateStops.map((s, i) => ({
        latitude: s.latitude,
        longitude: s.longitude,
        label: s.label,
        stopOrder: i + 1,
      }));

      // Navigate to Bidding screen (FareBid)
      navigation.navigate('FareBid', {
        pickup: pickupPoint,
        destination: destPoint,
        route: osrmRoute,
        stops: rideStops.length > 0 ? rideStops : undefined,
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
          <View style={styles.routeGraphicContainer}>
            <View style={styles.greenDot} />
            <View style={styles.connectingLine} />
            <View style={styles.pinkDot} />
          </View>

          <View style={styles.inputsColumn}>
            <View style={styles.fieldRow}>
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
              {pickupText.length > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setPickupText('');
                    setPickupPoint(null);
                  }}
                >
                  <Text style={styles.clearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.fieldRow}>
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
              {destText.length > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    setDestText('');
                    setDestPoint(null);
                  }}
                >
                  <Text style={styles.clearBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
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
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => handleSelectItem(item)}
                >
                  <View style={[styles.resultIconBadge, item.source === 'google' && { backgroundColor: Colors.light.primaryGhost }]}>
                    <Text style={styles.resultIcon}>{item.source === 'google' ? '📍' : '📌'}</Text>
                  </View>
                  <View style={styles.resultTextContainer}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.resultSubtitle} numberOfLines={2}>
                      {item.subtitle || item.fullAddress}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <ScrollView style={{ flex: 1, padding: 20 }}>
              {/* Saved Places Section */}
              <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.light.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>Saved Places</Text>
              {isLoadingPlaces ? (
                <View style={{ padding: 20 }}>
                  <ActivityIndicator color={Colors.light.primary} />
                </View>
              ) : savedPlaces.length === 0 ? (
                <View style={{ backgroundColor: Colors.light.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: Colors.light.border, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.light.text, marginBottom: 4 }}>No Saved Places</Text>
                  <Text style={{ fontSize: 13, color: Colors.light.textSecondary, textAlign: 'center' }}>Save your favorite locations for quick access</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: Colors.light.surface, borderRadius: 16, padding: 12, marginBottom: 24, gap: 8, borderWidth: 1, borderColor: Colors.light.border }}>
                  {savedPlaces.map((place, idx) => {
                    const icon = place?.label === 'home' ? '🏠' : place?.label === 'work' ? '💼' : '📍';
                    const numLat = parseFloat(place?.latitude) || 0;
                    const numLon = parseFloat(place?.longitude) || 0;
                    const placeName = place?.name || (place?.label === 'home' ? 'Home' : place?.label === 'work' ? 'Work' : 'Saved Place');
                    const placePoint: LocationPoint = { 
                      latitude: numLat, 
                      longitude: numLon, 
                      label: placeName 
                    };
                    return (
                      <TouchableOpacity
                        key={place?.id || `saved_${idx}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}
                        onPress={() => {
                          if (activeField === 'pickup') { 
                            setPickupPoint(placePoint); 
                            setPickupText(placeName); 
                            setActiveField('dest'); 
                          } else { 
                            setDestPoint(placePoint); 
                            setDestText(placeName); 
                          }
                        }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primaryGhost, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 18 }}>{icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.light.text }}>{placeName}</Text>
                          <Text style={{ fontSize: 13, color: Colors.light.textSecondary }} numberOfLines={1}>
                            {numLat.toFixed(4)}, {numLon.toFixed(4)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  routeGraphicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    height: 90,
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.success,
  },
  connectingLine: {
    width: 2,
    height: 38,
    backgroundColor: Colors.light.border,
    marginVertical: 4,
  },
  pinkDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.light.primary,
  },
  inputsColumn: {
    flex: 1,
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.light.background,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '500',
  },
  textInputFocused: {
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.surface,
  },
  clearBtn: {
    position: 'absolute',
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '700',
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    gap: 14,
  },
  resultIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultIcon: {
    fontSize: 18,
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
