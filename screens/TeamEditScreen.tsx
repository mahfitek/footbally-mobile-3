import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';
import { TURKEY_CITIES } from '../constants/turkeyCities';

const LEAGUES = ['Süper Amatör', 'Amatör', 'Bölgesel', 'İl Ligi', 'İlçe Ligi', 'Diğer'];
const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '5-3-2', '3-4-3'];
const PLAYING_STYLES = ['Hızlı Geçiş', 'Tiki-Taka', 'Fiziksel', 'Teknik', 'Savunma Ağırlıklı', 'Hücum Ağırlıklı'];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const POSITIONS = ['Kaleci', 'Defans', 'Orta Saha', 'Kanat', 'Forvet'];
const YEARS = Array.from({ length: 126 }, (_, i) => 2025 - i);

type PickerType = 'league' | 'formation' | 'year' | 'city' | 'district' | null;

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId: string | null;
}

export default function TeamEditScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [openPicker, setOpenPicker] = useState<PickerType>(null);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [league, setLeague] = useState(LEAGUES[1]);
  const [foundedYear, setFoundedYear] = useState(String(new Date().getFullYear()));
  const [groundName, setGroundName] = useState('');
  const [description, setDescription] = useState('');
  const [playingStyle, setPlayingStyle] = useState<string[]>([]);
  const [formation, setFormation] = useState(FORMATIONS[0]);
  const [matchDays, setMatchDays] = useState<string[]>([]);
  const [neededPositions, setNeededPositions] = useState<string[]>([]);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  useEffect(() => {
    loadTeam();
  }, [userId]);

  const resolveUserId = async () => {
    if (userId) return userId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  const loadTeam = async () => {
    setLoading(true);
    const uid = await resolveUserId();
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from('teams').select('*').eq('owner_id', uid).maybeSingle();

    if (data) {
      setName(data.name || '');
      setCity(data.city || '');
      setDistrict(data.district || '');
      setLeague(data.league || LEAGUES[1]);
      setFoundedYear(String(data.founded_year || new Date().getFullYear()));
      setGroundName(data.ground_name || '');
      setDescription(data.description || '');
      setPlayingStyle(data.playing_style || []);
      setFormation(data.formation || FORMATIONS[0]);
      setMatchDays(data.match_days || []);
      setNeededPositions(data.needed_positions || []);
      setWhatsappLink(data.whatsapp_link || '');
      setContactNumber(data.contact_number || '');
    } else if (error && __DEV__) {
      console.log('Takım yüklenemedi:', error);
    }
    setLoading(false);
  };

  const toggleFromList = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleSelectCity = (cName: string) => {
    setCity(cName);
    setDistrict('');
    setOpenPicker(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setToast({ message: t('teamEdit_fillTeamName'), type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const uid = await resolveUserId();
      if (__DEV__) console.log('TeamEditScreen save - userId:', uid);
      if (!uid) {
        setToast({ message: t('teamEdit_noSession'), type: 'error' });
        setSaving(false);
        return;
      }

      const payload = {
        name: name.trim(),
        city: city || null,
        district: district || null,
        league,
        founded_year: parseInt(foundedYear, 10) || null,
        ground_name: groundName.trim() || null,
        description: description.trim() || null,
        playing_style: playingStyle,
        formation,
        match_days: matchDays,
        needed_positions: neededPositions,
        whatsapp_link: whatsappLink.trim() || null,
        contact_number: contactNumber.trim() || null,
      };

      const { data: updated, error: updateError } = await supabase
        .from('teams')
        .update(payload)
        .eq('owner_id', uid)
        .select();

      if (updateError) {
        if (__DEV__) console.log('Takım kaydedilemedi:', updateError);
        setToast({ message: t('teamEdit_saveFailed'), type: 'error' });
        setSaving(false);
        return;
      }

      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase.from('teams').insert({ owner_id: uid, ...payload });
        if (insertError) {
          if (__DEV__) console.log('Takım oluşturulamadı:', insertError);
          setToast({ message: t('teamEdit_createFailed'), type: 'error' });
          setSaving(false);
          return;
        }
      }

      setToast({ message: t('teamEdit_saveSuccess'), type: 'success' });
      sendLocalNotification(t('teamEdit_updatedNotifTitle'), t('teamEdit_updatedNotifBody'));
      setTimeout(() => navigate('teamProfile'), 800);
    } catch (err) {
      if (__DEV__) console.log('Takım kaydedilirken beklenmeyen hata:', err);
      setToast({ message: t('findOpponent_unexpectedError'), type: 'error' });
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen message={t('teamProfile_loading')} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('teamProfile')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('teamEdit_title')}</Text>
          <HapticTouchable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? <ActivityIndicator color={theme.gold} /> : <Text style={styles.saveBtnText}>{t('match_save')}</Text>}
          </HapticTouchable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_nameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('teamEdit_namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('createMatch_cityLabel')}</Text>
              <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setOpenPicker(openPicker === 'city' ? null : 'city')}>
                <Text style={city ? styles.inputValueText : styles.inputPlaceholderText}>
                  {city || t('createMatch_citySelect')}
                </Text>
                <Ionicons name={openPicker === 'city' ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('createMatch_districtLabel')}</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, !city && styles.inputDisabled]}
                onPress={() => city && setOpenPicker(openPicker === 'district' ? null : 'district')}
                disabled={!city}
              >
                <Text style={district ? styles.inputValueText : styles.inputPlaceholderText}>
                  {district || t('createMatch_districtSelect')}
                </Text>
                <Ionicons name={openPicker === 'district' ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {openPicker === 'city' && (
            <View style={styles.inlinePicker}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
                {TURKEY_CITIES.map((c) => (
                  <TouchableOpacity key={c.plate} onPress={() => handleSelectCity(c.name)} style={styles.fullListRow}>
                    <Text style={styles.listRowText}>{c.plate}. {c.name}</Text>
                    {city === c.name && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {openPicker === 'district' && (
            <View style={styles.inlinePicker}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                {(TURKEY_CITIES.find((c) => c.name === city)?.districts ?? []).map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => { setDistrict(d); setOpenPicker(null); }}
                    style={styles.fullListRow}
                  >
                    <Text style={styles.listRowText}>{d}</Text>
                    {district === d && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_leagueLabel')}</Text>
            <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setOpenPicker(openPicker === 'league' ? null : 'league')}>
              <Text style={styles.inputValueText}>{league}</Text>
              <Ionicons name={openPicker === 'league' ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {openPicker === 'league' && (
            <View style={styles.inlinePicker}>
              {LEAGUES.map((l) => (
                <TouchableOpacity key={l} onPress={() => { setLeague(l); setOpenPicker(null); }} style={styles.fullListRow}>
                  <Text style={styles.listRowText}>{l}</Text>
                  {league === l && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_foundedYearLabel')}</Text>
            <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setOpenPicker(openPicker === 'year' ? null : 'year')}>
              <Text style={styles.inputValueText}>{foundedYear}</Text>
              <Ionicons name={openPicker === 'year' ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {openPicker === 'year' && (
            <View style={styles.inlinePicker}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
                {YEARS.map((y) => (
                  <TouchableOpacity
                    key={y}
                    onPress={() => { setFoundedYear(String(y)); setOpenPicker(null); }}
                    style={styles.fullListRow}
                  >
                    <Text style={styles.listRowText}>{y}</Text>
                    {foundedYear === String(y) && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_groundLabel')}</Text>
            <TextInput
              style={styles.input}
              value={groundName}
              onChangeText={setGroundName}
              placeholder={t('teamEdit_groundPlaceholder')}
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_descriptionLabel')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t('teamEdit_descriptionPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_playingStyleLabel')}</Text>
            <View style={styles.pillsWrap}>
              {PLAYING_STYLES.map((s) => (
                <HapticTouchable
                  key={s}
                  style={[styles.stylePill, playingStyle.includes(s) && styles.stylePillActive]}
                  onPress={() => toggleFromList(playingStyle, setPlayingStyle, s)}
                >
                  <Text style={[styles.stylePillText, playingStyle.includes(s) && styles.stylePillTextActive]}>{s}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamProfile_formation')}</Text>
            <TouchableOpacity style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setOpenPicker(openPicker === 'formation' ? null : 'formation')}>
              <Text style={styles.inputValueText}>{formation}</Text>
              <Ionicons name={openPicker === 'formation' ? 'chevron-up' : 'chevron-down'} size={13} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          {openPicker === 'formation' && (
            <View style={styles.inlinePicker}>
              {FORMATIONS.map((f) => (
                <TouchableOpacity key={f} onPress={() => { setFormation(f); setOpenPicker(null); }} style={styles.fullListRow}>
                  <Text style={styles.listRowText}>{f}</Text>
                  {formation === f && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamProfile_matchDays')}</Text>
            <View style={styles.pillsWrap}>
              {DAYS.map((d) => (
                <HapticTouchable
                  key={d}
                  style={[styles.stylePill, matchDays.includes(d) && styles.stylePillActive]}
                  onPress={() => toggleFromList(matchDays, setMatchDays, d)}
                >
                  <Text style={[styles.stylePillText, matchDays.includes(d) && styles.stylePillTextActive]}>{d}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamProfile_wantedPositions')}</Text>
            <View style={styles.pillsWrap}>
              {POSITIONS.map((p) => (
                <HapticTouchable
                  key={p}
                  style={[styles.stylePill, neededPositions.includes(p) && styles.stylePillActive]}
                  onPress={() => toggleFromList(neededPositions, setNeededPositions, p)}
                >
                  <Text style={[styles.stylePillText, neededPositions.includes(p) && styles.stylePillTextActive]}>{p}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_whatsappLabel')}</Text>
            <TextInput
              style={styles.input}
              value={whatsappLink}
              onChangeText={setWhatsappLink}
              placeholder="https://chat.whatsapp.com/..."
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('teamEdit_contactLabel')}</Text>
            <TextInput
              style={styles.input}
              value={contactNumber}
              onChangeText={setContactNumber}
              placeholder="05XX XXX XX XX"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
            />
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
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
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
    saveBtn: { padding: 8, minWidth: 44, alignItems: 'flex-end' },
    saveBtnText: { fontFamily: FontFamily.mono, fontSize: 13, color: theme.gold },
    content: { paddingHorizontal: 16, paddingBottom: 60 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 1, marginBottom: 8 },
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
    inputDisabled: { opacity: 0.5 },
    inputValueText: { fontFamily: FontFamily.mono, color: theme.text, fontSize: 14 },
    inputPlaceholderText: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 14 },
    textArea: { height: 100, paddingTop: 12, textAlignVertical: 'top' },
    pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stylePill: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stylePillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    stylePillText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted },
    stylePillTextActive: { color: Paper.ink },
    inlinePicker: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      marginTop: -8,
      marginBottom: 16,
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
    checkmark: { fontSize: 15, color: theme.gold, fontWeight: '700' },
  });
