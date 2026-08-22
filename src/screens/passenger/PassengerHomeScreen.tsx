import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIsFocused } from '@react-navigation/native';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebaseConfig';
import { PassengerStackParamList, DriverProfile, EmergencyContact } from '../../types';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { LeafletMap, LeafletMapRef, MapMarker } from '../../components/LeafletMap';
import { useLocation } from '../../hooks/useLocation';
import { SideDrawer } from '../../components/SideDrawer';
import SOSPanicButton from '../../components/SOSPanicButton';
import { haversineDistance } from '../../utils/helpers';
import { getApiBaseUrl } from '../../config/apiConfig';

type PassengerHomeNavigationProp = StackNavigationProp<PassengerStackParamList, 'PassengerHome'>;

interface Props {
  navigation: PassengerHomeNavigationProp;
}

export default function PassengerHomeScreen({ navigation }: Props): React.JSX.Element {
  const { state, dispatch } = useApp();
  const user = state.user;
  const isFocused = useIsFocused();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      if (!state.token) return;
      try {
        const res = await fetch(`${getApiBaseUrl()}/user/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${state.token}` },
        });
        const data = await res.json();
        if (res.ok) setUnreadCount(data.count || 0);
      } catch (err) {
        // Non-critical: badge simply stays at previous value
      }
    };
    if (isFocused) fetchUnread();
  }, [isFocused, state.token]);

  const { location: currentCoords, errorMessage, isLoading: isLocationLoading } = useLocation();
  const [onlineDrivers, setOnlineDrivers] = useState<DriverProfile[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  
  const mapRef = useRef<LeafletMapRef>(null);
  const hasCenteredRef = useRef(false);

  // Auto-center map once real GPS location is acquired
  useEffect(() => {
    if (currentCoords && mapRef.current && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
      mapRef.current.setCenter(currentCoords.latitude, currentCoords.longitude, 15);
    }
  }, [currentCoords]);

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

  // Fetch emergency contacts
  useEffect(() => {
    const fetchEmergencyContacts = async () => {
      if (!user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.emergencyContacts) {
            setEmergencyContacts(userData.emergencyContacts);
          }
        }
      } catch (error) {
        console.error('Error fetching emergency contacts:', error);
      }
    };

    fetchEmergencyContacts();
  }, [user?.uid]);

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
        isCustomer: true,
      });
    }

    // Add online driver markers within 5 KM radius
    onlineDrivers.forEach((driver) => {
      if (driver.latitude && driver.longitude && currentCoords && driver.isOnline && driver.isAvailable !== false) {
        const distanceKm = haversineDistance(
          currentCoords.latitude,
          currentCoords.longitude,
          driver.latitude,
          driver.longitude
        );

        if (distanceKm <= 5) {
          markersList.push({
            id: driver.uid,
            lat: driver.latitude,
            lng: driver.longitude,
            emoji: '🚗',
            title: `${driver.name} (${driver.vehicleInfo.make} ${driver.vehicleInfo.model}) - ${distanceKm.toFixed(1)} km`,
          });
        }
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
      {/* Header Bar with Hamburger Menu & Profile Picture */}
      <View style={styles.topPanel}>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => setDrawerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingSubtext}>WHERE ARE YOU GOING?</Text>
          <Text style={styles.welcomeText}>Hi, {user?.name ? user.name.split(' ')[0] : 'Passenger'} 👋</Text>
        </View>
        <View style={{ position: 'relative', marginRight: 8 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('NotificationCenter')}
            activeOpacity={0.8}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primaryGhost, justifyContent: 'center', alignItems: 'center' }}
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
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.8}
          style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderBottomWidth: 1, borderColor: '#E4E6EF' }}
        >
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.primaryGhost, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 18 }}>👩</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      {/* Embedded Leaflet Map */}
      <View style={styles.mapContainer}>
        <LeafletMap
          ref={mapRef}
          center={defaultCenter}
          markers={getMapMarkers()}
        />

        {/* Current Location Button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={() => {
            if (currentCoords && mapRef.current) {
              mapRef.current.setCenter(currentCoords.latitude, currentCoords.longitude, 16);
            }
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.currentLocationIcon}>📍</Text>
        </TouchableOpacity>

        {/* Live Drivers Badge */}
        <View style={styles.onlineBadgeChip}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineBadgeText}>
            {onlineDrivers.length} female {onlineDrivers.length === 1 ? 'driver' : 'drivers'} online
          </Text>
        </View>
      </View>

      {/* Floating Luxury Search Card */}
      <View style={styles.searchCard}>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.9}
        >
          <View style={styles.searchIconBadge}>
            <Text style={styles.searchIcon}>🔍</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.searchTitle}>Where to in Lahore?</Text>
            <Text style={styles.searchSubTitle}>Set pickup & destination</Text>
          </View>
          <View style={styles.goArrowBadge}>
            <Text style={styles.goArrowText}>➔</Text>
          </View>
        </TouchableOpacity>

        {/* Quick Location Pills */}
        <View style={styles.quickPillsRow}>
          <TouchableOpacity
            style={styles.quickPill}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickPillIcon}>🏠</Text>
            <Text style={styles.quickPillText}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickPill}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickPillIcon}>💼</Text>
            <Text style={styles.quickPillText}>Work</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickPill}
            onPress={() => navigation.navigate('RideHistory')}
            activeOpacity={0.8}
          >
            <Text style={styles.quickPillIcon}>🕒</Text>
            <Text style={styles.quickPillText}>Recent Trips</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Side Drawer */}
      <SideDrawer
        visible={drawerVisible}
        user={user}
        role="passenger"
        onClose={() => setDrawerVisible(false)}
        navigation={navigation}
        dispatch={dispatch}
      />

      {/* SOS Panic Button */}
      {currentCoords && (
        <SOSPanicButton
          contacts={emergencyContacts}
          location={{
            latitude: currentCoords.latitude,
            longitude: currentCoords.longitude,
          }}
          onSOSTriggered={() => {
            console.log('SOS triggered');
          }}
          size="large"
          position="bottom-right"
        />
      )}
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
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '600',
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
    fontWeight: '600',
    color: Colors.light.primary,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  greetingSubtext: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: 1.2,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '800',
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
    position: 'relative',
  },
  onlineBadgeChip: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.success,
    marginRight: 8,
  },
  onlineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 180,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  currentLocationIcon: {
    fontSize: 24,
  },
  searchCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderWidth: 1.5,
    borderColor: Colors.light.primary + '30',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchIcon: {
    fontSize: 18,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
  },
  searchSubTitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  goArrowBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goArrowText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  quickPillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryGhost,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  quickPillIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
  },
});
