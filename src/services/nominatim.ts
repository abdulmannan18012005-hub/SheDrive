import { NOMINATIM_BASE_URL, NOMINATIM_SEARCH_PARAMS } from '../constants/MapConfig';
import { NominatimResult } from '../types';

/**
 * Searches for addresses using the Nominatim (OpenStreetMap) geocoding API.
 * Results are scoped to Pakistan and bounded to the Lahore metropolitan area.
 *
 * @param query - the search string entered by the user
 * @returns array of location results
 */
export async function searchAddress(query: string): Promise<NominatimResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    ...NOMINATIM_SEARCH_PARAMS,
    q: `${query.trim()}, Lahore`,
  });

  try {
    const response = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SheDrive/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();
    return data;
  } catch (error) {
    console.error('Address search failed:', error);
    return [];
  }
}

/**
 * Reverse geocodes coordinates into a human-readable address label.
 *
 * @param latitude - latitude coordinate
 * @param longitude - longitude coordinate
 * @returns display name string or null on failure
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      format: 'json',
      lat: latitude.toString(),
      lon: longitude.toString(),
      zoom: '18',
      addressdetails: '1',
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SheDrive/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim reverse geocode error: ${response.status}`);
    }

    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    console.error('Reverse geocode failed:', error);
    return null;
  }
}
