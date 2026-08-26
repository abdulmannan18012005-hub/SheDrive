import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { Linking } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../contexts/AppContext';
import { auth } from '../config/firebaseConfig';
import { getUserProfileDoc } from '../firebase/auth';
import Colors from '../constants/Colors';

import AuthStack from './AuthStack';
import PassengerStack from './PassengerStack';
import DriverStack from './DriverStack';

function DeepLinkHandler() {
  const navigation = useNavigation();

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (url.includes('reset-password')) {
        let email = undefined;
        let token = undefined;
        let role = undefined;
        try {
          if (url.includes('?')) {
            const queryPart = url.split('?')[1].split('#')[0];
            const params = new URLSearchParams(queryPart);
            email = params.get('email') || undefined;
            token = params.get('token') || undefined;
            role = params.get('role') || undefined;
          }
          if ((!email || !token || !role) && url.includes('#')) {
            const hashPart = url.split('#')[1];
            const params = new URLSearchParams(hashPart);
            email = email || params.get('email') || undefined;
            token = token || params.get('token') || undefined;
            role = role || params.get('role') || undefined;
          }
        } catch (e) {
          // Silently handle parse errors
        }
        
        // Navigate to ResetPassword screen with email, token, and role
        (navigation as any).navigate('ResetPassword', { email, token, role });
      }
    };




    // Handle initial URL (when app opens from deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle incoming URLs (when app is already open)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [navigation]);

  return null;
}

const linking = {
  prefixes: ['shedrive://', 'exp://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

export default function AppNavigator(): React.JSX.Element {
  const { state, dispatch } = useApp();

  useEffect(() => {
    // Listen to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch user profile from Firestore
          const profile = await getUserProfileDoc(firebaseUser.uid);
          if (profile) {
            const savedToken = await AsyncStorage.getItem('@shedrive_auth_token');
            if (savedToken) {
              dispatch({ type: 'SET_TOKEN', payload: savedToken });
            }
            dispatch({ type: 'SET_USER', payload: profile });
            dispatch({ type: 'SET_ROLE', payload: profile.role });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });
          } else {
            // Profile not found in database, sign out
            await AsyncStorage.removeItem('@shedrive_auth_token');
            dispatch({ type: 'LOGOUT' });
          }
        } else {
          await AsyncStorage.removeItem('@shedrive_auth_token');
          dispatch({ type: 'LOGOUT' });
        }
      } catch (error: any) {
        console.warn('[AUTH SESSION WARNING] Network error during auth initialization:', error?.message || error);
        // If a saved auth token exists locally, preserve authentication state rather than forcing a logout
        const savedToken = await AsyncStorage.getItem('@shedrive_auth_token');
        if (savedToken) {
          dispatch({ type: 'SET_TOKEN', payload: savedToken });
          dispatch({ type: 'SET_AUTHENTICATED', payload: true });
        } else {
          dispatch({ type: 'LOGOUT' });
        }
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  // Show a full-screen loading spinner while checking auth status
  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {!state.isAuthenticated ? (
        <AuthStack />
      ) : state.role === 'driver' ? (
        <DriverStack />
      ) : (
        <PassengerStack />
      )}
      <DeepLinkHandler />
    </NavigationContainer>
  );
}


const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
  },
});
