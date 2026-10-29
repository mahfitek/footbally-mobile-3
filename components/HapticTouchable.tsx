import { useState } from 'react';
import { Animated, GestureResponderEvent, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function HapticTouchable({
  style,
  activeOpacity,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: TouchableOpacityProps) {
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = (e: GestureResponderEvent) => {
    Animated.timing(scale, { toValue: 0.98, duration: 80, useNativeDriver: true }).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e: GestureResponderEvent) => {
    Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    onPressOut?.(e);
  };

  const handlePress = (e: GestureResponderEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity ?? 0.7}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    />
  );
}
