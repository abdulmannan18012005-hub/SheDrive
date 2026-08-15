import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDJMz4WfWrpDdBvAuk9mfk7aAMnclFVUpM',
  authDomain: 'lahore-pink-rides.firebaseapp.com',
  projectId: 'lahore-pink-rides',
  storageBucket: 'lahore-pink-rides.firebasestorage.app',
  messagingSenderId: '984107313094',
  appId: '1:984107313094:web:6e185a0b5ac8bc7fe4f4c7',
  measurementId: 'G-RM8WV3BN1C',
};

// Initialize Firebase app (prevent multiple initializations)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services with AsyncStorage persistence
const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const db: Firestore = getFirestore(app);

export { app, auth, db };
export default app;
