import { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import FadeInView from './FadeInView';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
  onHide: () => void;
}

export default function Toast({ message, type = 'info', visible, onHide }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onHide, 3000);
    return () => clearTimeout(timer);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <FadeInView style={[styles.container, styles[type]]} translateY={16} duration={250}>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </FadeInView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 50,
      left: 20,
      right: 20,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: CARD_RADIUS,
      paddingVertical: 14,
      paddingHorizontal: 18,
      zIndex: 999,
      elevation: 10,
    },
    success: { borderColor: theme.success },
    error: { borderColor: theme.error },
    info: { borderColor: theme.gold },
    text: {
      fontFamily: FontFamily.monoMedium,
      color: theme.text,
      fontSize: 13,
      textAlign: 'center',
    },
  });
