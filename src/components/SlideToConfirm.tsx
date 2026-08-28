import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, Dimensions } from 'react-native';
import Colors from '../constants/Colors';

interface Props {
  text: string;
  onConfirm: () => void;
  color?: string;
  disabled?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 48;
const THUMB_SIZE = 52;
const MAX_SLIDE = SLIDER_WIDTH - THUMB_SIZE - 8;

export default function SlideToConfirm({
  text = 'Slide to Confirm Ride',
  onConfirm,
  color = Colors.light.primary,
  disabled = false,
}: Props): React.JSX.Element {
  const pan = useRef(new Animated.Value(0)).current;
  const [confirmed, setConfirmed] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !confirmed,
      onMoveShouldSetPanResponder: () => !disabled && !confirmed,
      onPanResponderMove: (_, gestureState) => {
        if (disabled || confirmed) return;
        const newX = Math.max(0, Math.min(gestureState.dx, MAX_SLIDE));
        pan.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (disabled || confirmed) return;
        if (gestureState.dx >= MAX_SLIDE * 0.75) {
          Animated.timing(pan, {
            toValue: MAX_SLIDE,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            setConfirmed(true);
            onConfirm();
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            tension: 40,
            friction: 7,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const textOpacity = pan.interpolate({
    inputRange: [0, MAX_SLIDE / 2],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, disabled && styles.disabledContainer]}>
      <Animated.Text style={[styles.text, { opacity: textOpacity }]}>
        {confirmed ? 'Confirmed! ✓' : text}
      </Animated.Text>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.thumb,
          { backgroundColor: color },
          { transform: [{ translateX: pan }] },
        ]}
      >
        <Text style={styles.thumbArrow}>{confirmed ? '✓' : '➔'}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SLIDER_WIDTH,
    height: 60,
    backgroundColor: '#F0FDFA',
    borderRadius: 30,
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  disabledContainer: {
    opacity: 0.5,
  },
  text: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.primary,
    letterSpacing: 0.5,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  thumbArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
});
