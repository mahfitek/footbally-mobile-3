import { Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';
import HapticTouchable from './HapticTouchable';

interface Props {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  outline?: boolean;
}

export default function GoldButton({ title, onPress, style, outline = false }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <HapticTouchable
      style={[styles.btn, outline ? styles.btnOutline : styles.btnFilled, style]}
      onPress={onPress}
    >
      <Text style={[styles.text, outline ? styles.textOutline : styles.textFilled]}>
        {title}
      </Text>
    </HapticTouchable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    btn: {
      width: '100%',
      height: 56,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnFilled: {
      backgroundColor: theme.gold,
    },
    btnOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: theme.gold,
    },
    text: {
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 1,
    },
    textFilled: {
      color: '#000',
    },
    textOutline: {
      color: theme.gold,
    },
  });
