import { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [dotAnims] = useState(() => [new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]);

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
      <Text style={styles.tagline}>{t('splash_tagline')}</Text>
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
      width: 18,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: theme.gold,
    },
    tagline: {
      marginTop: 24,
      fontFamily: FontFamily.display,
      fontSize: 13,
      letterSpacing: 2,
      color: theme.goldDark,
      textTransform: 'uppercase',
    },
  });
