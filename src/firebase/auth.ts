import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import { UserProfile, UserRole, VehicleInfo } from '../types';

/**
 * Signs in a user with email and password.
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return userCredential.user;
}

/**
 * Registers a new user (passenger or driver) in Firebase Auth and Firestore.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
  phone: string,
  role: UserRole,
  vehicleInfo?: VehicleInfo
): Promise<UserProfile> {
  // Create user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  // Build user profile object
  const userProfile: UserProfile = {
    uid: user.uid,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    phone: phone.trim(),
    role,
    createdAt: Date.now(),
  };

  // Write to Firestore /users collection
  await setDoc(doc(db, 'users', user.uid), {
    ...userProfile,
    serverCreatedAt: serverTimestamp(),
  });

  // If driver, write additional details to /drivers collection
  if (role === 'driver') {
    const driverData = {
      ...userProfile,
      vehicleInfo: {
        category: vehicleInfo?.category || 'mini',
        make: vehicleInfo?.make || '',
        model: vehicleInfo?.model || '',
        plate: vehicleInfo?.plate || '',
        color: vehicleInfo?.color || '',
      },
      isOnline: false,
      isAvailable: true,
      isActive: false, // Default offline/inactive until admin approval
      rating: 5.0,
      totalRides: 0,
      serverCreatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'drivers', user.uid), driverData);
  }

  return userProfile;
}

/**
 * Sign out the current user.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Sends a password reset email.
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Retrieves the user profile document from Firestore.
 */
export async function getUserProfileDoc(uid: string): Promise<UserProfile | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) {
    return null;
  }
  return userDoc.data() as UserProfile;
}
