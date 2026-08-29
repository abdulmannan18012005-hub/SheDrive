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
  const [isPressed, setIsPressed] = useState(false);
  const [pressCount, setPressCount] = useState(0);
  const pressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handlePress = () => {
    setIsPressed(true);
    setPressCount(prev => prev + 1);

    // Reset press count after 2 seconds
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }

    pressTimerRef.current = setTimeout(() => {
      setPressCount(0);
      setIsPressed(false);
    }, 2000);

    // Require 3 quick presses to trigger SOS (prevent accidental triggers)
    if (pressCount >= 2) {
      triggerSOS();
      setPressCount(0);
      setIsPressed(false);
    }
  };

  const handleLongPress = () => {
    // Long press also triggers SOS immediately
    triggerSOS();
  };

  const triggerSOS = () => {
    sosService.showSOSConfirmation(contacts, location, async () => {
      const result = await sosService.triggerSOS(contacts, location, customMessage);
      
      if (result.smsSent || result.callInitiated) {
        Alert.alert(
          'SOS Activated',
          'Emergency SMS sent and emergency hotline called. Stay safe!',
          [{ text: 'OK', style: 'default' }]
        );
        onSOSTriggered?.();
      }
    });
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { buttonSize: 56, iconSize: 24, textSize: 10 };
      case 'medium':
        return { buttonSize: 64, iconSize: 28, textSize: 11 };
      case 'large':
      default:
        return { buttonSize: 80, iconSize: 36, textSize: 13 };
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'bottom-right':
        return { bottom: 20, right: 20 };
      case 'bottom-left':
        return { bottom: 20, left: 20 };
      case 'top-right':
        return { top: 20, right: 20 };
      case 'top-left':
        return { top: 20, left: 20 };
    }
  };

  const { buttonSize, iconSize, textSize } = getSizeStyles();
  const positionStyles = getPositionStyles();

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
