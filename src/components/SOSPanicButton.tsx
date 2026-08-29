import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import Colors from '../constants/Colors';
import sosService, { EmergencyContact, SOSLocation } from '../services/sosService';

interface SOSPanicButtonProps {
  contacts: EmergencyContact[];
  location: SOSLocation;
  onSOSTriggered?: () => void;
  customMessage?: string;
  size?: 'small' | 'medium' | 'large';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export default function SOSPanicButton({
  contacts,
  location,
  onSOSTriggered,
  customMessage,
  size = 'large',
  position = 'bottom-right',
}: SOSPanicButtonProps): React.JSX.Element {
  return (
    <View style={[styles.container, positionStyles]}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
          },
          isPressed && styles.buttonPressed,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.85}
      >
        <View style={styles.buttonContent}>
          <Text style={[styles.icon, { fontSize: iconSize }]}>🆘</Text>
          <Text style={[styles.label, { fontSize: textSize }]}>SOS</Text>
        </View>
      </TouchableOpacity>
      
      {pressCount > 0 && (
        <View style={styles.pressIndicator}>
          <Text style={styles.pressCount}>{3 - pressCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 1000,
  },
  button: {
    backgroundColor: Colors.light.emergency,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  buttonPressed: {
    backgroundColor: Colors.light.emergencyBackground,
    transform: [{ scale: 0.95 }],
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: Colors.light.emergency,
    opacity: 0.3,
    borderRadius: 9999,
  },
  buttonContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    lineHeight: 40,
  },
  label: {
    color: '#fff',
    fontWeight: '800',
    marginTop: -4,
  },
  pressIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.emergency,
  },
  pressCount: {
    color: Colors.light.emergency,
    fontWeight: '800',
    fontSize: 12,
  },
});
