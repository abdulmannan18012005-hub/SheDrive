import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, Platform, Image, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region, LatLng } from 'react-native-maps';
import Colors from '../constants/Colors';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  emoji?: string;
  title?: string;
  description?: string;
  isCustomer?: boolean;
  isDestination?: boolean;
  isDriver?: boolean;
  categoryIcon?: string;
  heading?: number;
}

export interface GoogleMapViewRef {
  setCenter: (lat: number, lng: number, zoom?: number) => void;
  drawRoute: (coordinates: Array<[number, number] | { latitude: number; longitude: number }>) => void;
  clearRoute: () => void;
  fitToCoordinates: (coordinates: Array<LatLng>, animated?: boolean) => void;
  animateToRegion: (region: Region, duration?: number) => void;
}

export interface GoogleMapViewProps {
  center: { lat: number; lng: number } | { latitude: number; longitude: number };
  zoom?: number;
  markers?: MapMarker[];
  routeCoordinates?: Array<[number, number] | { latitude: number; longitude: number }> | null;
  onMapReady?: () => void;
  onMapClicked?: (coords: { lat: number; lng: number }) => void;
  onMapDragged?: (coords: { lat: number; lng: number }) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  followsUserLocation?: boolean;
  style?: any;
}

// Convert zoom level to latitudeDelta/longitudeDelta
function zoomToDeltas(zoom: number = 14) {
  const latitudeDelta = 360 / Math.pow(2, zoom);
  const longitudeDelta = latitudeDelta * 0.75;
  return { latitudeDelta, longitudeDelta };
}

// Clean custom map styling for modern ride-hailing app (inDrive/Uber style)
const GOOGLE_MAP_STYLE = [
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [{ color: '#cde4f7' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#ffe2ee' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#ffb3d1' }],
  },
];

export const GoogleMapView = forwardRef<GoogleMapViewRef, GoogleMapViewProps>(
  (
    {
      center,
      zoom = 14,
      markers = [],
      routeCoordinates = null,
      onMapReady,
      onMapClicked,
      onMapDragged,
      showsUserLocation = false,
      showsMyLocationButton = false,
      followsUserLocation = false,
      style,
    },
    ref
  ) => {
    const mapRef = useRef<MapView>(null);
    const [isReady, setIsReady] = useState(false);

    const rawLat = center ? ('latitude' in center ? (center as any).latitude : (center as any).lat) : 31.5204;
    const rawLng = center ? ('longitude' in center ? (center as any).longitude : (center as any).lng) : 74.3587;
    const centerLat = typeof rawLat === 'number' && !isNaN(rawLat) ? rawLat : 31.5204;
    const centerLng = typeof rawLng === 'number' && !isNaN(rawLng) ? rawLng : 74.3587;

    const initialRegion: Region = useMemo(() => {
      const { latitudeDelta, longitudeDelta } = zoomToDeltas(zoom);
      return {
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta,
        longitudeDelta,
      };
    }, [centerLat, centerLng, zoom]);

    // Format route coordinates for Polyline component
    const parsedRouteCoordinates: LatLng[] = useMemo(() => {
      if (!routeCoordinates || routeCoordinates.length === 0) return [];
      return routeCoordinates.map((coord) => {
        if (Array.isArray(coord)) {
          return { latitude: coord[0], longitude: coord[1] };
        }
        return coord;
      });
    }, [routeCoordinates]);

    // Expose ref methods to parent screens
    useImperativeHandle(ref, () => ({
      setCenter: (lat: number, lng: number, targetZoom?: number) => {
        if (!mapRef.current) return;
        const deltas = zoomToDeltas(targetZoom || zoom);
        mapRef.current.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            ...deltas,
          },
          600
        );
      },
      drawRoute: (coords) => {
        if (!mapRef.current || !coords || coords.length === 0) return;
        const formatted = coords.map((c) => (Array.isArray(c) ? { latitude: c[0], longitude: c[1] } : c));
        mapRef.current.fitToCoordinates(formatted, {
          edgePadding: { top: 70, right: 60, bottom: 120, left: 60 },
          animated: true,
        });
      },
      clearRoute: () => {
        // Clear is handled reactively by routeCoordinates prop
      },
      fitToCoordinates: (coords: LatLng[], animated = true) => {
        if (!mapRef.current || !coords || coords.length === 0) return;
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 50, bottom: 100, left: 50 },
          animated,
        });
      },
      animateToRegion: (region: Region, duration = 600) => {
        if (mapRef.current) {
          mapRef.current.animateToRegion(region, duration);
        }
      },
    }));

    // Auto-fit route when routeCoordinates changes
    useEffect(() => {
      if (isReady && parsedRouteCoordinates.length > 0 && mapRef.current) {
        mapRef.current.fitToCoordinates(parsedRouteCoordinates, {
          edgePadding: { top: 80, right: 60, bottom: 130, left: 60 },
          animated: true,
        });
      }
    }, [isReady, parsedRouteCoordinates]);



    return (
      <View style={[styles.container, style]}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={initialRegion}
          customMapStyle={GOOGLE_MAP_STYLE}
          mapPadding={{ top: Platform.OS === 'ios' ? 85 : 90, right: 16, bottom: 20, left: 16 }}
          showsUserLocation={showsUserLocation}
          showsMyLocationButton={showsMyLocationButton}
          followsUserLocation={followsUserLocation}
          showsCompass={true}
          showsScale={false}
          showsTraffic={false}
          loadingEnabled={true}
          loadingIndicatorColor={Colors.light.primary}
          loadingBackgroundColor="#F8F9FA"
          onMapReady={() => {
            setIsReady(true);
            if (onMapReady) onMapReady();
          }}
          onPress={(e) => {
            if (onMapClicked) {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              onMapClicked({ lat: latitude, lng: longitude });
            }
          }}
          onRegionChangeComplete={(region) => {
            if (onMapDragged) {
              onMapDragged({ lat: region.latitude, lng: region.longitude });
            }
          }}
        >
          {/* Active Route Polyline */}
          {parsedRouteCoordinates.length > 0 && (
            <Polyline
              coordinates={parsedRouteCoordinates}
              strokeColor={Colors.light.primary} // SheDrive Brand Teal
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Map Markers */}
          {markers.map((marker) => {
            if (typeof marker.lat !== 'number' || typeof marker.lng !== 'number') return null;

            return (
              <Marker
                key={marker.id}
                coordinate={{ latitude: marker.lat, longitude: marker.lng }}
                title={marker.title}
                description={marker.description}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <MarkerVisual marker={marker} />
              </Marker>
            );
          })}
        </MapView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  pickupMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupMarkerPin: {
    backgroundColor: Colors.light.primary,
    padding: 6,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  markerPulseCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.primary,
    marginTop: 2,
  },
  destMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  destMarkerPin: {
    backgroundColor: '#1E293B',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  destMarkerShadow: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1E293B',
    marginTop: 2,
  },
  driverMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverVehicleBadge: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E91E63',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  driverEmoji: {
    fontSize: 22,
  },
  defaultMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerEmoji: {
    fontSize: 16,
  },
});

