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
 * Calculates realistic urban trip duration in minutes based on category speed and traffic signals.
 * - Bike: Avg speed = 25 km/h + 2 min signal buffer (10 km -> ~26 mins)
 * - Auto / Rickshaw: Avg speed = 20 km/h + 3 min signal buffer (10 km -> ~33 mins)
 * - Car / Mini / Sedan: Avg speed = 20 km/h + 5 min traffic buffer (10 km -> ~35 mins)
 */
export function calculateUrbanTripDuration(
  categoryType: string,
  distanceKm: number
): number {
  const cat = (categoryType || 'mini').toLowerCase();
  let speedKmh = 20;
  let signalBuffer = 5;

  if (cat.includes('bike')) {
    speedKmh = 25;
    signalBuffer = 2;
  } else if (cat.includes('rickshaw') || cat.includes('auto')) {
    speedKmh = 20;
    signalBuffer = 3;
  } else {
    // Mini, Sedan, Car
    speedKmh = 20;
    signalBuffer = 5;
  }

  const travelMinutes = (distanceKm / speedKmh) * 60;
  return Math.max(3, Math.round(travelMinutes + signalBuffer));
}

/**
 * Calculates realistic city speed ETAs by applying OSRM duration and dynamic traffic multipliers.
 */
export function calculateRealisticEta(
  osrmDurationMin: number,
  distanceKm: number
): { etaMins: number; trafficStatus: 'Light' | 'Moderate' | 'Heavy' } {
  // Urban traffic factor for Lahore city traffic (~20-25 km/h average)
  const realisticMins = calculateUrbanTripDuration('mini', distanceKm);
  let status: 'Light' | 'Moderate' | 'Heavy' = 'Moderate';
  if (distanceKm > 10) status = 'Heavy';
  else if (distanceKm < 3) status = 'Light';

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
