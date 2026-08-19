import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { getApiBaseUrl } from '../config/apiConfig';

const getMessagingInstance = () => (typeof messaging === 'function' ? (messaging as any)() : (messaging as any));

export interface NotificationPayload {
  title?: string;
  body?: string;
  data?: {
    type?: string;
    rideId?: string;
    senderId?: string;
    [key: string]: any;
  };
}

/**
 * Request notification permission across iOS and Android (API 33+)
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

    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'SheDrive Notification Permission',
            message: 'SheDrive needs notification access to alert you about ride requests, driver arrivals, and safety updates.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    }

    return true;
  } catch (error) {
    console.error('Notification permission request error:', error);
    return false;
  }
}

/**
 * Get device FCM token with permission check
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const hasPerm = await requestNotificationPermission();
    if (!hasPerm) {
      console.log('[FCM] Permission not granted by user');
      return null;
    }

    const token = await getMessagingInstance().getToken();
    console.log('[FCM] Device Token acquired:', token ? `${token.substring(0, 15)}...` : 'null');
    return token;
  } catch (error) {
    console.error('[FCM] Failed to acquire FCM token:', error);
    return null;
  }
}

/**
 * Synchronize FCM token with PostgreSQL backend and Firestore
 */
export async function registerDeviceTokenWithBackend(
  authToken?: string,
  userId?: string,
  role?: 'passenger' | 'driver' | 'admin'
): Promise<boolean> {
  try {
    const token = await getFCMToken();
    if (!token) return false;

    // 1. Sync with PostgreSQL backend via REST
    if (authToken) {
      try {
        await fetch(`${getApiBaseUrl()}/notifications/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ fcmToken: token }),
        });
        console.log('[FCM] Token synchronized with backend database');
      } catch (backendErr) {
        console.warn('[FCM] Backend token sync notice:', backendErr);
      }
    }

    // 2. Sync with Firestore user/driver document for real-time dispatch
    if (userId) {
      try {
        const collectionName = role === 'driver' ? 'drivers' : 'users';
        const docRef = doc(db, collectionName, userId);
        await updateDoc(docRef, {
          fcmToken: token,
          lastTokenUpdate: Date.now(),
        });
        console.log(`[FCM] Token updated in Firestore ${collectionName}/${userId}`);
      } catch (firestoreErr) {
        // Doc might not exist yet during early onboarding; non-critical
      }
    }

    return true;
  } catch (error) {
    console.error('[FCM] Error registering token with backend:', error);
    return false;
  }
}

/**
 * Clean up token on user logout to prevent cross-account notifications
 */
export async function unregisterDeviceToken(authToken?: string, userId?: string, role?: string): Promise<void> {
  try {
    if (authToken) {
      try {
        await fetch(`${getApiBaseUrl()}/notifications/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ fcmToken: null }),
        });
      } catch (e) {
        // Ignore network errors on logout
      }
    }

    if (userId) {
      try {
        const collectionName = role === 'driver' ? 'drivers' : 'users';
        const docRef = doc(db, collectionName, userId);
        await updateDoc(docRef, { fcmToken: null });
      } catch (e) {
        // Ignore
      }
    }
  } catch (err) {
    console.warn('[FCM] Token cleanup warning:', err);
  }
}

/**
 * Handle navigation when a notification is tapped
 */
export function handleNotificationNavigation(
  navigation: any,
  data?: Record<string, any>
) {
  if (!navigation || !data) return;

  const { type, rideId } = data;

  try {
    if (type === 'new_ride_request' || type === 'ride_offer') {
      navigation.navigate('DriverHome', { selectedRideId: rideId });
    } else if (type === 'counter_bid' || type === 'driver_arrived' || type === 'ride_started' || type === 'ride_completed') {
      navigation.navigate('RideTracking', { rideId });
    } else if (type === 'ride_accepted') {
      navigation.navigate('ActiveRide', { rideId });
    } else if (type === 'driver_verified' || type === 'driver_rejected') {
      navigation.navigate('DriverProfile');
    } else if (type === 'sos_alert') {
      Alert.alert('🚨 Emergency Alert', 'An emergency notification was received.');
    }
  } catch (navError) {
    console.warn('[FCM] Notification navigation warning:', navError);
  }
}

/**
 * Initialize all lifecycle notification listeners (Foreground, Background, Quit)
 */
export function initializeNotificationListeners(
  navigationRef?: any,
  onForegroundMessage?: (payload: NotificationPayload) => void
) {
  const messagingInst = getMessagingInstance();

  // 1. Foreground Message Handler
  const unsubscribeForeground = messagingInst.onMessage(async (remoteMessage: any) => {
    console.log('[FCM Foreground Alert Received]:', remoteMessage);

    const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'SheDrive Notification';
    const body = remoteMessage.notification?.body || remoteMessage.data?.body || '';
    const data = remoteMessage.data || {};

    if (onForegroundMessage) {
      onForegroundMessage({ title, body, data });
    } else {
      Alert.alert(title, body, [
        {
          text: 'Dismiss',
          style: 'cancel',
        },
        {
          text: 'View',
          onPress: () => {
            if (navigationRef?.isReady && navigationRef.isReady()) {
              handleNotificationNavigation(navigationRef, data);
            }
          },
        },
      ]);
    }
  });

  // 2. Background State Notification Click Handler (App was in background/minimized)
  const unsubscribeOpened = messagingInst.onNotificationOpenedApp((remoteMessage: any) => {
    console.log('[FCM Background Notification Tapped]:', remoteMessage);
    if (navigationRef?.isReady && navigationRef.isReady()) {
      handleNotificationNavigation(navigationRef, remoteMessage.data);
    }
  });

  // 3. Cold Launch Check (App was completely closed/killed when tapped)
  messagingInst.getInitialNotification().then((remoteMessage: any) => {
    if (remoteMessage) {
      console.log('[FCM Cold-Launch Notification Tapped]:', remoteMessage);
      setTimeout(() => {
        if (navigationRef?.isReady && navigationRef.isReady()) {
          handleNotificationNavigation(navigationRef, remoteMessage.data);
        }
      }, 1000);
    }
  });

  // 4. Token Refresh Listener
  const unsubscribeTokenRefresh = messagingInst.onTokenRefresh(async (newToken: string) => {
    console.log('[FCM Token Refreshed]:', newToken);
  });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
    unsubscribeTokenRefresh();
  };
}
