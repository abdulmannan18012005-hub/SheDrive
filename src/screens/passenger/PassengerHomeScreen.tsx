import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { PassengerStackParamList, DriverProfile } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { LeafletMap, LeafletMapRef, MapMarker } from '../../components/LeafletMap';
import { useLocation } from '../../hooks/useLocation';

type PassengerHomeNavigationProp = StackNavigationProp<PassengerStackParamList, 'PassengerHome'>;

interface Props {
  navigation: PassengerHomeNavigationProp;
}

export default function PassengerHomeScreen({ navigation }: Props): React.JSX.Element {
  const { state } = useApp();
  const user = state.user;

  const { location: currentCoords, errorMessage, isLoading: isLocationLoading } = useLocation();
  const [onlineDrivers, setOnlineDrivers] = useState<DriverProfile[]>([]);
  
  const mapRef = useRef<LeafletMapRef>(null);

  // Subscribe to real-time online drivers from Firestore
  useEffect(() => {
    const driversRef = collection(db, 'drivers');
    const q = query(driversRef, where('isOnline', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeDrivers: DriverProfile[] = [];
      snapshot.forEach((docSnap) => {
        activeDrivers.push(docSnap.data() as DriverProfile);
      });
      setOnlineDrivers(activeDrivers);
    }, (error) => {
      console.error('Error fetching online drivers:', error);
    });

    return () => unsubscribe();
  }, []);

  // Assemble map markers: passenger + online drivers
  const getMapMarkers = (): MapMarker[] => {
    const markersList: MapMarker[] = [];

    // Add passenger current marker
    if (currentCoords) {
      markersList.push({
        id: 'passenger_current',
        lat: currentCoords.latitude,
        lng: currentCoords.longitude,
        emoji: '👩',
        title: 'My Location',
      });
    }

    // Add online driver markers
    onlineDrivers.forEach((driver) => {
      if (driver.latitude && driver.longitude) {
        markersList.push({
          id: driver.uid,
          lat: driver.latitude,
          lng: driver.longitude,
          emoji: '🚗',
          title: `${driver.name} (${driver.vehicleInfo.make} ${driver.vehicleInfo.model})`,
        });
      }
    });

    return markersList;
  };

  if (isLocationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
        <Text style={styles.loadingText}>Loading Lahore Map GPS...</Text>
      </View>
    );
  }

  const defaultCenter = currentCoords
    ? { lat: currentCoords.latitude, lng: currentCoords.longitude }
    : { lat: 31.5204, lng: 74.3587 }; // default Lahore Center

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <View style={styles.topPanel}>
        <Text style={styles.welcomeText}>Hi, {user?.name ? user.name.split(' ')[0] : 'Passenger'}</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.profileButtonText}>👤 Profile</Text>
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

      {/* Search Input Box */}
      <View style={styles.searchCard}>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.9}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.placeholderText}>Where to in Lahore?</Text>
        </TouchableOpacity>
        <Text style={styles.activeDriversText}>
          {onlineDrivers.length} {onlineDrivers.length === 1 ? 'driver' : 'drivers'} online nearby
        </Text>
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  profileButton: {
    backgroundColor: Colors.light.primaryGhost,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  profileButtonText: {
    color: Colors.light.primary,
    fontSize: 14,
    fontWeight: '600',
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
  searchCard: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  activeDriversText: {
    fontSize: 13,
    color: Colors.light.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
