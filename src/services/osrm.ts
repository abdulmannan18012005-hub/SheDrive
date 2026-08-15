import { OSRM_BASE_URL } from '../constants/MapConfig';
import { OSRMRoute } from '../types';

/**
 * Calculates a driving route between two coordinates using the OSRM public API.
 * Returns the route geometry (as GeoJSON coordinates), distance (meters), and duration (seconds).
 *
 * @param startLat - origin latitude
 * @param startLon - origin longitude
 * @param endLat - destination latitude
 * @param endLon - destination longitude
 * @returns OSRMRoute object or null on failure
 */
export async function getRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<OSRMRoute | null> {
  try {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${startLon},${startLat};${endLon},${endLat}` +
      `?overview=full&geometries=geojson&alternatives=false`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error('OSRM returned no routes:', data.code);
      return null;
    }

    const route = data.routes[0];

    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    };
  } catch (error) {
    console.error('Route calculation failed:', error);
    return null;
  }
}

/**
 * Calculates a driving route and returns multiple alternatives if available.
 *
 * @param startLat - origin latitude
 * @param startLon - origin longitude
 * @param endLat - destination latitude
 * @param endLon - destination longitude
 * @returns array of OSRMRoute objects
 */
export async function getRouteWithAlternatives(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): Promise<OSRMRoute[]> {
  try {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${startLon},${startLat};${endLon},${endLat}` +
      `?overview=full&geometries=geojson&alternatives=true`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OSRM API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return [];
    }

    return data.routes.map((route: { distance: number; duration: number; geometry: { type: string; coordinates: Array<[number, number]> } }) => ({
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    }));
  } catch (error) {
    console.error('Route with alternatives failed:', error);
    return [];
  }
}
