import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Props {
  label: string;
  value: string | number;
  icon?: IoniconName;
  /** Opsiyonel alt not (ör. "son 30 gün"). */
  hint?: string;
}

// Tek bir istatistiği gösteren sakin bilgi kartı. Değer büyük, etiket küçük ve muted.
export default function StatCard({ label, value, icon, hint }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {icon && (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={16} color={theme.goldDark} />
          </View>
        )}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexGrow: 1,
      flexBasis: '45%',
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: hexToRgba(theme.goldDark, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted },
    value: { fontFamily: FontFamily.bodySemiBold, fontSize: 22, color: theme.text },
    hint: { fontFamily: FontFamily.body, fontSize: 11, color: theme.textMuted },
  });
