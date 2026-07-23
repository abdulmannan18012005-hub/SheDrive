// Map configuration for Lahore, Pakistan
// All coordinates and bounds scoped to Lahore metropolitan area

export const LAHORE_CENTER = {
  latitude: 31.5204,
  longitude: 74.3587,
};

export const LAHORE_BOUNDS = {
  south: 31.3,
  west: 74.1,
  north: 31.7,
  east: 74.5,
};

export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 18;
export const MARKER_ZOOM = 15;

// CartoDB Voyager tile server URL (provides English labels)
export const OSM_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const OSM_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Nominatim API (free geocoding)
export const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
export const NOMINATIM_SEARCH_PARAMS = {
  format: 'json',
  countrycodes: 'pk',
  limit: '6',
  viewbox: '74.1,31.7,74.5,31.3',
  bounded: '1',
};

// OSRM API (free routing)
export const OSRM_BASE_URL = 'https://router.project-osrm.org';

// Search debounce time in milliseconds
export const SEARCH_DEBOUNCE_MS = 500;

// Driver location update interval in milliseconds
export const DRIVER_LOCATION_UPDATE_MS = 5000;

// Fare calculation constants (PKR)
export const FARE_CONFIG = {
  baseFare: 100,             // Base fare in PKR
  perKmRate: 25,             // PKR per kilometer
  perMinRate: 5,             // PKR per minute
  minimumFare: 150,          // Minimum fare
  maxNegotiationPercent: 30, // Maximum percentage below estimated fare allowed
  surgeFactor: 1.0,          // Surge pricing multiplier (1.0 = no surge)
};

// Lahore notable landmarks for reference
export const LAHORE_LANDMARKS = {
  airport: { latitude: 31.5216, longitude: 74.4036, label: 'Allama Iqbal International Airport' },
  badshahiMosque: { latitude: 31.5881, longitude: 74.3107, label: 'Badshahi Mosque' },
  lahoreStation: { latitude: 31.5580, longitude: 74.3210, label: 'Lahore Railway Station' },
  mallRoad: { latitude: 31.5569, longitude: 74.3370, label: 'Mall Road' },
  gulberg: { latitude: 31.5180, longitude: 74.3467, label: 'Gulberg' },
  dhaPhase5: { latitude: 31.4697, longitude: 74.3930, label: 'DHA Phase 5' },
  modelTown: { latitude: 31.4834, longitude: 74.3254, label: 'Model Town' },
  joharTown: { latitude: 31.4697, longitude: 74.2908, label: 'Johar Town' },
};
