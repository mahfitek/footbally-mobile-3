import { useEffect, useState } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { CARD_RADIUS } from '../constants/theme';

interface Props {
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export default function SkeletonCard({ height = 80, style }: Props) {
  const { theme } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius: CARD_RADIUS,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          opacity,
        },
        style,
      ]}
    />
  );
}
