import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { TranslationKey } from '../lib/i18n';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import LoadingScreen from '../components/LoadingScreen';
import HapticTouchable from '../components/HapticTouchable';

const DAY_KEYS: TranslationKey[] = [
  'venue_dayMon',
  'venue_dayTue',
  'venue_dayWed',
  'venue_dayThu',
  'venue_dayFri',
  'venue_daySat',
  'venue_daySun',
];

type VenueDetail = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  price_per_hour: number | null;
  description: string | null;
};

interface Props {
  navigate: (screen: string, params?: any) => void;
  venueId: string | null;
}

export default function VenueDetailScreen({ navigate, venueId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [availability, setAvailability] = useState<Record<number, string[]>>({});

  useEffect(() => {
    loadVenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const loadVenue = async () => {
    if (!venueId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('venues')
      .select('id, name, city, district, address, phone, whatsapp, price_per_hour, description')
      .eq('id', venueId)
      .maybeSingle();
    setVenue(data as VenueDetail | null);

    if (data) {
      const { data: slots } = await supabase
        .from('venue_availability')
        .select('day_of_week, start_time')
        .eq('venue_id', data.id)
        .order('start_time', { ascending: true });
      const grouped: Record<number, string[]> = {};
      (slots ?? []).forEach((s: any) => {
        grouped[s.day_of_week] = [...(grouped[s.day_of_week] ?? []), s.start_time];
      });
      setAvailability(grouped);
    }
    setLoading(false);
  };

  const hasAvailability = Object.values(availability).some((v) => v.length > 0);

  if (loading) {
    return <LoadingScreen message={t('venueDetail_loading')} />;
  }

  if (!venue) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('venues')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('venueDetail_title')}</Text>
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="business-outline" size={28} color={theme.textSecondary} />
          <Text style={styles.emptyText}>{t('venueDetail_notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('venues')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title} numberOfLines={1}>{venue.name}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="football-outline" size={22} color={theme.gold} />
          </View>
          <Text style={styles.venueName}>{venue.name}</Text>
          <Text style={styles.venueLocation}>{[venue.city, venue.district].filter(Boolean).join(' · ') || '-'}</Text>
        </View>

        {venue.address && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('venueDetail_address')}</Text>
            <Text style={styles.infoValue}>{venue.address}</Text>
          </View>
        )}

        {venue.price_per_hour != null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('venueDetail_price')}</Text>
            <Text style={styles.infoValue}>{t('venues_pricePrefix')}{venue.price_per_hour}{t('venues_priceSuffix')}</Text>
          </View>
        )}

        {venue.description && (
          <View style={styles.infoRow}>
            <Text style={styles.descriptionText}>{venue.description}</Text>
          </View>
        )}

        <View style={styles.contactRow}>
          {venue.phone && (
            <HapticTouchable style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${venue.phone}`)}>
              <Ionicons name="call-outline" size={16} color={Paper.ink} />
              <Text style={styles.contactBtnText}>{t('venueDetail_call')}</Text>
            </HapticTouchable>
          )}
          {venue.whatsapp && (
            <HapticTouchable
              style={[styles.contactBtn, styles.contactBtnOutline]}
              onPress={() => Linking.openURL(`https://wa.me/${venue.whatsapp}`)}
            >
              <Ionicons name="logo-whatsapp" size={16} color={theme.text} />
              <Text style={[styles.contactBtnText, { color: theme.text }]}>{t('venueDetail_whatsapp')}</Text>
            </HapticTouchable>
          )}
        </View>

        <Text style={styles.sectionTitle}>{t('venueDetail_availableHours')}</Text>
        {!hasAvailability ? (
          <Text style={styles.emptyAvailabilityText}>{t('venueDetail_noAvailability')}</Text>
        ) : (
          DAY_KEYS.map((key, i) =>
            (availability[i]?.length ?? 0) > 0 ? (
              <View key={key} style={styles.dayBlock}>
                <Text style={styles.dayBlockTitle}>{t(key)}</Text>
                <View style={styles.slotsWrap}>
                  {availability[i].map((start) => (
                    <View key={start} style={styles.slotChip}>
                      <Text style={styles.slotChipText}>{start}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
      paddingBottom: 16,
      gap: 12,
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
    title: { flex: 1, fontFamily: FontFamily.display, fontSize: 16, color: theme.text, letterSpacing: 0.5, textAlign: 'center' },
    content: { paddingHorizontal: 24, paddingBottom: 60 },
    card: { alignItems: 'center', marginBottom: 20 },
    cardIconWrap: {
      width: 56,
      height: 56,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    venueName: { fontFamily: FontFamily.display, fontSize: 19, color: theme.text, textAlign: 'center' },
    venueLocation: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.goldDark, marginTop: 4 },
    infoRow: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    infoLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 1, marginBottom: 4 },
    infoValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
    descriptionText: { fontFamily: FontFamily.body, fontSize: 13, color: theme.text, lineHeight: 19 },
    contactRow: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 24 },
    contactBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 48,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
    },
    contactBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
    contactBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: Paper.ink },
    sectionTitle: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 1, marginBottom: 12 },
    emptyAvailabilityText: { fontFamily: FontFamily.mono, fontSize: 13, color: theme.textSecondary },
    dayBlock: { marginBottom: 14 },
    dayBlockTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text, marginBottom: 8 },
    slotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    slotChipText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.text },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
    emptyText: { fontFamily: FontFamily.mono, fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
  });
