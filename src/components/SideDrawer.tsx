import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Image,
  Alert,
  SafeAreaView,
  Linking,
  ScrollView,
} from 'react-native';
import Colors from '../constants/Colors';
import { UserProfile } from '../types';
import { signOutUser } from '../firebase/auth';
import { useApp } from '../contexts/AppContext';
import { CONTACT_INFO } from '../config/contactConfig';
import { FeedbackModal } from './FeedbackModal';

import { Easing } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 320);

interface SideDrawerProps {
  visible: boolean;
  user: UserProfile | null;
  role: 'passenger' | 'driver';
  onClose: () => void;
  navigation: any;
  dispatch: any;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  visible,
  user,
  role,
  onClose,
  navigation,
  dispatch,
}) => {
  const { state } = useApp();
  const [feedbackVisible, setFeedbackVisible] = React.useState(false);
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          easing: Easing.bezier(0.4, 0, 1, 1),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleNavigate = (screenName: string) => {
    onClose();
    setTimeout(() => {
      navigation.navigate(screenName);
    }, 150);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Backdrop Overlay */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Drawer Content */}
        <Animated.View
          style={[
            styles.drawerContent,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Header User Profile Section */}
              <View style={styles.headerSection}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => handleNavigate(role === 'driver' ? 'DriverProfile' : 'Profile')}
                  activeOpacity={0.8}
                >
                  {user?.photoURL ? (
                    <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.userName} numberOfLines={1}>
                  {user?.name || 'Valued User'}
                </Text>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user?.email || user?.phone || 'Account Verified'}
                </Text>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    {role === 'driver' ? '🚗 Driver Partner' : '👩 Passenger Account'}
                  </Text>
                </View>
              </View>

              {/* Menu Links */}
              <View style={styles.menuContainer}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate(role === 'driver' ? 'DriverProfile' : 'Profile')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>👤</Text>
                  <Text style={styles.menuText}>My Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate(role === 'driver' ? 'DriverRideHistory' : 'RideHistory')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>📋</Text>
                  <Text style={styles.menuText}>Trip History</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate('NotificationCenter')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>🔔</Text>
                  <Text style={styles.menuText}>Notifications</Text>
                </TouchableOpacity>

                {role === 'driver' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleNavigate('MonthlyPayment')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.menuIcon}>💳</Text>
                    <Text style={styles.menuText}>Monthly Platform Fee</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate(role === 'driver' ? 'DriverSettings' : 'Settings')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>⚙️</Text>
                  <Text style={styles.menuText}>Settings & Legal</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate('AboutUs')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>🚗</Text>
                  <Text style={styles.menuText}>About SheDrive</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate('UserAgreement')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>📄</Text>
                  <Text style={styles.menuText}>User Agreement</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate('TermsAndConditions')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>⚖️</Text>
                  <Text style={styles.menuText}>Terms & Conditions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleNavigate('PrivacyPolicy')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>🔒</Text>
                  <Text style={styles.menuText}>Privacy Policy</Text>
                </TouchableOpacity>

                {/* Official Website Link */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    Linking.openURL(CONTACT_INFO.websiteUrl).catch(() => {
                      Alert.alert('Unable to Open Link', 'Could not open official website.');
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>🌐</Text>
                  <Text style={[styles.menuText, { color: Colors.light.primary, fontWeight: '700' }]}>
                    Official Website
                  </Text>
                </TouchableOpacity>

                {/* In-App Feedback Button */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setFeedbackVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>💬</Text>
                  <Text style={[styles.menuText, { color: '#4A2060', fontWeight: '700' }]}>
                    Share App Feedback
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footerSection}>
                <Text style={styles.footerBrand}>SheDrive Pakistan</Text>
                <Text style={styles.footerSub}>Women-Only Ride Hailing • v1.0.0</Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>

        {/* In-App Feedback Modal */}
        <FeedbackModal
          visible={feedbackVisible}
          onClose={() => setFeedbackVisible(false)}
          user={user}
          authToken={state?.token}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  drawerContent: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: Colors.light.surface,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerSection: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: Colors.light.primaryGhost,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 10,
    fontWeight: '500',
  },
  roleBadge: {
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.light.primary,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.divider,
    marginVertical: 10,
    marginHorizontal: 10,
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.light.errorLight,
    marginTop: 4,
  },
  logoutIcon: {
    fontSize: 18,
    marginRight: 14,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.light.error,
  },
  footerSection: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.light.divider,
    backgroundColor: Colors.light.background,
  },
  footerBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.light.primary,
  },
  footerSub: {
    fontSize: 11,
    color: Colors.light.textTertiary,
    marginTop: 2,
  },
});
