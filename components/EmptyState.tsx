import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import GoldButton from './GoldButton';
import HapticTouchable from './HapticTouchable';

type IoniconName = keyof typeof Ionicons.glyphMap;

// 'primary' = dolu altın buton (en güçlü aksiyon), 'outline' = altın anahat,
// 'accent' = ikincil anahat (dikkat çekici ama primary'yi gölgelemeyen bir vurgu).
type EmptyStateAction = { label: string; onPress: () => void; variant?: 'primary' | 'outline' | 'accent' };

interface Props {
  icon: IoniconName;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Birden fazla, önceliklendirilmiş buton göstermek için (actionLabel/onAction yerine). */
  actions?: EmptyStateAction[];
}

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction, actions }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const resolvedActions = actions ?? (actionLabel && onAction ? [{ label: actionLabel, onPress: onAction, variant: 'primary' as const }] : []);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={theme.gold} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {resolvedActions.length > 0 && (
        <View style={styles.actions}>
          {resolvedActions.map((a, i) => {
            const variant = a.variant ?? (i === 0 ? 'primary' : 'outline');
            return variant === 'primary' ? (
              <GoldButton key={a.label} title={a.label} onPress={a.onPress} style={styles.actionBtn} />
            ) : (
              <HapticTouchable
                key={a.label}
                onPress={a.onPress}
                style={[styles.outlineBtn, variant === 'accent' && styles.accentBtn]}
              >
                <Text style={[styles.outlineBtnText, variant === 'accent' && styles.accentBtnText]}>{a.label}</Text>
              </HapticTouchable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: CARD_RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: { fontFamily: FontFamily.bodySemiBold, fontSize: 18, color: theme.text, marginBottom: 6, textAlign: 'center' },
    subtitle: { fontFamily: FontFamily.body, fontSize: 14, color: theme.textSecondary, textAlign: 'center', lineHeight: 20 },
    action: { width: 200, height: 48, marginTop: 20 },
    actions: { width: '100%', maxWidth: 280, marginTop: 20, gap: 10 },
    actionBtn: { width: '100%' },
    outlineBtn: {
      width: '100%',
      height: 48,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.goldDark },
    accentBtn: { borderColor: theme.purple },
    accentBtnText: { color: theme.goldDark },
  });
