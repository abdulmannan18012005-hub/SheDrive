import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { DriverProfile, Coordinates, VehicleCategoryId } from '../types';
import { haversineDistance } from '../utils/helpers';

export interface DriverMatchResult {
  driver: DriverProfile;
  distanceKm: number;
}

/**
 * Intelligent Driver Matching Service
 * Filters and ranks available drivers based on:
 * 1. Matching vehicle category
 * 2. Online, verified, and available status
 * 3. Nearest proximity to passenger pickup location
 * 4. Highest driver rating score
 */
export async function findMatchingDrivers(
  pickupCoords: Coordinates,
  requestedCategory?: VehicleCategoryId,
  maxSearchRadiusKm: number = 15
): Promise<DriverMatchResult[]> {
  try {
    const driversRef = collection(db, 'drivers');
    // Query drivers who are online and available
    const q = query(
      driversRef,
      where('isOnline', '==', true),
      where('isAvailable', '==', true)
    );

    const snapshot = await getDocs(q);
    const candidateDrivers: DriverMatchResult[] = [];

    snapshot.forEach((docSnap) => {
      const driver = docSnap.data() as DriverProfile;

      // Filter by vehicle category matching if specified
      if (
        requestedCategory &&
        driver.vehicleInfo &&
        driver.vehicleInfo.category &&
        driver.vehicleInfo.category !== requestedCategory
      ) {
        return;
      }

      // Ensure driver has active valid GPS location
      if (driver.latitude && driver.longitude) {
        const distKm = haversineDistance(
          pickupCoords.latitude,
          pickupCoords.longitude,
          driver.latitude,
          driver.longitude
        );

        if (distKm <= maxSearchRadiusKm) {
          candidateDrivers.push({
            driver,
            distanceKm: distKm,
          });
        }
      }
    });

    // Rank candidates: prioritize nearest distance, then highest rating
    candidateDrivers.sort((a, b) => {
      if (Math.abs(a.distanceKm - b.distanceKm) > 0.5) {
        return a.distanceKm - b.distanceKm; // Nearest first
      }
      return (b.driver.rating || 5.0) - (a.driver.rating || 5.0); // Highest rating tiebreaker
    });

    return candidateDrivers;
  } catch (error) {
    console.error('Error during driver matching query:', error);
    return [];
  }
}
