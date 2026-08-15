import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../constants/Colors';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps): React.JSX.Element {
  const calculateStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) {
      return { score: 0, label: '', color: Colors.light.border };
    }

    let score = 0;

    // Length check
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;

    // Complexity checks
    if (/[a-z]/.test(pwd)) score += 1; // lowercase
    if (/[A-Z]/.test(pwd)) score += 1; // uppercase
    if (/[0-9]/.test(pwd)) score += 1; // number
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1; // special character

    // Normalize score to 0-4
    const normalizedScore = Math.min(Math.floor(score / 1.5), 4);

    switch (normalizedScore) {
      case 0:
        return { score: 0, label: 'Very Weak', color: Colors.light.error };
      case 1:
        return { score: 1, label: 'Weak', color: Colors.light.error };
      case 2:
        return { score: 2, label: 'Fair', color: Colors.light.warning };
      case 3:
        return { score: 3, label: 'Good', color: Colors.light.success };
      case 4:
        return { score: 4, label: 'Strong', color: Colors.light.primaryDark };
      default:
        return { score: 0, label: '', color: Colors.light.border };
    }
  };

  const { score, label, color } = calculateStrength(password);

  if (!password) {
    return <View />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.strengthBar}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.barSegment,
              index < score && { backgroundColor: color },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color }]}>
        Password Strength: {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  barSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.light.border,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
