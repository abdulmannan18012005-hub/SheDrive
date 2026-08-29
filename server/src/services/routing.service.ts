/**
 * Google Routes API (New) & Intelligent Routing Engine for SheDrive
 * 
 * Provides:
 * 1. Live traffic-aware duration & realistic urban ETAs via Google Routes API v2
 * 2. Vehicle-specific travel modes (TWO_WHEELER vs DRIVE)
 * 3. High-precision encoded road polylines & decoded coordinate arrays
 * 4. Resilient automatic fallback to OSRM with calibrated urban speed profiles
 */

export interface LatLngPoint {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface RouteRequestOptions {
  origin: LatLngPoint;
  destination: LatLngPoint;
  intermediates?: LatLngPoint[];
  vehicleCategory?: 'bike' | 'auto' | 'mini' | 'sedan' | 'rickshaw' | string;
}

export interface RouteResponseResult {
  distanceKm: number;
  distanceMeters: number;
  durationMinutes: number;
  durationSeconds: number;
  encodedPolyline: string;
  coordinates: Array<[number, number]>; // [latitude, longitude]
  source: 'google_routes_api' | 'osrm_fallback';
  trafficStatus: 'Light' | 'Moderate' | 'Heavy';
  trafficDelayMinutes?: number;
}

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const OSRM_PUBLIC_URL = 'https://router.project-osrm.org/route/v1/driving';

// Default Production Google API Key
const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyCsOFBXAEmYvsV7SG6-VKK4cjyH9NoS7vs';

/**
 * Decodes Google encoded polyline string into [latitude, longitude] coordinate pairs.
 */
export function decodePolyline(encoded: string): Array<[number, number]> {
  if (!encoded || typeof encoded !== 'string') return [];
  const points: Array<[number, number]> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  try {
    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push([lat / 1e5, lng / 1e5]);
    }
  } catch (err) {
    console.warn('[Polyline Decoder] Warning decoding polyline:', err);
  }

  return points;
}

/**
 * Calculates realistic urban trip duration in minutes for Lahore traffic.
 */
export function calculateUrbanTripDuration(
  category: string,
  distanceKm: number
): number {
  const cat = (category || 'mini').toLowerCase();
  let speedKmh = 20;
  let signalBuffer = 5;

  if (cat.includes('bike')) {
    speedKmh = 25;
    signalBuffer = 2;
  } else if (cat.includes('rickshaw') || cat.includes('auto')) {
    speedKmh = 20;
    signalBuffer = 3;
  } else {
    // mini, sedan, car
    speedKmh = 20;
    signalBuffer = 5;
  }

  const travelMinutes = (distanceKm / speedKmh) * 60;
  return Math.max(3, Math.round(travelMinutes + signalBuffer));
}

/**
 * Fallback OSRM Route Calculation
 */
async function computeOSRMRoute(options: RouteRequestOptions): Promise<RouteResponseResult> {
  const { origin, destination, intermediates = [], vehicleCategory = 'mini' } = options;

  let coordinateList = `${origin.longitude},${origin.latitude}`;
  for (const stop of intermediates) {
    coordinateList += `;${stop.longitude},${stop.latitude}`;
  }
  coordinateList += `;${destination.longitude},${destination.latitude}`;

  const osrmUrl = `${OSRM_PUBLIC_URL}/${coordinateList}?overview=full&geometries=geojson&alternatives=false`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(osrmUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OSRM HTTP error: ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no viable route');
    }

    const route = data.routes[0];
    const distanceMeters = route.distance || 0;
    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));
    
    // Use urban calibrated duration rather than raw OSRM highway duration
    const durationMinutes = calculateUrbanTripDuration(vehicleCategory, distanceKm);
    const durationSeconds = durationMinutes * 60;

    // Convert GeoJSON [lon, lat] coordinates to [lat, lon]
    const coords: Array<[number, number]> = (route.geometry?.coordinates || []).map(
      (c: [number, number]) => [c[1], c[0]]
    );

    return {
      distanceKm,
      distanceMeters,
      durationMinutes,
      durationSeconds,
      encodedPolyline: '',
      coordinates: coords,
      source: 'osrm_fallback',
      trafficStatus: distanceKm > 10 ? 'Heavy' : distanceKm < 3 ? 'Light' : 'Moderate',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[OSRM Fallback] Routing error, using geometric straight-line estimation:', err);

    // Ultimate fallback if both Google and OSRM are unreachable
    const dLat = destination.latitude - origin.latitude;
    const dLon = destination.longitude - origin.longitude;
    const approxDistKm = parseFloat((Math.sqrt(dLat * dLat + dLon * dLon) * 111 * 1.3).toFixed(2));
    const durationMins = calculateUrbanTripDuration(vehicleCategory, approxDistKm);

    return {
      distanceKm: approxDistKm,
      distanceMeters: Math.round(approxDistKm * 1000),
      durationMinutes: durationMins,
      durationSeconds: durationMins * 60,
      encodedPolyline: '',
      coordinates: [
        [origin.latitude, origin.longitude],
        [destination.latitude, destination.longitude],
      ],
      source: 'osrm_fallback',
      trafficStatus: 'Moderate',
    };
  }
}

