// Ana sayfadaki SAHADAN önizlemesi: son mesajlar (canlı), yazma kutusu ve tam ekrana giriş.
// Veri ve abonelik lib/useSahadanFeed.ts'tedir (tam ekranla ortak). Önizlemede medyası doğrulanamayan mesajlar gizlenir.
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from './HapticTouchable';
import SectionHeader from './SectionHeader';
import { useSahadanFeed } from '../lib/useSahadanFeed';
import {
  SAHADAN_PREVIEW_COUNT,
  sahadanPreview,
  sahadanSenderRoute,
  withoutUnverifiedMedia,
} from '../lib/sahadan';

const RADIUS = CARD_RADIUS;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface Props {
  navigate: (screen: string, params?: any) => void;
}

export default function SahadanPreview({ navigate }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const { loading, rows, identities, verified } = useSahadanFeed(true);

  // Medyası doğrulanmamış mesajlar önizlemede gösterilmez (bkz. lib/sahadan.ts).
  const shown = sahadanPreview(verified ? rows : withoutUnverifiedMedia(rows), SAHADAN_PREVIEW_COUNT);

  const openFull = () => navigate('tribun');
  const openWrite = () => navigate('tribun', { focus: true });

  return (
    <View>
      <SectionHeader title={t('sahadan_title')} actionLabel={t('common_all')} onAction={openFull} />
      <View style={styles.card}>
        {loading ? null : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('sahadan_empty')}</Text>
            <HapticTouchable style={styles.writeBtn} onPress={openWrite}>
              <Ionicons name="create-outline" size={14} color={Paper.ink} />
              <Text style={styles.writeBtnText}>{t('sahadan_writeFirst')}</Text>
            </HapticTouchable>
          </View>
        ) : (
          shown.map((m) => {
            const identity = identities.get(m.sender_id);
            const kind = identity?.kind === 'team' ? 'team' : 'player';
            return (
              <HapticTouchable key={m.id} style={styles.row} onPress={openFull} onLongPress={openFull}>
                <View style={styles.rowHead}>
                  <HapticTouchable
                    style={styles.senderTap}
                    onPress={() => {
                      const route = sahadanSenderRoute(kind, m.sender_id);
                      navigate(route.screen, route.params);
                    }}
                  >
                    <View style={[styles.tagChip, kind === 'team' ? styles.tagTeam : styles.tagPlayer]}>
                      <Text style={[styles.tagText, kind === 'team' ? styles.tagTextTeam : styles.tagTextPlayer]}>
                        {kind === 'team' ? t('sahadan_tagTeam') : t('sahadan_tagPlayer')}
                      </Text>
                    </View>
                    <Text style={styles.senderName} numberOfLines={1}>
                      {identity?.name ?? t('common_defaultUser')}
                    </Text>
                  </HapticTouchable>
                  <Text style={styles.time}>{formatTime(m.created_at)}</Text>
                </View>
                <View style={styles.bodyRow}>
                  {!!m.content && (
                    <Text style={styles.content} numberOfLines={2}>
                      {m.content}
                    </Text>
                  )}
                  {!!m.media_url && m.media_type === 'image' && (
                    <Image source={{ uri: m.media_url }} style={styles.thumb} resizeMode="cover" />
                  )}
                  {!!m.media_url && m.media_type === 'video' && (
                    <View style={styles.thumb}>
                      <Ionicons name="play-circle" size={22} color={theme.gold} />
                    </View>
                  )}
                </View>
              </HapticTouchable>
            );
          })
        )}

        <HapticTouchable style={styles.inputBar} onPress={openWrite}>
          <Ionicons name="megaphone-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.inputPlaceholder}>{t('sahadan_placeholder')}</Text>
        </HapticTouchable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 24,
      marginBottom: 24,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
    },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 10 },
    emptyText: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, textAlign: 'center' },
    writeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
    },
    writeBtnText: { fontFamily: FontFamily.display, fontSize: 12, letterSpacing: 0.5, color: Paper.ink },
    row: { gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border },
    rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    senderTap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    tagChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
    tagPlayer: { borderColor: theme.gold },
    tagTeam: { borderColor: theme.textSecondary },
    tagText: { fontFamily: FontFamily.monoMedium, fontSize: 9 },
    tagTextPlayer: { color: theme.goldDark },
    tagTextTeam: { color: theme.textSecondary },
    senderName: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.textMuted, flexShrink: 1 },
    time: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary },
    bodyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    content: { flex: 1, fontFamily: FontFamily.body, fontSize: 14, color: theme.text, lineHeight: 19 },
    thumb: {
      width: 40,
      height: 40,
      borderRadius: 6,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 42,
      paddingHorizontal: 14,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputPlaceholder: { fontFamily: FontFamily.mono, fontSize: 13, color: theme.textSecondary },
  });
