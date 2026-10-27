import { View, Text, StyleSheet } from 'react-native';
import FadeInView from './FadeInView';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme, CARD_RADIUS, SOFT_SHADOW } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from './HapticTouchable';

interface Props {
  emoji: string;
  name: string;
  position: string;
  age: number;
  city: string;
  score: number;
  onContact: () => void;
}

export default function PlayerCard({ emoji, name, position, age, city, score, onContact }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <FadeInView style={styles.card} translateY={12} duration={240}>
      <View style={styles.avatar}>
        <Text style={styles.avatarEmoji}>{emoji}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.meta}>
          {position} · {age} yaş · {city}
        </Text>
        <HapticTouchable style={styles.contactBtn} onPress={onContact}>
          <Text style={styles.contactBtnText}>İletişim Kur</Text>
        </HapticTouchable>
      </View>
      <Text style={styles.score}>{score}</Text>
    </FadeInView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...SOFT_SHADOW,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatarEmoji: { fontSize: 24 },
    info: { flex: 1 },
    name: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, marginBottom: 2 },
    meta: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textSecondary, marginBottom: 10 },
    contactBtn: {
      alignSelf: 'flex-start',
      backgroundColor: hexToRgba(theme.goldDark, 0.1),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    contactBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.goldDark },
    score: { fontFamily: FontFamily.monoMedium, fontSize: 22, color: theme.goldDark },
  });
