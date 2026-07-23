// Type definitions for the SheDrive ride-hailing application

// ─── User Roles ────────────────────────────────────────────
export type UserRole = 'passenger' | 'driver';

// ─── Coordinates ───────────────────────────────────────────
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationPoint extends Coordinates {
  label: string;
}

// ─── User Profile ──────────────────────────────────────────
export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  createdAt: number;
  photoURL?: string;
}

// ─── Vehicle Categories ────────────────────────────────────
export type VehicleCategoryId = 'bike' | 'mini' | 'sedan' | 'comfort' | 'premium' | 'family';

export interface VehicleCategory {
  id: VehicleCategoryId;
  name: string;
  icon: string;
  capacity: number;
  description: string;
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  waitingChargePerMin: number;
  minimumFare: number;
  estimatedEtaMins: number;
}

// ─── Vehicle Info ──────────────────────────────────────────
export interface VehicleInfo {
  category?: VehicleCategoryId;
  make: string;
  model: string;
  year?: string;
  plate: string;
  color: string;
  photoUrl?: string;
}

// ─── Driver Profile ────────────────────────────────────────
export interface DriverProfile extends UserProfile {
  vehicleInfo: VehicleInfo;
  isOnline: boolean;
  isAvailable: boolean;
  isActive: boolean;
  rating: number;
  totalRides: number;
  latitude?: number;
  longitude?: number;
  heading?: number;
}

// ─── Driver Location ───────────────────────────────────────
export interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  heading: number;
  updatedAt: number;
}

// ─── Fare Offer ────────────────────────────────────────────
export interface FareOffer {
  senderId: string;
  role: UserRole;
  amount: number;
  timestamp: number;
}

// ─── Ride Status ───────────────────────────────────────────
export type RideStatus =
  | 'pending'
  | 'negotiating'
  | 'accepted'
  | 'arrived'
  | 'enroute'
  | 'completed'
  | 'cancelled';

// ─── Ride Request ──────────────────────────────────────────
export interface RideRequest {
  rideId: string;
  vehicleCategory?: VehicleCategoryId;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  distanceKm: number;
  durationMin: number;
  initialBid: number;
  currentFare: number;
  status: RideStatus;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
  driverVehicle: string | null;
  driverCoords: Coordinates | null;
  offers: FareOffer[];
  polyline: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Earning Record ────────────────────────────────────────
export interface EarningRecord {
  id: string;
  driverId: string;
  rideId: string;
  amount: number;
  date: number;
}

// ─── Notification ──────────────────────────────────────────
export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'ride_update' | 'promo' | 'system' | 'emergency';
  read: boolean;
  createdAt: number;
}

// ─── Rating ────────────────────────────────────────────────
export interface Rating {
  id: string;
  rideId: string;
  fromUserId: string;
  toUserId: string;
  rating: number;
  comment: string;
  createdAt: number;
}

// ─── Saved Place ───────────────────────────────────────────
export interface SavedPlace {
  id: string;
  userId: string;
  label: string;
  name: string;
  latitude: number;
  longitude: number;
}

// ─── Emergency Contact ─────────────────────────────────────
export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
}

// ─── WebView Map Commands ──────────────────────────────────
export type MapCommand =
  | { type: 'centerMap'; payload: { latitude: number; longitude: number; zoom?: number } }
  | { type: 'setPickup'; payload: LocationPoint }
  | { type: 'setDropoff'; payload: LocationPoint }
  | { type: 'drawRoute'; payload: { coordinates: Array<[number, number]> } }
  | { type: 'updateDriverMarkers'; payload: { drivers: DriverLocation[] } }
  | { type: 'clearRoute' }
  | { type: 'clearMarkers' };

// ─── Nominatim Search Result ───────────────────────────────
export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  importance: number;
}

// ─── OSRM Route Response ──────────────────────────────────
export interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: {
    type: string;
    coordinates: Array<[number, number]>;
  };
}

// ─── App State ─────────────────────────────────────────────
export interface AppState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  role: UserRole;
  isLoading: boolean;
}

// ─── Navigation Params ─────────────────────────────────────
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type PassengerStackParamList = {
  PassengerHome: undefined;
  Search: undefined;
  FareBid: { pickup: LocationPoint; destination: LocationPoint; route: OSRMRoute };
  RideTracking: { rideId: string };
  RideHistory: undefined;
  Profile: undefined;
  EditProfile: undefined;
  SavedPlaces: undefined;
  Settings: undefined;
};

export type DriverStackParamList = {
  DriverHome: undefined;
  RideOffers: undefined;
  ActiveRide: { rideId: string };
  Earnings: undefined;
  DriverProfile: undefined;
  DriverRideHistory: undefined;
  DriverSettings: undefined;
};
