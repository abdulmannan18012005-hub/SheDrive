import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import App from './App';

// Setup background notification handler for Expo Notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Register background messaging handler strictly at the root before component registration
try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[FCM Native Background/Lock-screen Message]:', remoteMessage);
    // Trigger local notification if in background
    if (remoteMessage.notification) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification.title,
          body: remoteMessage.notification.body,
          sound: 'default',
        },
        trigger: null,
      });
    }
    return Promise.resolve();
  });
} catch (err) {
  console.warn('[FCM] Native background handler notice:', err);
}

registerRootComponent(App);
