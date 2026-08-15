import { Linking, Platform, Alert } from 'react-native';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Coordinates } from '../types';

interface TriggerEmergencyParams {
  userId: string;
  userName: string;
  userRole: 'passenger' | 'driver';
  coords: Coordinates | null;
  activeRideId?: string | null;
}

/**
 * Triggers a security emergency alarm.
 * 1. Launches a phone call to Lahore emergency services (15).
 * 2. Attempts to open the system SMS composer containing pre-filled location info.
 * 3. Log a Firestore alert record under '/emergency_alerts' for central monitoring.
 */
export async function triggerEmergencySOS({
  userId,
  userName,
  userRole,
  coords,
  activeRideId = null,
}: TriggerEmergencyParams): Promise<void> {
  const currentCoordsStr = coords
    ? `Coordinates: Latitude ${coords.latitude.toFixed(6)}, Longitude ${coords.longitude.toFixed(6)}`
    : 'Coordinates: GPS unavailable';

  const smsMessage = `SheDrive - EMERGENCY ALARM! I am ${userName} (${userRole}). I need help immediately. ${currentCoordsStr}. Active Ride ID: ${activeRideId || 'None'}`;

  // 1. Add record to Firestore
  try {
    const alertsCollection = collection(db, 'emergency_alerts');
    await addDoc(alertsCollection, {
      userId,
      userName,
      userRole,
      coords: coords ? { latitude: coords.latitude, longitude: coords.longitude } : null,
      activeRideId,
      timestamp: Date.now(),
      status: 'active',
    });
  } catch (error) {
    console.warn('Failed to upload emergency alert to Firestore:', error);
  }

  // 2. Alert dialogue prompt
  Alert.alert(
    '🚨 EMERGENCY SOS TRIGGERED',
    'Calling Lahore Police (15) and preparing location coordinates text message.',
    [
      {
        text: 'Cancel SOS',
        style: 'cancel',
      },
      {
        text: 'Proceed Call',
        onPress: () => {
          // Launch phone call
          Linking.openURL('tel:15').catch(() => {
            Alert.alert('Calling Failed', 'Device dialer cannot be launched.');
          });

          // Compose SMS after a short delay
          setTimeout(() => {
            const smsUrl = Platform.OS === 'ios'
              ? `sms:15&body=${encodeURIComponent(smsMessage)}`
              : `sms:15?body=${encodeURIComponent(smsMessage)}`;

            Linking.openURL(smsUrl).catch(() => {
              Alert.alert('SMS Failed', 'Could not open SMS composer.');
            });
          }, 1500);
        },
      },
    ]
  );
}
