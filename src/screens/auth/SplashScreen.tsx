import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps): React.JSX.Element {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    if (onFinish) {
      const timer = setTimeout(() => {
        onFinish();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [fadeAnim, scaleAnim, onFinish]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A2060" />

      {/* Main Center Content */}
      <Animated.View
        style={[
          styles.centerContent,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Soft Rose Circular Emblem with Safety Shield */}
        <View style={styles.emblemCircle}>
          <View style={styles.shieldIconContainer}>
            {/* Clean Shield Outline & Checkmark */}
            <Text style={styles.shieldIcon}>🛡️</Text>
          </View>
        </View>

        {/* Brand Name */}
        <Text style={styles.brandTitle}>SheDrive</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Safe rides, by women, for women</Text>
      </Animated.View>

      {/* Bottom Footer Pill */}
      <Animated.View style={[styles.footerContainer, { opacity: fadeAnim }]}>
        <View style={styles.communityPill}>
          <Text style={styles.pillIcon}>🛡️</Text>
          <Text style={styles.pillText}>100% Verified Female Community</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A2060', // Deep elegant royal plum / purple
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emblemCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#E6B0BE', // Soft rose / blush pink
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  shieldIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldIcon: {
    fontSize: 42,
  },
  brandTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: '#E6B0BE', // Rose-tinted typography
    letterSpacing: -0.5,
    marginBottom: 10,
    fontFamily: 'System',
  },
  tagline: {
    fontSize: 16,
    color: '#F5EFF7', // Soft white/cream
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  footerContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  communityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(230, 176, 190, 0.35)',
    gap: 8,
    maxWidth: width * 0.88,
  },
  pillIcon: {
    fontSize: 14,
  },
  pillText: {
    color: '#F5EFF7',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
