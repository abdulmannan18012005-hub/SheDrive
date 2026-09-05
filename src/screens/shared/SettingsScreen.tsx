import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';
import { useApp } from '../../contexts/AppContext';
import { signOutUser } from '../../firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import sessionManager from '../../utils/sessionManager';

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
        onPress: () => {
          // 1. Immediately reset in-memory state so navigation switches to AuthStack
          dispatch({ type: 'LOGOUT' });

          // 2. Stop session monitoring & wipe all storage tokens
          sessionManager.stopSessionMonitoring();
          AsyncStorage.multiRemove([
            '@shedrive_auth_token',
            '@shedrive_user_profile',
            'shedrive_token',
            'shedrive_user',
            '@shedrive_last_active_role',
            'user_session',
          ]).catch(() => {});

          // 3. Remote signout in background without delaying UI
          signOutUser().catch(() => {});
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

  const [logoutModalVisible, setLogoutModalVisible] = React.useState(false);

  const executeLogout = async () => {
    setLogoutModalVisible(false);
    // 1. Immediately reset in-memory state so navigation switches to AuthStack
    dispatch({ type: 'LOGOUT' });

    // 2. Stop session monitoring & wipe all storage tokens
    sessionManager.stopSessionMonitoring();
    await AsyncStorage.multiRemove([
      '@shedrive_auth_token',
      '@shedrive_user_profile',
      'shedrive_token',
      'shedrive_user',
      '@shedrive_last_active_role',
      'user_session',
    ]).catch(() => {});

    // 3. Remote signout in background without delaying UI
    signOutUser().catch(() => {});
  };

  const dangerItems: SettingsItem[] = [
    {
      icon: '🚪',
      title: 'Sign Out',
      subtitle: 'Log out of your SheDrive account on this device',
      onPress: () => setLogoutModalVisible(true),
    },
    {
      icon: '🗑️',
      title: 'Delete Account',
      subtitle: 'Permanently delete your account and all associated data',
      onPress: () => navigation.navigate('DeleteAccount'),
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.light.background }}>
      {/* Top Header with Back Navigation */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={styles.backBtnIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Settings & Legal</Text>
        <View style={{ width: 36 }} />
      </View>

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
          <Text style={styles.sectionTitle}>Account Actions</Text>
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
              <View style={styles.settingsIcon}>
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

      {/* Custom Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmIconBadge}>
              <Text style={{ fontSize: 24 }}>🚪</Text>
            </View>
            <Text style={styles.confirmModalTitle}>Sign Out from SheDrive?</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to sign out? You will need to log in again with your credentials.
            </Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setLogoutModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmLogoutBtn}
                onPress={executeLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmLogoutBtnText}>Yes, Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.light.text,
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  confirmIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmModalText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
  },
  confirmLogoutBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  confirmLogoutBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
