import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { AppProvider } from './src/contexts/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { getFCMToken, initializeNotificationListeners, onTokenRefresh } from './src/services/notificationService';

export default function App(): React.JSX.Element {
  useEffect(() => {
    // Initialize FCM
    setupFCM();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // Refresh token when app comes to foreground
        getFCMToken();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const setupFCM = async () => {
    try {
      // Request permission and get token
      const token = await getFCMToken();
      if (token) {
        console.log('FCM initialized with token:', token);
        // TODO: Send token to your backend API
        // await sendTokenToBackend(token);
      }

      // Initialize listeners
      const unsubscribe = initializeNotificationListeners();
      
      // Listen for token refresh
      const unsubscribeTokenRefresh = onTokenRefresh(async newToken => {
        console.log('Token refreshed:', newToken);
        // TODO: Send new token to backend
        // await sendTokenToBackend(newToken);
      });

      return () => {
        unsubscribe();
        unsubscribeTokenRefresh();
      };
    } catch (error) {
      console.error('FCM initialization failed:', error);
    }
  };

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
