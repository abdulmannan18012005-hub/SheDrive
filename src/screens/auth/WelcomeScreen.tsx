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
        {/* App Logo Emblem */}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🚗</Text>
          <Text style={styles.logoText}>SheDrive</Text>
          <Text style={styles.tagline}>Safe, Empowering, and Dedicated Rides for Women</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>Lahore, Pakistan</Text>
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
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.light.primary,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  primaryButton: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: Colors.light.textOnPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: Colors.light.surface,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.primary,
  },
  secondaryButtonText: {
    color: Colors.light.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 14,
    color: Colors.light.textTertiary,
    fontWeight: '500',
  },
});
