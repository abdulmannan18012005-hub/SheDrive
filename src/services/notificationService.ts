import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      return enabled;
    }
    // Android permissions are granted by default
    return true;
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
}

/**
 * Get FCM device token
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Check if app has notification permission
    const enabled = await messaging().hasPermission();
    if (!enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        console.log('Notification permission not granted');
        return null;
      }
    }

    // Get the token
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
}

/**
 * Listen for token refresh
 */
export function onTokenRefresh(callback: (token: string) => void) {
  return messaging().onTokenRefresh(callback);
}

/**
 * Listen for incoming messages when app is in foreground
 */
export function onMessageReceived(callback: (message: any) => void) {
  return messaging().onMessage(callback);
}

/**
 * Initialize notification listeners
 */
export function initializeNotificationListeners() {
  // Foreground messages
  const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
    console.log('Foreground message received:', remoteMessage);
    // You can show an in-app notification here
  });

  // Background/quit state messages are handled automatically by FCM
  // No additional code needed for background messages

  return unsubscribeForeground;
}
