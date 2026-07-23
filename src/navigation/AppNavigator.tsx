import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { useApp } from '../contexts/AppContext';
import { auth } from '../config/firebaseConfig';
import { getUserProfileDoc } from '../firebase/auth';
import Colors from '../constants/Colors';

import AuthStack from './AuthStack';
import PassengerStack from './PassengerStack';
import DriverStack from './DriverStack';

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
            dispatch({ type: 'SET_USER', payload: profile });
            dispatch({ type: 'SET_ROLE', payload: profile.role });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });
          } else {
            // Profile not found in database, sign out
            dispatch({ type: 'LOGOUT' });
          }
        } else {
          dispatch({ type: 'LOGOUT' });
        }
      } catch (error) {
        console.error('Error in auth state listener:', error);
        dispatch({ type: 'LOGOUT' });
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
    <NavigationContainer>
      {!state.isAuthenticated ? (
        <AuthStack />
      ) : state.role === 'driver' ? (
        <DriverStack />
      ) : (
        <PassengerStack />
      )}
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