/**
 * Computes a live traffic-aware route using Google Routes API (New).
 * Falls back defensively to OSRM on any network failure, quota limit, or missing key.
 */
export async function computeRoute(options: RouteRequestOptions): Promise<RouteResponseResult> {
  const { origin, destination, intermediates = [], vehicleCategory = 'mini' } = options;

  if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
    throw new Error('Valid origin and destination coordinates are required.');
  }

  const category = (vehicleCategory || 'mini').toLowerCase();
  const isTwoWheeler = category.includes('bike');

  // Build Google Routes API request payload
  const requestBody: any = {
    origin: {
      location: {
        latLng: {
          latitude: origin.latitude,
          longitude: origin.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
      },
    },
    travelMode: isTwoWheeler ? 'TWO_WHEELER' : 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    polylineEncoding: 'ENCODED_POLYLINE',
    languageCode: 'en-US',
    units: 'METRIC',
  };

  // Add intermediate stops if multi-stop route
  if (intermediates.length > 0) {
    requestBody.intermediates = intermediates.map((stop) => ({
      location: {
        latLng: {
          latitude: stop.latitude,
          longitude: stop.longitude,
        },
      },
    }));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(GOOGLE_ROUTES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description',
      },
      body: JSON.stringify(requestBody),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Google Routes API] HTTP ${response.status} warning:`, errText);
      return await computeOSRMRoute(options);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.warn('[Google Routes API] No routes found in response, falling back to OSRM.');
      return await computeOSRMRoute(options);
    }

    const bestRoute = data.routes[0];
    const distanceMeters = bestRoute.distanceMeters || 0;
    const distanceKm = parseFloat((distanceMeters / 1000).toFixed(2));

    // Google returns duration formatted as "1680s"
    const rawDurationStr = bestRoute.duration || '0s';
    const durationSeconds = parseInt(rawDurationStr.replace('s', ''), 10) || 0;
    let durationMinutes = Math.max(3, Math.round(durationSeconds / 60));

    // Ensure realistic urban buffer if Google returns unrealistic empty-road duration
    const urbanDuration = calculateUrbanTripDuration(category, distanceKm);
    if (durationMinutes < urbanDuration * 0.7) {
      durationMinutes = urbanDuration;
    }

    const encodedPolyline = bestRoute.polyline?.encodedPolyline || '';
    const decodedCoords = encodedPolyline ? decodePolyline(encodedPolyline) : [];

    // Determine traffic status
    const normalMinutes = (distanceKm / 35) * 60;
    const trafficDelayMinutes = Math.max(0, durationMinutes - Math.round(normalMinutes));
    let trafficStatus: 'Light' | 'Moderate' | 'Heavy' = 'Moderate';
    if (trafficDelayMinutes > 10) trafficStatus = 'Heavy';
    else if (trafficDelayMinutes <= 3) trafficStatus = 'Light';

    return {
      distanceKm,
      distanceMeters,
      durationMinutes,
      durationSeconds: durationMinutes * 60,
      encodedPolyline,
      coordinates: decodedCoords,
      source: 'google_routes_api',
      trafficStatus,
      trafficDelayMinutes,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[Google Routes API] Request failed or timed out, executing OSRM fallback:', err?.message || err);
    return await computeOSRMRoute(options);
  }
}
