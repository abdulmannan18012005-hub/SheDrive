import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { DriverStackParamList } from '../types';
import Colors from '../constants/Colors';

import DriverHomeScreen from '../screens/driver/DriverHomeScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';
import ActiveRideScreen from '../screens/driver/ActiveRideScreen';
import DriverRideHistoryScreen from '../screens/driver/DriverRideHistoryScreen';
import MonthlyPaymentScreen from '../screens/driver/MonthlyPaymentScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import AboutUsScreen from '../screens/shared/AboutUsScreen';
import UserAgreementScreen from '../screens/shared/UserAgreementScreen';
import TermsAndConditionsScreen from '../screens/shared/TermsAndConditionsScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import NotificationSettingsScreen from '../screens/shared/NotificationSettingsScreen';
import DeleteAccountScreen from '../screens/shared/DeleteAccountScreen';
import VehicleManagementScreen from '../screens/driver/VehicleManagementScreen';
import LanguageSelectionScreen from '../screens/shared/LanguageSelectionScreen';
import HelpSupportScreen from '../screens/shared/HelpSupportScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import NotificationCenterScreen from '../screens/shared/NotificationCenterScreen';
import ContactUsScreen from '../screens/shared/ContactUsScreen';

const Stack = createStackNavigator<DriverStackParamList>();

export default function DriverStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="DriverHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.light.border,
        },
        headerTintColor: Colors.light.primaryDark,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: Colors.light.text,
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
        name="VehicleManagement"
        component={VehicleManagementScreen}
        options={{ title: 'Vehicle Management' }}
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
      <Stack.Screen
        name="MonthlyPayment"
        component={MonthlyPaymentScreen}
        options={{ title: 'Monthly Platform Fee' }}
      />
      <Stack.Screen
        name="DriverSettings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="NotificationCenter"
        component={NotificationCenterScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: 'Notification Settings' }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ title: 'Delete Account' }}
      />
      <Stack.Screen
        name="LanguageSelection"
        component={LanguageSelectionScreen}
        options={{ title: 'Language' }}
      />
      <Stack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ title: 'Help & Support' }}
      />
      <Stack.Screen
        name="ContactUs"
        component={ContactUsScreen}
        options={{ title: 'Contact Us' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <Stack.Screen
        name="AboutUs"
        component={AboutUsScreen}
        options={{ title: 'About SheDrive' }}
      />
      <Stack.Screen
        name="UserAgreement"
        component={UserAgreementScreen}
        options={{ title: 'User Agreement' }}
      />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
        options={{ title: 'Terms & Conditions' }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: 'Privacy Policy' }}
      />
    </Stack.Navigator>
  );
}
