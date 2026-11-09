import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from './HapticTouchable';

// Footbally Cup duyurusu — Ana Sayfa'da (oyuncu ve takım) diğer kısayollardan
// daha dikkat çekici olması istenen turnuva habercisi. Henüz turnuva ekranı
// olmadığı için dokununca bilgilendirici bir mesaj gösteriyor.
export default function TournamentTeaser() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);

  return (
    <HapticTouchable
      style={styles.card}
      onPress={() => Alert.alert(`🏆 ${t('tournament_name')}`, t('tournament_alertBody'))}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="trophy" size={26} color={theme.gold} />
      </View>
      <View style={styles.textWrap}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('tournament_name').toUpperCase()}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t('tournament_comingSoon')}</Text>
          </View>
        </View>
        <Text style={styles.sub}>{t('tournament_teaserSub')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.gold} />
    </HapticTouchable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginHorizontal: 24,
      marginBottom: 24,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      borderRadius: CARD_RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.4),
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: hexToRgba(theme.gold, 0.18),
      alignItems: 'center',
      justifyContent: 'center',
    },
    textWrap: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
    title: { fontFamily: FontFamily.display, fontSize: 16, color: theme.text, letterSpacing: 0.5 },
    badge: {
      backgroundColor: theme.gold,
      borderRadius: PILL_RADIUS,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    badgeText: { fontFamily: FontFamily.monoMedium, fontSize: 9, color: theme.bg, letterSpacing: 0.5 },
    sub: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textSecondary, lineHeight: 16 },
  });
