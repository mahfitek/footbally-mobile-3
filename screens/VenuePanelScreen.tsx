import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
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
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';

const DAY_SHORT_KEYS: TranslationKey[] = [
  'venue_dayMonShort',
  'venue_dayTueShort',
  'venue_dayWedShort',
  'venue_dayThuShort',
  'venue_dayFriShort',
  'venue_daySatShort',
  'venue_daySunShort',
];

const pad = (n: number) => String(n).padStart(2, '0');
const HOUR_SLOTS = Array.from({ length: 16 }, (_, i) => {
  const start = 8 + i;
  return { start: `${pad(start)}:00`, end: `${pad(start + 1)}:00` };
});

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId: string | null;
}

export default function VenuePanelScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [venueId, setVenueId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [availability, setAvailability] = useState<Record<number, string[]>>({});

  const resolveUserId = async () => {
    if (userId) return userId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  useEffect(() => {
    loadVenue();
  }, [userId]);

  const loadVenue = async () => {
    setLoading(true);
    const uid = await resolveUserId();
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: venue } = await supabase.from('venues').select('*').eq('owner_user_id', uid).maybeSingle();
    if (!venue) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setVenueId(venue.id);
    setIsActive(!!venue.is_active);
    setName(venue.name || '');
    setAddress(venue.address || '');
    setPhone(venue.phone || '');
    setWhatsapp(venue.whatsapp || '');
    setPrice(venue.price_per_hour != null ? String(venue.price_per_hour) : '');
    setDescription(venue.description || '');

    const { data: slots } = await supabase
      .from('venue_availability')
      .select('day_of_week, start_time')
      .eq('venue_id', venue.id);

    const grouped: Record<number, string[]> = {};
    (slots ?? []).forEach((s: any) => {
      grouped[s.day_of_week] = [...(grouped[s.day_of_week] ?? []), s.start_time];
    });
    setAvailability(grouped);
    setLoading(false);
  };

  const toggleSlot = (day: number, start: string) => {
    setAvailability((prev) => {
      const current = prev[day] ?? [];
      const next = current.includes(start) ? current.filter((s) => s !== start) : [...current, start];
      return { ...prev, [day]: next };
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setToast({ message: t('venuePanel_fillName'), type: 'error' });
      return;
    }
    if (!venueId) return;

    setSaving(true);
    const { error: updateError } = await supabase
      .from('venues')
      .update({
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        price_per_hour: price ? Number(price) : null,
        description: description.trim() || null,
      })
      .eq('id', venueId);

    if (updateError) {
      setToast({ message: t('venuePanel_saveFailed'), type: 'error' });
      setSaving(false);
      return;
    }

    await supabase.from('venue_availability').delete().eq('venue_id', venueId);
    const rows = Object.entries(availability).flatMap(([day, starts]) =>
      starts.map((start) => ({
        venue_id: venueId,
        day_of_week: Number(day),
        start_time: start,
        end_time: HOUR_SLOTS.find((h) => h.start === start)?.end ?? start,
      }))
    );
    if (rows.length > 0) {
      await supabase.from('venue_availability').insert(rows);
    }

    setToast({ message: t('venuePanel_saveSuccess'), type: 'success' });
    setSaving(false);
  };

  if (loading) {
    return <LoadingScreen message={t('venuePanel_loading')} />;
  }

  if (notFound) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Ionicons name="business-outline" size={28} color={theme.textSecondary} />
          <Text style={styles.emptyText}>{t('venueDetail_notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const daySlots = availability[selectedDay] ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('venuePanel_title')}</Text>
          <HapticTouchable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? <ActivityIndicator color={theme.gold} /> : <Text style={styles.saveBtnText}>{t('venuePanel_save')}</Text>}
          </HapticTouchable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {!isActive && (
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={16} color={theme.gold} />
              <Text style={styles.noticeText}>{t('venuePanel_inactiveNotice')}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('venuePanel_nameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('venuePanel_namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('venuePanel_addressLabel')}</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder={t('venuePanel_addressPlaceholder')}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('venuePanel_priceLabel')}</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder={t('venuePanel_pricePlaceholder')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('venuePanel_phoneLabel')}</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="05XX XXX XX XX"
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('venuePanel_whatsappLabel')}</Text>
            <TextInput
              style={styles.input}
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="905XXXXXXXXX"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('venuePanel_descriptionLabel')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('venuePanel_descriptionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('venuePanel_availabilityLabel')}</Text>
            <Text style={styles.hintText}>{t('venuePanel_availabilityHint')}</Text>

            <View style={styles.dayPillsWrap}>
              {DAY_SHORT_KEYS.map((key, i) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.dayPill, selectedDay === i && styles.dayPillActive]}
                  onPress={() => setSelectedDay(i)}
                >
                  <Text style={[styles.dayPillText, selectedDay === i && styles.dayPillTextActive]}>
                    {t(key)}
                  </Text>
                  {(availability[i]?.length ?? 0) > 0 && <View style={styles.dayDot} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.slotsWrap}>
              {HOUR_SLOTS.map((slot) => {
                const active = daySlots.includes(slot.start);
                return (
                  <HapticTouchable
                    key={slot.start}
                    style={[styles.slotPill, active && styles.slotPillActive]}
                    onPress={() => toggleSlot(selectedDay, slot.start)}
                  >
                    <Text style={[styles.slotPillText, active && styles.slotPillTextActive]}>{slot.start}</Text>
                  </HapticTouchable>
                );
              })}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />
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
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    title: { fontFamily: FontFamily.display, fontSize: 19, color: theme.text, letterSpacing: 0.5 },
    saveBtn: { padding: 8, minWidth: 44, alignItems: 'flex-end' },
    saveBtnText: { fontFamily: FontFamily.mono, fontSize: 13, color: theme.goldDark },
    content: { paddingHorizontal: 24, paddingBottom: 60 },
    notice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 20,
    },
    noticeText: { flex: 1, fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 1, marginBottom: 8 },
    hintText: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginBottom: 12 },
    input: {
      height: 48,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      justifyContent: 'center',
      color: theme.text,
      fontFamily: FontFamily.mono,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    textArea: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
    dayPillsWrap: { flexDirection: 'row', gap: 6, marginBottom: 16 },
    dayPill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
    },
    dayPillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    dayPillText: { fontFamily: FontFamily.monoMedium, fontSize: 11, color: theme.textMuted, textTransform: 'uppercase' },
    dayPillTextActive: { color: Paper.ink },
    dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.gold, marginTop: 4 },
    slotsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    slotPill: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    slotPillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    slotPillText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted },
    slotPillTextActive: { color: Paper.ink },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
    emptyText: { fontFamily: FontFamily.mono, fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
  });
