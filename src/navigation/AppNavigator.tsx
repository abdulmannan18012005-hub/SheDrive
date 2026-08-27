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
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('@shedrive_auth_token');
        const savedUserJson = await AsyncStorage.getItem('@shedrive_user_profile');

        if (savedToken && savedUserJson) {
          const userProfile = JSON.parse(savedUserJson);
          if (isMounted) {
            dispatch({ type: 'SET_TOKEN', payload: savedToken });
            dispatch({ type: 'SET_USER', payload: userProfile });
            dispatch({ type: 'SET_ROLE', payload: userProfile.role });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });
            dispatch({ type: 'SET_LOADING', payload: false });
          }

          // Background validation with backend API (non-blocking)
          try {
            const { getApiBaseUrl } = await import('../config/apiConfig');
            const res = await fetch(`${getApiBaseUrl()}/user/profile`, {
              headers: { Authorization: `Bearer ${savedToken}` },
            });

            if (res.ok) {
              const data = await res.json();
              if (data.user && isMounted) {
                const refreshedUser = {
                  uid: data.user.id,
                  phone: data.user.phone,
                  email: data.user.email,
                  name: data.user.name,
                  role: data.user.role,
                  cnic: data.user.cnic || '',
                  gender: 'female',
                  isVerified: data.user.is_verified ?? true,
                  photoURL: data.user.photo_url || undefined,
                  createdAt: Date.now(),
                };
                dispatch({ type: 'SET_USER', payload: refreshedUser });
                AsyncStorage.setItem('@shedrive_user_profile', JSON.stringify(refreshedUser)).catch(() => {});
              }
            } else if (res.status === 401 || res.status === 403) {
              // Token genuinely rejected by backend -> logout
              await AsyncStorage.removeItem('@shedrive_auth_token');
              await AsyncStorage.removeItem('@shedrive_user_profile');
              if (isMounted) {
                dispatch({ type: 'LOGOUT' });
              }
            }
            // If offline / network error: retain cached session without logging out
          } catch (netErr) {
            console.warn('[Session Restore] Background validation offline/network error (session retained):', netErr);
          }
          return;
        }

        // Fallback check for Firebase Auth if no JWT session exists
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          try {
            if (firebaseUser) {
              const profile = await getUserProfileDoc(firebaseUser.uid);
              if (profile && isMounted) {
                dispatch({ type: 'SET_USER', payload: profile });
                dispatch({ type: 'SET_ROLE', payload: profile.role });
                dispatch({ type: 'SET_AUTHENTICATED', payload: true });
                AsyncStorage.setItem('@shedrive_user_profile', JSON.stringify(profile)).catch(() => {});
              }
            }
          } catch (err) {
            console.warn('[Firebase Auth] Initialization warning:', err);
          } finally {
            if (isMounted) {
              dispatch({ type: 'SET_LOADING', payload: false });
            }
          }
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('[Session Restore Error]:', error);
      } finally {
        if (isMounted) {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
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
