import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View, Text } from 'react-native';
import { AppProvider } from './src/contexts/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/auth/SplashScreen';

import ErrorBoundary from './src/components/ErrorBoundary';

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
      const { getFCMToken, initializeNotificationListeners } = notificationService;

      // Request permission and get token
      const token = await getFCMToken();
      if (token) {
        console.log('FCM initialized with token:', token.substring(0, 15) + '...');
      }

      // Initialize listeners (foreground, background click, and refresh)
      const unsubscribe = initializeNotificationListeners();

      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    } catch (error) {
      console.error('FCM initialization failed (non-critical):', error);
      // App continues to work without FCM
    }
  };

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
