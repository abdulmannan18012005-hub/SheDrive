import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { DriverStackParamList } from '../types';
import Colors from '../constants/Colors';

import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';
import ActiveRideScreen from '../screens/driver/ActiveRideScreen';
import DriverRideHistoryScreen from '../screens/driver/DriverRideHistoryScreen';

const Stack = createStackNavigator<DriverStackParamList>();

export default function DriverStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="DriverHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.light.primaryDark,
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
        name="DriverHome"
        component={DriverHomeScreen}
        options={{
          title: 'SheDrive — Driver',
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ title: 'Driver Profile' }}
      />
      <Stack.Screen
        name="ActiveRide"
        component={ActiveRideScreen}
        options={{
          title: 'Trip Progress',
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="DriverRideHistory"
        component={DriverRideHistoryScreen}
        options={{ title: 'Trip History' }}
      />
    </Stack.Navigator>
  );
}
