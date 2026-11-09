import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from './HapticTouchable';

interface Props {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Yatay kenar boşluğu; varsayılan ekranlardaki 24 px gutter ile aynıdır. */
  horizontalPadding?: number;
}

// Bölüm başlığı: küçük ama güçlü yazı, sağda isteğe bağlı "Tümü" bağlantısı.
export default function SectionHeader({ title, actionLabel, onAction, horizontalPadding = 24 }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.row, { paddingHorizontal: horizontalPadding }]}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction && (
        <HapticTouchable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </HapticTouchable>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 12,
    },
    title: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: theme.text, letterSpacing: 0.2 },
    // Metin olarak kullanılan yeşil, beyaz zeminde 4.5:1'i geçsin diye goldDark tonunda.
    action: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.goldDark },
  });
