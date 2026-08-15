import { VehicleCategory } from '../types';

/**
 * Smart Fare Calculator Engine
 * Calculates estimated fare based on vehicle category, road distance (KM), and duration (MINS).
 *
 * Formula:
 * Estimated Fare = Max( MinimumFare, BaseFare + (PerKM * Distance) + (PerMin * Duration) + WaitingCharge )
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
 * Detailed Fare Breakdown Object for InDrive-style summary modals
 */
export function getFareBreakdown(
  category: VehicleCategory,
  distanceKm: number,
  durationMin: number
) {
  const baseFare = category.baseFare;
  const distanceFee = Math.round(category.perKmRate * distanceKm);
  const timeFee = Math.round(category.perMinRate * durationMin);
  const rawTotal = baseFare + distanceFee + timeFee;
  const finalFare = Math.max(category.minimumFare, Math.round(rawTotal / 5) * 5);

  return {
    baseFare,
    distanceFee,
    timeFee,
    minimumFare: category.minimumFare,
    finalFare,
  };
}

/**
 * Calculates realistic city speed ETAs by applying OSRM duration and dynamic traffic multipliers.
 */
export function calculateRealisticEta(
  osrmDurationMin: number,
  distanceKm: number
): { etaMins: number; trafficStatus: 'Light' | 'Moderate' | 'Heavy' } {
  // Urban traffic factor for Lahore city traffic (~25-35 km/h)
  let trafficMultiplier = 1.25;
  let status: 'Light' | 'Moderate' | 'Heavy' = 'Moderate';

  const avgSpeedKmH = distanceKm / (osrmDurationMin / 60);

  if (avgSpeedKmH < 20) {
    trafficMultiplier = 1.45;
    status = 'Heavy';
  } else if (avgSpeedKmH > 40) {
    trafficMultiplier = 1.1;
    status = 'Light';
  }

  const realisticMins = Math.max(3, Math.round(osrmDurationMin * trafficMultiplier));

  return {
    etaMins: realisticMins,
    trafficStatus: status,
  };
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
