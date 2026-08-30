import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View, Text } from 'react-native';
import { AppProvider } from './src/contexts/AppContext';
import AppNavigator from './src/navigation/AppNavigator';

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
      const { getFCMToken, initializeNotificationListeners, registerBackgroundMessageHandler } = notificationService;
      
      // Register background handler for lock-screen & background push
      if (typeof registerBackgroundMessageHandler === 'function') {
        registerBackgroundMessageHandler();
      }

      // Request permission and get token
      const token = await getFCMToken();
      if (token) {
        console.log('FCM initialized with token:', token.substring(0, 15) + '...');
      }

      // Initialize listeners (foreground, background, and refresh)
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
    return (
      <View style={{ flex: 1, backgroundColor: '#E91E63', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>SheDrive</Text>
      </View>
    );
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
