import { FARE_CONFIG } from '../constants/MapConfig';

/**
 * Estimates a fare given distance and duration.
 * @param distanceKm - distance in kilometers
 * @param durationMin - duration in minutes
 * @returns estimated fare in PKR
 */
export function estimateFare(distanceKm: number, durationMin: number): number {
  const { baseFare, perKmRate, perMinRate, minimumFare, surgeFactor } = FARE_CONFIG;
  const calculated = (baseFare + distanceKm * perKmRate + durationMin * perMinRate) * surgeFactor;
  return Math.max(Math.round(calculated / 10) * 10, minimumFare);
}

/**
 * Formats a PKR currency value as a human-readable string.
 * @param amount - amount in PKR
 * @returns formatted currency string, e.g. "Rs. 350"
 */
export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}

/**
 * Formats a distance in meters to a human-readable string.
 * @param meters - distance in meters
 * @returns formatted distance string, e.g. "2.3 km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formats a duration in seconds to a human-readable string.
 * @param seconds - duration in seconds
 * @returns formatted duration string, e.g. "12 min"
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Calculates the straight-line (Haversine) distance between two coordinates.
 * @param lat1 - latitude of point 1
 * @param lon1 - longitude of point 1
 * @param lat2 - latitude of point 2
 * @param lon2 - longitude of point 2
 * @returns distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Generates a unique ID string.
 * @returns a random alphanumeric ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Validates an email address format.
 * @param email - email string to validate
 * @returns true if valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates a Pakistani phone number format.
 * Accepts formats like 03001234567 or +923001234567
 * @param phone - phone number string to validate
 * @returns true if valid
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+92|0)(3[0-9]{2})[0-9]{7}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Truncates a string to a max length with ellipsis.
 * @param str - input string
 * @param maxLen - maximum length before truncation
 * @returns truncated string
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
