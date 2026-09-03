import { registerRootComponent } from 'expo';
import messaging from '@react-native-firebase/messaging';
import App from './App';

// Register background messaging handler strictly at the root before component registration
try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[FCM Native Background/Lock-screen Message]:', remoteMessage);
    return Promise.resolve();
  });
} catch (err) {
  console.warn('[FCM] Native background handler notice:', err);
}

registerRootComponent(App);
