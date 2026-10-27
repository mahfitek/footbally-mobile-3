import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from './HapticTouchable';

// solid  = dolu yeşil rozet (ör. başvurulmuş)
// soft   = açık yeşil rozet (ör. yaklaşan, açık)
// muted  = gri rozet (ör. geçmiş)
// danger = kırmızı rozet (ör. iptal, acil)
export type MatchStatusTone = 'solid' | 'soft' | 'muted' | 'danger';

interface Props {
  title: string;
  date: string;
  time: string;
  location: string;
  typeLabel: string;
  categoryLabel: string;
  participantsText: string;
  status: { label: string; tone: MatchStatusTone };
  urgentLabel?: string;
  resultLabel?: string;
  onPress: () => void;
  onResultPress?: () => void;
}

// Maç listesi kartı. Yalnızca sunum yapar: veri, filtreleme ve navigasyon çağıran ekranda kalır.
export default function MatchCard({
  title,
  date,
  time,
  location,
  typeLabel,
  categoryLabel,
  participantsText,
  status,
  urgentLabel,
  resultLabel,
  onPress,
  onResultPress,
}: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const statusStyle = STATUS_TONE(theme)[status.tone];

  return (
    <HapticTouchable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="football-outline" size={20} color={theme.goldDark} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {date} · {time}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={theme.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.fg }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.tag}>{typeLabel}</Text>
        <Text style={styles.tag}>{categoryLabel}</Text>
        <View style={styles.participants}>
          <Ionicons name="people-outline" size={14} color={theme.textMuted} />
          <Text style={styles.participantsText}>{participantsText}</Text>
        </View>
        {urgentLabel ? (
          <View style={styles.urgent}>
            <Ionicons name="flame" size={12} color={DANGER_TEXT} />
            <Text style={styles.urgentText}>{urgentLabel}</Text>
          </View>
        ) : null}
      </View>

      {resultLabel && onResultPress ? (
        <HapticTouchable style={styles.resultBtn} onPress={onResultPress}>
          <Text style={styles.resultText}>{resultLabel}</Text>
        </HapticTouchable>
      ) : null}
    </HapticTouchable>
  );
}

// Açık kırmızı zemin üzerinde küçük metin için koyu kırmızı (4.5:1 üzerinde).
const DANGER_TEXT = '#B42318';

// Rozet renkleri: metin her zaman en az 4.5:1 kontrastlı kalacak şekilde seçildi.
const STATUS_TONE = (theme: Theme): Record<MatchStatusTone, { bg: string; fg: string }> => ({
  solid: { bg: theme.goldDark, fg: '#FFFFFF' },
  soft: { bg: hexToRgba(theme.goldDark, 0.1), fg: theme.goldDark },
  muted: { bg: theme.card2, fg: theme.textMuted },
  danger: { bg: hexToRgba(theme.error, 0.1), fg: DANGER_TEXT },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 14,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: hexToRgba(theme.goldDark, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: { flex: 1, gap: 4 },
    title: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text, lineHeight: 20 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    meta: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted },
    statusPill: {
      borderRadius: PILL_RADIUS,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11 },
    footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    tag: {
      fontFamily: FontFamily.bodySemiBold,
      fontSize: 12,
      color: theme.text,
      backgroundColor: theme.card2,
      borderRadius: PILL_RADIUS,
      paddingHorizontal: 10,
      paddingVertical: 4,
      overflow: 'hidden',
    },
    participants: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
    participantsText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.textMuted },
    urgent: {
      flexBasis: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: hexToRgba(theme.error, 0.1),
      borderRadius: PILL_RADIUS,
      paddingHorizontal: 10,
      paddingVertical: 5,
      alignSelf: 'flex-start',
    },
    urgentText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: DANGER_TEXT },
    resultBtn: {
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.goldDark },
  });
