import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

interface Props {
  name: string;
  value: number;
}

export default function StatBar({ name, value }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: value,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.item}>
      <View style={styles.top}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    item: { marginTop: 16 },
    top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    name: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted },
    value: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.text },
    track: { height: 4, backgroundColor: theme.border, borderRadius: 2, overflow: 'hidden' },
    fill: {
      height: 4,
      backgroundColor: theme.gold,
      borderRadius: 2,
      shadowColor: theme.gold,
      shadowOpacity: 0.6,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 0 },
    },
  });
