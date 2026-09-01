import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { signOutUser } from '../../firebase/auth';

interface SettingsItem {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export default function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<any>();
  const { state, dispatch } = useApp();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of SheDrive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutUser();
            dispatch({ type: 'LOGOUT' });
          } catch {
            Alert.alert('Error', 'Unable to sign out. Please check your network connection.');
          }
        },
      },
    ]);
  };

  const settingsItems: SettingsItem[] = [
    {
      icon: '🔔',
      title: 'Notification Settings',
      subtitle: 'Manage your notification preferences',
      onPress: () => navigation.navigate('NotificationSettings'),
    },
    {
      icon: '🚗',
      title: 'About SheDrive',
      subtitle: 'Learn about our platform, mission & how it works',
      onPress: () => navigation.navigate('AboutUs'),
    },
    {
      icon: '📋',
      title: 'User Agreement',
      subtitle: 'Your rights and responsibilities as a user',
      onPress: () => navigation.navigate('UserAgreement'),
    },
    {
      icon: '⚖️',
      title: 'Terms & Conditions',
      subtitle: 'Platform usage terms, policies and obligations',
      onPress: () => navigation.navigate('TermsAndConditions'),
    },
    {
      icon: '🔒',
      title: 'Privacy Policy',
      subtitle: 'How we collect, use, and protect your data',
      onPress: () => navigation.navigate('PrivacyPolicy'),
    },
  ];

  const dangerItems: SettingsItem[] = [
    {
      icon: '🗑️',
      title: 'Delete Account',
      subtitle: 'Permanently delete your account and all associated data',
      onPress: () => navigation.navigate('DeleteAccount'),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Text style={styles.headerIcon}>⚙️</Text>
        </View>
        <Text style={styles.headerTitle}>Settings & Legal</Text>
        <Text style={styles.headerSubtitle}>Manage your preferences and view platform agreements</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Legal & Information</Text>
        {settingsItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.settingsRow,
              index === settingsItems.length - 1 && styles.settingsRowLast,
            ]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.settingsIcon}>
              <Text style={styles.settingsIconText}>{item.icon}</Text>
            </View>
            <View style={styles.settingsContent}>
              <Text style={styles.settingsTitle}>{item.title}</Text>
              <Text style={styles.settingsSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.dangerCard}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        {dangerItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.settingsRow,
              index === dangerItems.length - 1 && styles.settingsRowLast,
            ]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={[styles.settingsIcon, styles.dangerIcon]}>
              <Text style={styles.settingsIconText}>{item.icon}</Text>
            </View>
            <View style={styles.settingsContent}>
              <Text style={[styles.settingsTitle, styles.dangerTitle]}>{item.title}</Text>
              <Text style={styles.settingsSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={[styles.chevron, styles.dangerChevron]}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLogo}>🚗 SheDrive</Text>
        <Text style={styles.footerText}>Pakistan's First Women-Only Ride-Hailing Platform</Text>
        <Text style={styles.footerVersion}>Version 1.0.0 — Lahore, Pakistan</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  headerIcon: {
    fontSize: 36,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.light.surface,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.light.textSecondary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  settingsRowLast: {
    borderBottomWidth: 0,
  },
  settingsIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.light.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingsIconText: {
    fontSize: 20,
  },
  settingsContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  settingsSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 17,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    color: Colors.light.textTertiary,
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  footerLogo: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.light.primary,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  footerVersion: {
    fontSize: 12,
    color: Colors.light.textTertiary,
    textAlign: 'center',
  },
  dangerCard: {
    backgroundColor: Colors.light.errorLight,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.error,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  dangerIcon: {
    backgroundColor: Colors.light.error,
  },
  dangerTitle: {
    color: Colors.light.error,
  },
  dangerChevron: {
    color: Colors.light.error,
  },
});
