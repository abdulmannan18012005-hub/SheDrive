import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View, Text } from 'react-native';
import { AppProvider } from './src/contexts/AppContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Delay FCM initialization to prevent app crash
    const timer = setTimeout(() => {
      setIsReady(true);
      initializeFCM();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const initializeFCM = async () => {
    try {
      // Dynamic import to prevent crash if module not available
      const notificationService = await import('./src/services/notificationService');
      const { getFCMToken, initializeNotificationListeners, onTokenRefresh } = notificationService;
      
      // Request permission and get token
      const token = await getFCMToken();
      if (token) {
        console.log('FCM initialized with token:', token);
      }

      // Initialize listeners
      const unsubscribe = initializeNotificationListeners();
      
      // Listen for token refresh
      const unsubscribeTokenRefresh = onTokenRefresh(async newToken => {
        console.log('Token refreshed:', newToken);
      });

      return () => {
        unsubscribe();
        unsubscribeTokenRefresh();
      };
    } catch (error) {
      console.error('FCM initialization failed (non-critical):', error);
      // App continues to work without FCM
    }
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#E91E63', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>SheDrive</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
