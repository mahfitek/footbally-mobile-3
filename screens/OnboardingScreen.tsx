import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;

const slides = [
  {
    id: 1,
    code: '01/03',
    title: 'Kendini',
    titleGold: 'Geliştir',
    desc: 'AI destekli analizler ve kişisel antrenman programlarıyla her gün bir adım daha ilerle.',
    kind: 'phone' as const,
  },
  {
    id: 2,
    code: '02/03',
    title: 'Fırsatları',
    titleGold: 'Yakala',
    desc: 'Profesyonel kulüplerden, akademilerden ve scoutlardan gelen davetleri kaçırma.',
    kind: 'clubs' as const,
  },
  {
    id: 3,
    code: '03/03',
    title: 'Zafere',
    titleGold: 'Ulaş',
    desc: 'Kariyer hedeflerine ulaş, süperliğe tırman ve hayalini yaşa.',
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
  const todayLabel = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.topStrip}>
        <Text style={styles.topStripText}>FOOTBALLY</Text>
        <Text style={styles.topStripText}>{slide.code} · {todayLabel}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          {slide.kind === 'phone' && (
            <View style={styles.phoneMock}>
              <View style={styles.crestRow}>
                <Image
                  source={require('../assets/logo-icon-square.png')}
                  style={styles.crest}
                />
                <Text style={styles.cardBrand}>FOOTBALLY</Text>
              </View>
              <Text style={styles.cardLabel}>OYUNCU DOSYASI · ÖZET</Text>
              {PHONE_STATS.map((s) => (
                <View key={s} style={styles.dataRow}>
                  <Text style={styles.dataRowText}>{s}</Text>
                </View>
              ))}
            </View>
          )}

          {slide.kind === 'clubs' && (
            <View style={styles.phoneMock}>
              <Text style={styles.cardLabel}>KAYITLI KULÜPLER</Text>
              <View style={styles.clubsRow}>
                {CLUBS.map((c) => (
                  <View key={c} style={styles.clubBadge}>
                    <Text style={styles.clubBadgeText}>{c}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.clubsCaptionRow}>
                <Text style={styles.clubsCaption}>180+ Scout · 50+ Kulüp · Türkiye geneli</Text>
              </View>
            </View>
          )}

          {slide.kind === 'success' && (
            <View style={styles.phoneMock}>
              <Text style={styles.cardLabel}>SAHA İSTATİSTİĞİ</Text>
              <Text style={styles.successStatValue}>847</Text>
              <Text style={styles.successStatLabel}>oyuncu son 3 ayda kulüplerle görüştü</Text>
            </View>
          )}
        </View>

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
      paddingBottom: 40,
      paddingHorizontal: 24,
    },
    topStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 24,
    },
    topStripText: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 1,
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      width: '100%',
      backgroundColor: Paper.bg,
      borderRadius: RADIUS,
      padding: 22,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: theme.border,
    },
    phoneMock: {
      width: '100%',
    },
    crestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    crest: {
      width: 30,
      height: 30,
      borderRadius: RADIUS,
      resizeMode: 'contain',
    },
    cardBrand: {
      fontFamily: FontFamily.display,
      fontSize: 18,
      letterSpacing: 2,
      color: Paper.ink,
    },
    cardLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      letterSpacing: 1,
      color: Paper.muted,
      paddingBottom: 12,
      marginBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: Paper.line,
    },
    dataRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Paper.line,
    },
    dataRowText: {
      fontFamily: FontFamily.monoMedium,
      fontSize: 13,
      color: Paper.ink,
    },
    clubsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    clubBadge: {
      flex: 1,
      height: 44,
      borderRadius: RADIUS,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: Paper.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clubBadgeText: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: Paper.ink },
    clubsCaptionRow: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: Paper.line,
    },
    clubsCaption: { fontFamily: FontFamily.mono, fontSize: 11, color: Paper.muted, letterSpacing: 0.5 },
    successStatValue: { fontFamily: FontFamily.display, fontSize: 44, color: theme.gold, letterSpacing: 1 },
    successStatLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: Paper.muted,
      marginTop: 4,
    },
    title: {
      fontFamily: FontFamily.display,
      fontSize: 34,
      color: theme.text,
      textAlign: 'center',
      marginBottom: 14,
      letterSpacing: 0.5,
    },
    titleGold: {
      color: theme.gold,
    },
    desc: {
      fontFamily: FontFamily.mono,
      fontSize: 13,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 21,
      maxWidth: 280,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 24,
    },
    dot: {
      width: 18,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: theme.border,
    },
    dotActive: {
      width: 28,
      backgroundColor: theme.gold,
    },
    btn: {
      width: '100%',
      height: 52,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      fontFamily: FontFamily.display,
      fontSize: 15,
      color: Paper.ink,
      letterSpacing: 1,
    },
    loginLink: { marginTop: 16, padding: 8, alignItems: 'center' },
    loginLinkText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
  });
