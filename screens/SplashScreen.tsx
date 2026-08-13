import { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const dotAnims = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;

  useEffect(() => {
    const loops = dotAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(anim, {
            toValue: 1,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 450,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());

    const timer = setTimeout(onDone, 2500);

    return () => {
      loops.forEach((loop) => loop.stop());
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={{ backgroundColor: 'transparent' }}>
        <Image
          source={require('../assets/logo-text.png')}
          style={{ width: 280, height: 80, resizeMode: 'contain', marginBottom: 28, backgroundColor: 'transparent' }}
        />
      </View>
      <View style={styles.dots}>
        {dotAnims.map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
      <Text style={styles.tagline}>Kariyerini Başlat</Text>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: 10,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: theme.gold,
    },
    tagline: {
      marginTop: 24,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 2,
      color: theme.gold,
      textTransform: 'uppercase',
    },
  });
