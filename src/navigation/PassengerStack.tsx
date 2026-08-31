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
import SettingsScreen from '../screens/shared/SettingsScreen';
import AboutUsScreen from '../screens/shared/AboutUsScreen';
import UserAgreementScreen from '../screens/shared/UserAgreementScreen';
import TermsAndConditionsScreen from '../screens/shared/TermsAndConditionsScreen';
import PrivacyPolicyScreen from '../screens/shared/PrivacyPolicyScreen';
import SavedPlacesScreen from '../screens/shared/SavedPlacesScreen';
import NotificationSettingsScreen from '../screens/shared/NotificationSettingsScreen';
import DeleteAccountScreen from '../screens/shared/DeleteAccountScreen';
import LanguageSelectionScreen from '../screens/shared/LanguageSelectionScreen';
import HelpSupportScreen from '../screens/shared/HelpSupportScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import NotificationCenterScreen from '../screens/shared/NotificationCenterScreen';
import NotificationDetailScreen from '../screens/shared/NotificationDetailScreen';
import ContactUsScreen from '../screens/shared/ContactUsScreen';
import ReportProblemScreen from '../screens/shared/ReportProblemScreen';

const Stack = createStackNavigator<PassengerStackParamList>();

export default function PassengerStack(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="PassengerHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.light.border,
        },
        headerTintColor: Colors.light.primary,
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
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="SavedPlaces"
        component={SavedPlacesScreen}
        options={{ title: 'Saved Places' }}
      />
      <Stack.Screen
        name="NotificationCenter"
        component={NotificationCenterScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{ title: 'Notification Details' }}
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
        name="ReportProblem"
        component={ReportProblemScreen}
        options={{ title: 'Report a Problem' }}
      />
    </Stack.Navigator>
  );
}
