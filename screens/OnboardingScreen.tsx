import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import HapticTouchable from '../components/HapticTouchable';

const slides = [
  {
    id: 1,
    title: 'Kendini',
    titleGold: 'Geliştir',
    desc: 'AI destekli analizler ve kişisel antrenman programlarıyla her gün bir adım daha ilerle.',
    emoji: '⚡',
    kind: 'phone' as const,
  },
  {
    id: 2,
    title: 'Fırsatları',
    titleGold: 'Yakala',
    desc: 'Profesyonel kulüplerden, akademilerden ve scoutlardan gelen davetleri kaçırma.',
    emoji: '🎯',
    kind: 'clubs' as const,
  },
  {
    id: 3,
    title: 'Zafere',
    titleGold: 'Ulaş',
    desc: 'Kariyer hedeflerine ulaş, süperliğe tırman ve hayalini yaşa.',
    emoji: '🏆',
    kind: 'success' as const,
  },
];

const PHONE_STATS = ['AI Analiz', 'Performans Takibi', 'Skor Sistemi'];
const CLUBS = ['GS', 'FB', 'BJK', 'TS'];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [current, setCurrent] = useState(0);

  const next = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      onDone();
    }
  };

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <View style={styles.container}>
      <View style={{ backgroundColor: 'transparent' }}>
        <Image
          source={require('../assets/logo-text.png')}
          style={{ width: 240, height: 65, resizeMode: 'contain', backgroundColor: 'transparent' }}
        />
      </View>

      <View style={styles.slideWrap}>
        {slide.kind === 'phone' && (
          <View style={styles.phoneMock}>
            <View style={styles.phoneNotch} />
            <View style={styles.phoneAvatar}>
              <Text style={{ fontSize: 28 }}>⚽</Text>
            </View>
            <View style={styles.phoneNameBar} />
            <View style={styles.phoneStatsRow}>
              {PHONE_STATS.map((s) => (
                <View key={s} style={styles.phoneStatChip}>
                  <Text style={styles.phoneStatText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {slide.kind === 'clubs' && (
          <View style={styles.clubsWrap}>
            <View style={styles.clubsRow}>
              {CLUBS.map((c) => (
                <View key={c} style={styles.clubBadge}>
                  <Text style={styles.clubBadgeText}>{c}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.clubsCaption}>180+ Scout · 50+ Kulüp · Türkiye geneli</Text>
          </View>
        )}

        {slide.kind === 'success' && (
          <View style={styles.successWrap}>
            <Text style={styles.icon}>{slide.emoji}</Text>
            <View style={styles.successStatCard}>
              <Text style={styles.successStatValue}>847</Text>
              <Text style={styles.successStatLabel}>
                oyuncu son 3 ayda kulüplerle görüştü
              </Text>
            </View>
          </View>
        )}

        {slide.kind !== 'success' && (
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{slide.emoji}</Text>
          </View>
        )}

        <Text style={styles.title}>
          {slide.title}{' '}
          <Text style={styles.titleGold}>{slide.titleGold}</Text>
        </Text>

        <Text style={styles.desc}>{slide.desc}</Text>
      </View>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <HapticTouchable key={i} onPress={() => setCurrent(i)}>
            <View style={[styles.dot, i === current && styles.dotActive]} />
          </HapticTouchable>
        ))}
      </View>

      <HapticTouchable style={styles.btn} onPress={next}>
        <Text style={styles.btnText}>
          {isLast ? 'Başla' : 'Devam Et'}
        </Text>
      </HapticTouchable>

      {isLast && (
        <HapticTouchable style={styles.loginLink} onPress={onDone}>
          <Text style={styles.loginLinkText}>Zaten hesabım var</Text>
        </HapticTouchable>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 70,
      paddingBottom: 50,
      paddingHorizontal: 32,
    },
    slideWrap: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    iconWrap: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 40,
      backgroundColor: hexToRgba(theme.gold, 0.05),
    },
    icon: {
      fontSize: 52,
    },
    title: {
      fontSize: 36,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    titleGold: {
      color: theme.gold,
    },
    desc: {
      fontSize: 15,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 280,
    },
    dots: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 32,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.border,
    },
    dotActive: {
      width: 28,
      backgroundColor: theme.gold,
    },
    btn: {
      width: '100%',
      height: 56,
      backgroundColor: theme.gold,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#000',
      letterSpacing: 1,
    },
    loginLink: { marginTop: 16, padding: 8 },
    loginLinkText: { fontSize: 14, fontWeight: '600', color: theme.gold },

    // Slide 1 - phone mock
    phoneMock: {
      width: 180,
      height: 260,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      paddingTop: 20,
      paddingHorizontal: 14,
      marginBottom: 32,
    },
    phoneNotch: {
      width: 50,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginBottom: 18,
    },
    phoneAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.card2,
      borderWidth: 2,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    phoneNameBar: {
      width: 90,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.border,
      marginBottom: 18,
    },
    phoneStatsRow: { gap: 8, width: '100%' },
    phoneStatChip: {
      backgroundColor: hexToRgba(theme.gold, 0.1),
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: 'center',
    },
    phoneStatText: { fontSize: 11, fontWeight: '700', color: theme.gold },

    // Slide 2 - clubs
    clubsWrap: { alignItems: 'center', marginBottom: 32 },
    clubsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    clubBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.card,
      borderWidth: 1.5,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clubBadgeText: { fontSize: 14, fontWeight: '900', color: theme.gold },
    clubsCaption: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.5 },

    // Slide 3 - success story
    successWrap: { alignItems: 'center', marginBottom: 8 },
    successStatCard: {
      marginTop: 24,
      backgroundColor: hexToRgba(theme.gold, 0.08),
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.25),
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 28,
      alignItems: 'center',
    },
    successStatValue: { fontSize: 40, fontWeight: '900', color: theme.gold },
    successStatLabel: {
      fontSize: 12,
      color: theme.textMuted,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 4,
      maxWidth: 180,
    },
  });
