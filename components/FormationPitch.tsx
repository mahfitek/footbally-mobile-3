// Diziliş sahası. Takım kadrosu (TeamSquadScreen) ve maç ilanı (CreateMatchScreen) bu bileşeni kullanır.
// Slot konumları ve rolleri lib/formations.ts'ten gelir; bu dosya yalnızca çizer.
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Paper, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { roleLabel, type FormationSlot } from '../lib/formations';

export const PITCH_WIDTH = 320;
export const PITCH_HEIGHT = 420;

/** Dolu bir koltuk: ekranda gösterilecek kısa ad ve forma numarası. Boş koltuk null. */
export type PitchSeat = { label: string; number?: number | null } | null;

type Props = {
  slots: FormationSlot[];
  seats: PitchSeat[];
  lang: 'tr' | 'en';
  onSeatPress?: (index: number) => void;
};

export default function FormationPitch({ slots, seats, lang, onSeatPress }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme.gold);

  return (
    <View style={styles.pitch}>
      <View style={styles.centerCircle} />
      <View style={styles.centerLine} />
      <View style={styles.centerDot} />
      <View style={[styles.goalArea, { top: 0, borderTopWidth: 0 }]} />
      <View style={[styles.goalArea, { bottom: 0, borderBottomWidth: 0 }]} />
      <View style={[styles.penaltyArea, { top: 0, borderTopWidth: 0 }]} />
      <View style={[styles.penaltyArea, { bottom: 0, borderBottomWidth: 0 }]} />

      {slots.map((slot, index) => {
        const seat = seats[index] ?? null;
        const x = (slot.x / 100) * PITCH_WIDTH;
        const y = (slot.y / 100) * PITCH_HEIGHT;
        return (
          <TouchableOpacity
            key={slot.key}
            disabled={!onSeatPress}
            onPress={() => onSeatPress?.(index)}
            style={{ position: 'absolute', left: x - 24, top: y - 32, alignItems: 'center', width: 48 }}
          >
            <View style={[styles.dot, seat ? styles.dotFilled : styles.dotEmpty]}>
              {seat ? (
                <Text style={styles.dotNumber}>{seat.number ?? index + 1}</Text>
              ) : (
                <Text style={styles.dotPlus}>+</Text>
              )}
            </View>
            <View style={styles.nameTag}>
              <Text style={styles.nameText} numberOfLines={1}>
                {seat ? seat.label : roleLabel(slot.role, lang)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (gold: string) =>
  StyleSheet.create({
    pitch: {
      width: PITCH_WIDTH,
      height: PITCH_HEIGHT,
      backgroundColor: '#2d5a1b',
      borderRadius: CARD_RADIUS,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
      alignSelf: 'center',
      position: 'relative',
      overflow: 'hidden',
      marginBottom: 28,
    },
    centerCircle: {
      position: 'absolute',
      top: PITCH_HEIGHT / 2 - 40,
      left: PITCH_WIDTH / 2 - 40,
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    centerLine: {
      position: 'absolute',
      top: PITCH_HEIGHT / 2 - 1,
      left: 0,
      right: 0,
      height: 1.5,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    centerDot: {
      position: 'absolute',
      top: PITCH_HEIGHT / 2 - 3,
      left: PITCH_WIDTH / 2 - 3,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255,255,255,0.5)',
    },
    goalArea: {
      position: 'absolute',
      left: PITCH_WIDTH * 0.3,
      width: PITCH_WIDTH * 0.4,
      height: PITCH_HEIGHT * 0.12,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    penaltyArea: {
      position: 'absolute',
      left: PITCH_WIDTH * 0.15,
      width: PITCH_WIDTH * 0.7,
      height: PITCH_HEIGHT * 0.2,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    dot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotFilled: { backgroundColor: gold, borderColor: '#fff' },
    dotEmpty: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.4)' },
    dotNumber: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: Paper.ink },
    dotPlus: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
    nameTag: {
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      marginTop: 2,
    },
    nameText: { fontFamily: FontFamily.bodySemiBold, color: '#fff', fontSize: 10, textAlign: 'center' },
  });
