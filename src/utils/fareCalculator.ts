import { VehicleCategory } from '../types';

/**
 * Smart Fare Calculator Engine
 * Calculates estimated fare based on vehicle category, road distance (KM), and estimated duration (MINS).
 *
 * Formula:
 * Estimated Fare = Max( MinimumFare, BaseFare + (PerKM * Distance) + (PerMin * Duration) )
 */
export function calculateFare(
  category: VehicleCategory,
  distanceKm: number,
  durationMin: number
): number {
  const rawFare =
    category.baseFare +
    category.perKmRate * distanceKm +
    category.perMinRate * durationMin;

  // Round to nearest 5 PKR for clean pricing
  const roundedFare = Math.round(rawFare / 5) * 5;

  return Math.max(category.minimumFare, roundedFare);
}

/**
 * Validates a user-entered custom fare offer against category minimum fare protection.
 */
export function validateFareOffer(
  offer: number,
  minimumFare: number
): { isValid: boolean; errorMessage?: string } {
  if (isNaN(offer) || offer <= 0) {
    return {
      isValid: false,
      errorMessage: 'Please enter a valid fare amount.',
    };
  }

  if (offer < minimumFare) {
    return {
      isValid: false,
      errorMessage: `Fare cannot be lower than the minimum fare of PKR ${minimumFare} for this category.`,
    };
  }

  return { isValid: true };
}

/**
 * Adjusts fare by step increment (+5 or -5 PKR) respecting minimum fare protection.
 */
export function adjustFareStep(
  currentFare: number,
  delta: number,
  minimumFare: number
): number {
  const newFare = currentFare + delta;
  return Math.max(minimumFare, newFare);
}
