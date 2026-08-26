import { Coordinates } from '../types';

// Google Places (New) API Key configuration
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCsOFBXAEmYvsV7SG6-VKK4cjyH9NoS7vs';
const ANDROID_PACKAGE_NAME = 'com.lahore.pinkrides';
const ANDROID_SHA1_CERT = '5E8F16062EA3CD2C4A0D547876BAA6F38CABF625';

const PLACES_API_BASE_URL = 'https://places.googleapis.com/v1';

export interface GooglePlacePrediction {
  placeId: string;
  title: string;
  subtitle: string;
  fullText: string;
}

export interface GooglePlaceDetail {
  placeId: string;
  name: string;
  formattedAddress: string;
  coordinates: Coordinates;
}

/**
 * Common security headers required for Google Cloud API authentication
 * Includes Android package verification headers so restricted keys authenticate reliably.
 */
function getSecurityHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
    'X-Android-Package': ANDROID_PACKAGE_NAME,
    'X-Android-Cert': ANDROID_SHA1_CERT,
    ...extraHeaders,
  };
}

/**
 * Searches for places/addresses using Google Places API (New) Autocomplete.
 * Scoped to Pakistan and biased towards Lahore metropolitan area.
 *
 * @param input - The search string typed by the passenger
 * @param userCoords - Optional current user coordinates for location-biased relevance
 * @returns Array of GooglePlacePrediction objects
 */
export async function getPlaceAutocomplete(
  input: string,
  userCoords?: Coordinates | null
): Promise<GooglePlacePrediction[]> {
  if (!input || input.trim().length < 2) {
    return [];
  }

  try {
    const requestBody: any = {
      input: input.trim(),
      includedRegionCodes: ['pk'],
      languageCode: 'en',
    };

    // Apply location bias to Lahore / User coordinates if available
    const centerLat = userCoords?.latitude || 31.5204;
    const centerLng = userCoords?.longitude || 74.3587;
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: centerLat,
          longitude: centerLng,
        },
        radius: 30000.0, // 30km radius covering Lahore metropolitan zone
      },
    };

    const response = await fetch(`${PLACES_API_BASE_URL}/places:autocomplete`, {
      method: 'POST',
      headers: getSecurityHeaders(),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`Places API Autocomplete HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.suggestions || !Array.isArray(data.suggestions)) {
      return [];
    }

    return data.suggestions
      .filter((item: any) => item.placePrediction && item.placePrediction.placeId)
      .map((item: any) => {
        const pred = item.placePrediction;
        const mainText = pred.structuredFormat?.mainText?.text || pred.text?.text || '';
        const secondaryText = pred.structuredFormat?.secondaryText?.text || '';
        const fullText = pred.text?.text || `${mainText}${secondaryText ? ', ' + secondaryText : ''}`;

        return {
          placeId: pred.placeId,
          title: mainText || fullText,
          subtitle: secondaryText,
          fullText: fullText,
        };
      });
  } catch (error) {
    console.error('Error fetching Google Places autocomplete:', error);
    return [];
  }
}

/**
 * Resolves precise coordinates, display name, and formatted address for a placeId.
 *
 * @param placeId - The unique Google Place ID returned from autocomplete
 * @returns GooglePlaceDetail object with exact latitude, longitude, and address
 */
export async function getPlaceDetailsById(placeId: string): Promise<GooglePlaceDetail | null> {
  if (!placeId) return null;

  try {
    const response = await fetch(`${PLACES_API_BASE_URL}/places/${placeId}`, {
      method: 'GET',
      headers: getSecurityHeaders({
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
      }),
    });

    if (!response.ok) {
      console.warn(`Places API Details HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.location || typeof data.location.latitude !== 'number' || typeof data.location.longitude !== 'number') {
      console.warn('Places API returned invalid location geometry:', data);
      return null;
    }

    return {
      placeId: data.id || placeId,
      name: data.displayName?.text || data.formattedAddress || 'Selected Location',
      formattedAddress: data.formattedAddress || data.displayName?.text || '',
      coordinates: {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      },
    };
  } catch (error) {
    console.error('Error fetching Google Place details:', error);
    return null;
  }
}

/**
 * Searches places by raw text query using Google Places API (New) Text Search.
 * Useful for direct landmark/POI lookup when full query is entered.
 *
 * @param query - Raw search query string (e.g. "Lahore Airport", "Emporium Mall")
 * @param userCoords - Optional user coordinates for location bias
 * @returns Array of GooglePlaceDetail objects
 */
export async function searchPlacesByTextQuery(
  query: string,
  userCoords?: Coordinates | null
): Promise<GooglePlaceDetail[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const centerLat = userCoords?.latitude || 31.5204;
    const centerLng = userCoords?.longitude || 74.3587;

    const requestBody = {
      textQuery: query.includes('Lahore') ? query : `${query}, Lahore`,
      languageCode: 'en',
      locationBias: {
        circle: {
          center: {
            latitude: centerLat,
            longitude: centerLng,
          },
          radius: 30000.0,
        },
      },
    };

    const response = await fetch(`${PLACES_API_BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: getSecurityHeaders({
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      }),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn(`Places API TextSearch HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.places || !Array.isArray(data.places)) {
      return [];
    }

    return data.places
      .filter((p: any) => p.location && typeof p.location.latitude === 'number')
      .map((p: any) => ({
        placeId: p.id || '',
        name: p.displayName?.text || p.formattedAddress || 'Location',
        formattedAddress: p.formattedAddress || p.displayName?.text || '',
        coordinates: {
          latitude: p.location.latitude,
          longitude: p.location.longitude,
        },
      }));
  } catch (error) {
    console.error('Error in searchPlacesByTextQuery:', error);
    return [];
  }
}
