import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
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
    <View style={styles.card}>
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
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
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
    name: { fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 2 },
    meta: { fontSize: 12, color: theme.textSecondary, marginBottom: 10 },
    contactBtn: {
      alignSelf: 'flex-start',
      backgroundColor: hexToRgba(theme.gold, 0.12),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    contactBtnText: { fontSize: 12, fontWeight: '700', color: theme.gold },
    score: { fontSize: 22, fontWeight: '800', color: theme.gold },
  });
