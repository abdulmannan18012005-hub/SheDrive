import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

const getMessagingInstance = () => (typeof messaging === 'function' ? (messaging as any)() : (messaging as any));

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await getMessagingInstance().requestPermission();
      const enabled =
        authStatus === (messaging as any).AuthorizationStatus?.AUTHORIZED ||
        authStatus === (messaging as any).AuthorizationStatus?.PROVISIONAL;
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
    const enabled = await getMessagingInstance().hasPermission();
    if (!enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        console.log('Notification permission not granted');
        return null;
      }
    }

    // Get the token
    const token = await getMessagingInstance().getToken();
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
  return getMessagingInstance().onTokenRefresh(callback);
}

/**
 * Listen for incoming messages when app is in foreground
 */
export function onMessageReceived(callback: (message: any) => void) {
  return getMessagingInstance().onMessage(callback);
}

/**
 * Initialize notification listeners
 */
export function initializeNotificationListeners() {
  // Foreground messages
  const unsubscribeForeground = getMessagingInstance().onMessage(async (remoteMessage: any) => {
    console.log('Foreground message received:', remoteMessage);
    // You can show an in-app notification here
  });

  return unsubscribeForeground;
}