// Memoized Marker Visual to prevent re-rendering during map panning
const MarkerVisual = React.memo(({ marker }: { marker: MapMarker }) => {
  const isPickup = marker.id === 'pickup' || marker.id === 'passenger_current' || marker.isCustomer;
  const isDest = marker.id === 'dropoff' || marker.id === 'destination' || marker.isDestination;
  const isDriver = marker.id === 'driver' || marker.isDriver;

  if (isPickup) {
    return (
      <View style={styles.pickupMarkerContainer}>
        <View style={styles.pickupMarkerPin}>
          <Text style={styles.markerEmoji}>{marker.emoji || '📍'}</Text>
        </View>
        <View style={styles.markerPulseCircle} />
      </View>
    );
  }

  if (isDest) {
    return (
      <View style={styles.destMarkerContainer}>
        <View style={styles.destMarkerPin}>
          <Text style={styles.markerEmoji}>{marker.emoji || '🏁'}</Text>
        </View>
        <View style={styles.destMarkerShadow} />
      </View>
    );
  }

  if (isDriver) {
    return (
      <View style={styles.driverMarkerContainer}>
        <View style={styles.driverVehicleBadge}>
          <Text style={styles.driverEmoji}>{marker.categoryIcon || marker.emoji || '🚗'}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.defaultMarkerContainer}>
      <Text style={{ fontSize: 24 }}>{marker.emoji || '📍'}</Text>
    </View>
  );
});

MarkerVisual.displayName = 'MarkerVisual';

GoogleMapView.displayName = 'GoogleMapView';

export default GoogleMapView;
