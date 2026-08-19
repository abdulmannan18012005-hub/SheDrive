import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import Colors from '../../constants/Colors';

type WelcomeScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Welcome'>;

interface Props {
  navigation: WelcomeScreenNavigationProp;
}

export default function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Decorative Top Ambient Glow */}
        <View style={styles.ambientGlow} />

        {/* App Logo Emblem & Hero Header */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🚗</Text>
          </View>
          <Text style={styles.logoText}>SheDrive</Text>
          <Text style={styles.tagline}>Safe rides, by women, for women</Text>

          {/* Value Proposition Pills */}
          <View style={styles.featurePillsContainer}>
            <View style={styles.featurePill}>
              <Text style={styles.featurePillIcon}>🔒</Text>
              <Text style={styles.featurePillText}>Verified Female Drivers Only</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featurePillIcon}>🛡️</Text>
              <Text style={styles.featurePillText}>24/7 SOS & Real-time Location Share</Text>
            </View>
            <View style={styles.featurePill}>
              <Text style={styles.featurePillIcon}>🎀</Text>
              <Text style={styles.featurePillText}>Comfort & Transparent Bidding</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trustBadge}>
          <Text style={styles.trustBadgeIcon}>🛡️</Text>
          <Text style={styles.trustBadgeText}>100% Verified Female Community</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 40,
  },
  ambientGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.light.primaryGhost,
    opacity: 0.8,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  logoBadge: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: Colors.light.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.glassBorder,
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 52,
  },
  logoText: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  featurePillsContainer: {
    marginTop: 36,
    width: '100%',
    gap: 10,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  featurePillIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  featurePillText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  buttonContainer: {
    width: '100%',
    gap: 14,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    backgroundColor: Colors.light.surface,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  secondaryButtonText: {
    color: Colors.light.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(233, 30, 99, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.18)',
    marginBottom: 10,
  },
  trustBadgeIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  trustBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.primary,
  },
});
