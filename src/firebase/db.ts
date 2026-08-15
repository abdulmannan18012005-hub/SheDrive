import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { UserProfile, DriverProfile } from '../types';

/**
 * Converts a local image URI to a base64 data URI string.
 * Used as a free replacement for Firebase Storage uploads.
 * The resulting data URI can be stored directly in Firestore documents
 * and rendered by React Native Image components.
 *
 * @param localUri - local device file URI (e.g. from image picker)
 * @returns base64 data URI string (e.g. "data:image/jpeg;base64,...")
 */
export async function imageToBase64(localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert image to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Updates basic user profile details in Firestore.
 */
export async function updateUserProfile(
  uid: string,
  updatedData: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, updatedData);

  // Sync to drivers collection if the user is a driver
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data() as UserProfile;
    if (userData.role === 'driver') {
      const driverRef = doc(db, 'drivers', uid);
      await updateDoc(driverRef, updatedData);
    }
  }
}

/**
 * Updates driver-specific profile details (vehicle info, online status).
 */
export async function updateDriverProfile(
  uid: string,
  updatedData: Partial<DriverProfile>
): Promise<void> {
  const driverRef = doc(db, 'drivers', uid);
  await updateDoc(driverRef, updatedData);

  // If there are general user details updated, sync them to user profile as well
  const userRef = doc(db, 'users', uid);
  const syncKeys: Array<keyof UserProfile> = ['name', 'phone', 'photoURL'];
  const userUpdates: Partial<UserProfile> = {};

  for (const key of syncKeys) {
    if (updatedData[key] !== undefined) {
      (userUpdates as any)[key] = updatedData[key];
    }
  }

  if (Object.keys(userUpdates).length > 0) {
    await updateDoc(userRef, userUpdates);
  }
}
