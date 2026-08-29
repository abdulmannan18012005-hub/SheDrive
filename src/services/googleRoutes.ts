import { OSRMRoute, Coordinates, LocationPoint } from '../types';
import { getRoute as getOSRMRoute, getMultiStopRoute as getOSRMRouteMulti } from './osrm';

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyCsOFBXAEmYvsV7SG6-VKK4cjyH9NoS7vs';

const ANDROID_PACKAGE_NAME = 'com.lahore.pinkrides';
const ANDROID_SHA1_CERT = '5E8F16062EA3CD2C4A0D547876BAA6F38CABF625';

/**
 * Decodes Google encoded polyline string into [longitude, latitude] GeoJSON coordinate pairs.
 */
export function decodePolylineGeoJson(encoded: string): Array<[number, number]> {
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

      // GeoJSON standard expects [longitude, latitude]
      points.push([lng / 1e5, lat / 1e5]);
    }
  } catch (err) {
    console.warn('[Polyline Decoder] Warning:', err);
  }

  return points;
}

/**
 * Common security headers required for Google Cloud API authentication
 */
function getSecurityHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
    'X-Android-Package': ANDROID_PACKAGE_NAME,
    'X-Android-Cert': ANDROID_SHA1_CERT,
    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
  };
}

/**
 * Computes a driving route using Google Routes API (New) with live traffic.
 * Transparently falls back to OSRM on any failure.
 */
export async function getLiveTrafficRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  vehicleCategory: string = 'mini'
): Promise<OSRMRoute | null> {
  const isBike = (vehicleCategory || '').toLowerCase().includes('bike');

  const requestBody: any = {
    origin: {
      location: {
        latLng: {
          latitude: startLat,
          longitude: startLon,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: endLat,
          longitude: endLon,
        },
      },
    },
    travelMode: isBike ? 'TWO_WHEELER' : 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    polylineEncoding: 'ENCODED_POLYLINE',
    languageCode: 'en-US',
    units: 'METRIC',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(GOOGLE_ROUTES_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: getSecurityHeaders(),
      body: JSON.stringify(requestBody),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Google Routes API] Status ${response.status}, falling back to OSRM.`);
      return await getOSRMRoute(startLat, startLon, endLat, endLon);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return await getOSRMRoute(startLat, startLon, endLat, endLon);
    }

    const route = data.routes[0];
    const distanceMeters = route.distanceMeters || 0;
    const rawDurationStr = route.duration || '0s';
    const durationSeconds = parseInt(rawDurationStr.replace('s', ''), 10) || 0;

    const encodedPolyline = route.polyline?.encodedPolyline || '';
    const coordinates = encodedPolyline
      ? decodePolylineGeoJson(encodedPolyline)
      : [[startLon, startLat], [endLon, endLat]];

    return {
      distance: distanceMeters,
      duration: durationSeconds,
      geometry: {
        type: 'LineString',
        coordinates,
      },
      encodedPolyline,
      source: 'google_routes_api',
    } as OSRMRoute;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('[Google Routes API] Fallback to OSRM:', error);
    return await getOSRMRoute(startLat, startLon, endLat, endLon);
  }
}

/**
 * Computes a multi-stop route with live traffic modeling.
 */
export async function getLiveTrafficMultiStopRoute(
  waypoints: LocationPoint[],
  vehicleCategory: string = 'mini'
): Promise<OSRMRoute | null> {
  if (waypoints.length < 2) return null;

  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(1, waypoints.length - 1);

  const isBike = (vehicleCategory || '').toLowerCase().includes('bike');

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
    travelMode: isBike ? 'TWO_WHEELER' : 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    polylineEncoding: 'ENCODED_POLYLINE',
    languageCode: 'en-US',
    units: 'METRIC',
  };

  if (intermediates.length > 0) {
    requestBody.intermediates = intermediates.map((w) => ({
      location: {
        latLng: {
          latitude: w.latitude,
          longitude: w.longitude,
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
      headers: getSecurityHeaders(),
      body: JSON.stringify(requestBody),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return await getOSRMRoute(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      return await getOSRMRoute(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
    }

    const route = data.routes[0];
    const distanceMeters = route.distanceMeters || 0;
    const rawDurationStr = route.duration || '0s';
    const durationSeconds = parseInt(rawDurationStr.replace('s', ''), 10) || 0;

    const encodedPolyline = route.polyline?.encodedPolyline || '';
    const coordinates = encodedPolyline
      ? decodePolylineGeoJson(encodedPolyline)
      : waypoints.map((w) => [w.longitude, w.latitude] as [number, number]);

    return {
      distance: distanceMeters,
      duration: durationSeconds,
      geometry: {
        type: 'LineString',
        coordinates,
      },
      encodedPolyline,
      source: 'google_routes_api',
    } as OSRMRoute;
  } catch (error) {
    clearTimeout(timeoutId);
    return await getOSRMRoute(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
  }
}
