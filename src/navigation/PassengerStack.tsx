import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { PassengerStackParamList } from '../types';
import Colors from '../constants/Colors';

import PassengerHomeScreen from '../screens/passenger/PassengerHomeScreen';
import ProfileScreen from '../screens/passenger/ProfileScreen';
import EditProfileScreen from '../screens/passenger/EditProfileScreen';
import SearchScreen from '../screens/passenger/SearchScreen';
import FareBidScreen from '../screens/passenger/FareBidScreen';
import RideTrackingScreen from '../screens/passenger/RideTrackingScreen';
import RideHistoryScreen from '../screens/passenger/RideHistoryScreen';

const Stack = createStackNavigator<PassengerStackParamList>();

export default function PassengerStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="PassengerHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.light.primary,
          elevation: 4,
          shadowOpacity: 0.15,
        },
        headerTintColor: Colors.light.textOnPrimary,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackTitleVisible: false,
        cardStyle: {
          backgroundColor: Colors.light.background,
        },
      }}
    >
      <Stack.Screen
        name="PassengerHome"
        component={PassengerHomeScreen}
        options={{
          title: 'SheDrive',
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Select Route' }}
      />
      <Stack.Screen
        name="FareBid"
        component={FareBidScreen}
        options={{ title: 'Confirm Bidding' }}
      />
      <Stack.Screen
        name="RideTracking"
        component={RideTrackingScreen}
        options={{ title: 'Track Ride', headerLeft: () => null }}
      />
      <Stack.Screen
        name="RideHistory"
        component={RideHistoryScreen}
        options={{ title: 'My Trips' }}
      />
    </Stack.Navigator>
  );
}
