import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { sanitizeSearchTerm } from '../lib/security';
import { TURKEY_CITIES } from '../constants/turkeyCities';
import EmptyState from '../components/EmptyState';
import HapticTouchable from '../components/HapticTouchable';

type VenueRow = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  price_per_hour: number | null;
};

interface Props {
  navigate: (screen: string, params?: any) => void;
  userType?: 'player' | 'team' | 'venue';
}

export default function VenuesScreen({ navigate, userType }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(loadVenues, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, city]);

  const loadVenues = async () => {
    setLoading(true);
    let req = supabase
      .from('venues')
      .select('id, name, city, district, price_per_hour')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (city) req = req.eq('city', city);
    const q = sanitizeSearchTerm(query.trim());
    if (q) req = req.ilike('name', `%${q}%`);

    const { data } = await req;
    setVenues((data ?? []) as VenueRow[]);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate(userType === 'team' ? 'teamHome' : 'home')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('venues_title')}</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={styles.filtersWrap}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={15} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('venues_searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity style={styles.cityBtn} onPress={() => setCityPickerOpen((v) => !v)}>
          <Text style={styles.cityBtnText} numberOfLines={1}>{city || t('venues_allCities')}</Text>
          <Ionicons name={cityPickerOpen ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {cityPickerOpen && (
        <View style={styles.inlinePicker}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
            <TouchableOpacity style={styles.fullListRow} onPress={() => { setCity(''); setCityPickerOpen(false); }}>
              <Text style={styles.listRowText}>{t('venues_allCities')}</Text>
              {!city && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            {TURKEY_CITIES.map((c) => (
              <TouchableOpacity key={c.plate} style={styles.fullListRow} onPress={() => { setCity(c.name); setCityPickerOpen(false); }}>
                <Text style={styles.listRowText}>{c.plate}. {c.name}</Text>
                {city === c.name && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {venues.length === 0 ? (
            <EmptyState icon="business-outline" title={t('venues_empty')} subtitle="" />
          ) : (
            <View style={{ gap: 12 }}>
              {venues.map((v) => (
                <HapticTouchable key={v.id} style={styles.row} onPress={() => navigate('venueDetail', { id: v.id })}>
                  <View style={styles.avatar}>
                    <Ionicons name="football-outline" size={19} color={theme.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{v.name}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={13} color={theme.textMuted} />
                      <Text style={styles.rowMeta} numberOfLines={1}>{[v.city, v.district].filter(Boolean).join(' · ') || '-'}</Text>
                    </View>
                  </View>
                  {v.price_per_hour != null && (
                    <View style={styles.pricePill}>
                      <Text style={styles.priceText}>{t('venues_pricePrefix')}{v.price_per_hour}{t('venues_priceSuffix')}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </HapticTouchable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    backBtn: {
      width: 42,
      height: 42,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    filtersWrap: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 12 },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      height: 44,
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: { flex: 1, color: theme.text, fontFamily: FontFamily.mono, fontSize: 13 },
    cityBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      height: 44,
      borderWidth: 1,
      borderColor: theme.border,
      maxWidth: 130,
    },
    cityBtnText: { color: theme.text, fontFamily: FontFamily.mono, fontSize: 12, flexShrink: 1 },
    inlinePicker: {
      marginHorizontal: 24,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    fullListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      justifyContent: 'space-between',
    },
    listRowText: { fontFamily: FontFamily.mono, fontSize: 14, color: theme.text },
    checkmark: { fontSize: 15, color: theme.goldDark, fontWeight: '700' },
    content: { paddingHorizontal: 24, paddingBottom: 60 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    rowTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    rowMeta: { flexShrink: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted },
    pricePill: { backgroundColor: theme.card2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    priceText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.goldDark },
  });
