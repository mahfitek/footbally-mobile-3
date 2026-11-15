// Yaklaşan maç ilanlarını türüne göre etiketli ve filtrelenebilir gösterir.
// Rakip, oyuncu ve aktiviteler ekranları bu bileşeni kullanır (ilanlar matches tablosundadır).
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { MATCH_COLUMNS } from '../lib/columns';
import { MATCH_FORMATS, type MatchFormat } from '../lib/formations';
import {
  filterListings,
  formatOfListing,
  isPaidListing,
  listingTypeOf,
  LISTING_TYPES,
  LISTING_TYPE_SHORT_KEYS,
  type ListingFilter,
  type ListingType,
} from '../lib/matchListing';
import HapticTouchable from './HapticTouchable';
import type { TranslationKey } from '../lib/i18n';

const RADIUS = CARD_RADIUS;

type BoardRow = {
  id: number;
  title: string | null;
  date: string;
  time: string | null;
  location: string | null;
  city: string | null;
  type: string | null;
  listing_type: string | null;
  match_format: number | null;
  team_payment: number | string | null;
};

interface Props {
  navigate: (screen: string) => void;
  allowedTypes?: readonly ListingType[];
  titleKey?: TranslationKey;
}

export default function ListingBoard({ navigate, allowedTypes = LISTING_TYPES, titleKey }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);

  const [rows, setRows] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<ListingFilter>('all');
  const [formatFilter, setFormatFilter] = useState<MatchFormat | 'all'>('all');

  useEffect(() => {
    let active = true;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(40);
      if (!active) return;
      setRows(error ? [] : ((data ?? []) as unknown as BoardRow[]));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const allowed = allowedTypes.length > 0 ? allowedTypes : LISTING_TYPES;
  const inScope = rows.filter((row) => allowed.includes(listingTypeOf(row)));
  const visible = filterListings(inScope, { listingType: typeFilter, format: formatFilter });

  return (
    <View style={styles.wrap}>
      {titleKey ? <Text style={styles.heading}>{t(titleKey)}</Text> : null}

      {allowed.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label={t('listing_filterAll')} active={typeFilter === 'all'} onPress={() => setTypeFilter('all')} styles={styles} />
          {allowed.map((type) => (
            <Chip
              key={type}
              label={t(LISTING_TYPE_SHORT_KEYS[type])}
              active={typeFilter === type}
              onPress={() => setTypeFilter(type)}
              styles={styles}
            />
          ))}
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label={t('listing_filterFormatAll')} active={formatFilter === 'all'} onPress={() => setFormatFilter('all')} styles={styles} />
        {MATCH_FORMATS.map((format) => (
          <Chip
            key={format}
            label={`${format}v${format}`}
            active={formatFilter === format}
            onPress={() => setFormatFilter(format)}
            styles={styles}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginVertical: 12 }} />
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>{t('listing_boardEmpty')}</Text>
      ) : (
        visible.map((row) => {
          const format = formatOfListing(row);
          const badges = [
            t(LISTING_TYPE_SHORT_KEYS[listingTypeOf(row)]),
            format ? `${format}v${format}` : row.type,
            isPaidListing(row) ? t('listing_paidBadge') : null,
          ].filter(Boolean);
          return (
            <HapticTouchable key={row.id} style={styles.card} onPress={() => navigate('match')}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{row.title || t('listing_untitled')}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {row.date} · {row.time ?? ''} · {row.city ?? ''}
                </Text>
                <View style={styles.badgeRow}>
                  {badges.map((badge) => (
                    <Text key={String(badge)} style={styles.badge}>{badge}</Text>
                  ))}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </HapticTouchable>
          );
        })
      )}
    </View>
  );
}

function Chip({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <HapticTouchable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </HapticTouchable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 10, paddingHorizontal: 20, marginBottom: 16 },
    heading: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: theme.text },
    chipRow: { gap: 8, paddingVertical: 2 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    chipText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted },
    chipTextActive: { color: Paper.ink },
    empty: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, paddingVertical: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
    cardMeta: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textMuted },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    badge: {
      fontFamily: FontFamily.monoMedium,
      fontSize: 10,
      color: theme.goldDark,
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
  });
