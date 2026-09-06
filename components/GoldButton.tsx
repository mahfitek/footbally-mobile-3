import { Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme, PILL_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
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
      height: 52,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnFilled: {
      backgroundColor: theme.gold,
    },
    btnOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
    },
    text: {
      fontFamily: FontFamily.display,
      fontSize: 15,
      letterSpacing: 1,
    },
    textFilled: {
      color: Paper.ink,
    },
    textOutline: {
      color: theme.gold,
    },
  });
