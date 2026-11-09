import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import HapticTouchable from '../components/HapticTouchable';
import BottomSheet from '../components/BottomSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import Toast from '../components/Toast';
import { TURKEY_CITIES } from '../constants/turkeyCities';
import { useAccountAccess, canWriteProfile, canWriteTeam } from '../lib/accountContext';
import { fetchManagedTeams, type ManagedTeam } from '../lib/managedTeams';
import { buildMatchInsert, classifyMatchResult, type MatchFailureReason, type MatchScope } from '../lib/matchCreation';
import type { TranslationKey } from '../lib/i18n';

const PLAYER_COUNTS = [5, 7, 11];
const MATCH_CATEGORIES = ['Eğlence', 'Rekabetçi', 'Antrenman'];

// Sunucu hata nedeni → kullanıcıya gösterilen metin (bkz. lib/matchCreation.ts).
const MATCH_FAILURE_KEYS: Record<MatchFailureReason, TranslationKey> = {
  not_team_manager: 'createMatch_err_notTeamManager',
  team_archived: 'createMatch_err_teamArchived',
  team_restricted: 'createMatch_err_teamRestricted',
  personal_account_restricted: 'createMatch_err_personalRestricted',
  team_not_found: 'createMatch_err_teamNotFound',
  team_unsupported: 'createMatch_err_teamUnsupported',
  unknown: 'createMatch_createFailed',
};

interface Props {
  navigate: (screen: string) => void;
}

function formatDateForSupabase(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeForSupabase(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function CreateMatchScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const styles = createStyles(theme);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [location, setLocation] = useState('');
  const [playersPerSide, setPlayersPerSide] = useState(PLAYER_COUNTS[0]);
  const [category, setCategory] = useState(MATCH_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  // Bireysel maç varsayılandır. Takım seçilirse team_id gönderilir; seçilmezse alan hiç gönderilmez.
  const [scope, setScope] = useState<MatchScope>({ kind: 'personal' });
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]);
  const [teamsComplete, setTeamsComplete] = useState(true);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const { access: accountAccess } = useAccountAccess();

  // Yüklenirken `teamsComplete` true kalır; sonuç geldikten sonra güncellenir (senkron setState yok).
  const loadManagedTeams = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const result = await fetchManagedTeams(supabase, uid, t('createMatch_unnamedTeam'));
    setManagedTeams(result.teams);
    setTeamsComplete(result.ok);
    setTeamsLoaded(true);
  };

  // Ekran açılışında bir kez yüklenir. State yalnızca await'ten sonra yazılır (senkron setState yok).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void loadManagedTeams();
  }, []);

  const selectedCity = TURKEY_CITIES.find((c) => c.name === city);
  const filteredCities = TURKEY_CITIES.filter((c) =>
    c.name.toLocaleLowerCase('tr-TR').includes(citySearch.toLocaleLowerCase('tr-TR'))
  );
  const filteredDistricts = (selectedCity?.districts ?? []).filter((d) =>
    d.toLocaleLowerCase('tr-TR').includes(districtSearch.toLocaleLowerCase('tr-TR'))
  );

  const handleSelectCity = (name: string) => {
    setCity(name);
    setDistrict('');
    setCitySearch('');
    setCityModalVisible(false);
    setDistrictModalVisible(true);
  };

  const handleSelectDistrict = (name: string) => {
    setDistrict(name);
    setDistrictSearch('');
    setDistrictModalVisible(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !city.trim() || !district.trim() || !location.trim()) {
      setToast({ message: t('createMatch_fillAllFields'), type: 'error' });
      return;
    }

    // Hesap durumu doğrulanmadıysa ya da ilgili kapsam kısıtlıysa yazma yapılmaz (fail closed).
    const teamScope = scope.kind === 'team';
    const writeAllowed = teamScope ? canWriteTeam(accountAccess) : canWriteProfile(accountAccess);
    if (!writeAllowed) {
      const restrictedTeam = teamScope && accountAccess?.verified && accountAccess.teamRestricted;
      setToast({ message: restrictedTeam ? t('account_teamWriteBlocked') : t('account_writeBlocked'), type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setToast({ message: t('createMatch_needSession'), type: 'error' });
        setSaving(false);
        return;
      }

      const row = buildMatchInsert(
        {
          title: title.trim(),
          date: formatDateForSupabase(date),
          time: formatTimeForSupabase(time),
          location: location.trim(),
          city: `${city}, ${district}`,
          required_players: playersPerSide * 2,
          type: `${playersPerSide}v${playersPerSide}`,
          category: category,
          creator_id: user.id,
        },
        scope,
      );

      const outcome = classifyMatchResult(await supabase.from('matches').insert(row), scope);

      if (outcome.status === 'failed') {
        if (__DEV__) console.log('Maç oluşturulamadı:', outcome.reason);
        setToast({ message: t(MATCH_FAILURE_KEYS[outcome.reason]), type: 'error' });
        setSaving(false);
        return;
      }

      sendLocalNotification(t('createMatch_createdNotifTitle'), `${title.trim()} ${t('createMatch_createdNotifBody')}`);
      setToast({ message: t('createMatch_createdToast'), type: 'success' });
      setTimeout(() => navigate('match'), 800);
    } catch (err) {
      if (__DEV__) console.log('Maç oluşturulurken beklenmeyen hata:', err);
      setToast({ message: t('createMatch_unexpectedError'), type: 'error' });
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('match')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('createMatch_title')}</Text>
        </View>

        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('createMatch_scopeLabel')}</Text>
            <View style={styles.typeRow}>
              <HapticTouchable
                style={[styles.typePill, scope.kind === 'personal' && styles.typePillActive]}
                onPress={() => setScope({ kind: 'personal' })}
              >
                <Text style={[styles.typePillText, scope.kind === 'personal' && styles.typePillTextActive]}>
                  {t('createMatch_scopePersonal')}
                </Text>
              </HapticTouchable>
              {managedTeams.map((team) => (
                <HapticTouchable
                  key={team.id}
                  style={[styles.typePill, scope.kind === 'team' && scope.teamId === team.id && styles.typePillActive]}
                  onPress={() => setScope({ kind: 'team', teamId: team.id })}
                >
                  <Text
                    style={[styles.typePillText, scope.kind === 'team' && scope.teamId === team.id && styles.typePillTextActive]}
                  >
                    {team.name}
                  </Text>
                </HapticTouchable>
              ))}
            </View>
            <Text style={styles.scopeNote}>
              {scope.kind === 'personal' ? t('createMatch_scopePersonalHint') : t('createMatch_scopeTeamHint')}
            </Text>
            {!teamsComplete && <Text style={styles.scopeNote}>{t('createMatch_teamsUnavailable')}</Text>}
            {teamsLoaded && teamsComplete && managedTeams.length === 0 && (
              <Text style={styles.scopeNote}>{t('createMatch_noTeamsHint')}</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('createMatch_nameLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('createMatch_namePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('createMatch_dateLabel')}</Text>
              <HapticTouchable style={styles.input} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.inputValueText}>
                  {date.toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
              </HapticTouchable>
            </View>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('createMatch_timeLabel')}</Text>
              <HapticTouchable style={styles.input} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.inputValueText}>
                  {time.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: false })}
                </Text>
              </HapticTouchable>
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              locale={dateLocale}
              minimumDate={new Date()}
              onChange={(_event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={time}
              mode="time"
              display="spinner"
              is24Hour={true}
              onChange={(_event, selectedTime) => {
                setShowTimePicker(false);
                if (selectedTime) setTime(selectedTime);
              }}
            />
          )}

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('createMatch_cityLabel')}</Text>
              <HapticTouchable style={styles.input} onPress={() => setCityModalVisible(true)}>
                <Text style={city ? styles.inputValueText : styles.inputPlaceholderText}>
                  {city || t('createMatch_citySelect')}
                </Text>
              </HapticTouchable>
            </View>
            <View style={[styles.inputGroup, styles.half]}>
              <Text style={styles.inputLabel}>{t('createMatch_districtLabel')}</Text>
              <HapticTouchable
                style={[styles.input, !city && styles.inputDisabled]}
                onPress={() => city && setDistrictModalVisible(true)}
                disabled={!city}
              >
                <Text style={district ? styles.inputValueText : styles.inputPlaceholderText}>
                  {district || t('createMatch_districtSelect')}
                </Text>
              </HapticTouchable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('createMatch_locationLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('createMatch_locationPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('createMatch_playerCountLabel')}</Text>
            <View style={styles.typeRow}>
              {PLAYER_COUNTS.map((n) => (
                <HapticTouchable
                  key={n}
                  style={[styles.typePill, playersPerSide === n && styles.typePillActive]}
                  onPress={() => setPlayersPerSide(n)}
                >
                  <Text
                    style={[styles.typePillText, playersPerSide === n && styles.typePillTextActive]}
                  >
                    {n}v{n}
                  </Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('createMatch_typeLabel')}</Text>
            <View style={styles.typeRow}>
              {MATCH_CATEGORIES.map((c) => (
                <HapticTouchable
                  key={c}
                  style={[styles.typePill, category === c && styles.typePillActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.typePillText, category === c && styles.typePillTextActive]}>
                    {c}
                  </Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <HapticTouchable
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Paper.ink} />
            ) : (
              <Text style={styles.submitBtnText}>{t('match_createMatch')}</Text>
            )}
          </HapticTouchable>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={cityModalVisible} onClose={() => setCityModalVisible(false)} theme={theme} contentStyle={{ height: '75%' }}>
        <Text style={styles.modalTitle}>{t('createMatch_selectCityTitle')}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('createMatch_citySearchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          value={citySearch}
          onChangeText={setCitySearch}
        />
        <FlatList
          data={filteredCities}
          keyExtractor={(item) => String(item.plate)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <HapticTouchable style={styles.listRow} onPress={() => handleSelectCity(item.name)}>
              <Text style={styles.listRowPlate}>{item.plate}</Text>
              <Text style={styles.listRowText}>{item.name}</Text>
            </HapticTouchable>
          )}
          style={styles.list}
        />
        <HapticTouchable style={styles.modalCancelBtn} onPress={() => setCityModalVisible(false)}>
          <Text style={styles.modalCancelText}>{t('match_giveUp')}</Text>
        </HapticTouchable>
      </BottomSheet>

      <BottomSheet visible={districtModalVisible} onClose={() => setDistrictModalVisible(false)} theme={theme} contentStyle={{ height: '75%' }}>
        <Text style={styles.modalTitle}>{t('createMatch_selectDistrictTitle')}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('createMatch_districtSearchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          value={districtSearch}
          onChangeText={setDistrictSearch}
        />
        <FlatList
          data={filteredDistricts}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <HapticTouchable style={styles.listRow} onPress={() => handleSelectDistrict(item)}>
              <Text style={styles.listRowText}>{item}</Text>
            </HapticTouchable>
          )}
          style={styles.list}
        />
        <HapticTouchable
          style={styles.modalCancelBtn}
          onPress={() => setDistrictModalVisible(false)}
        >
          <Text style={styles.modalCancelText}>{t('match_giveUp')}</Text>
        </HapticTouchable>
      </BottomSheet>

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 24,
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
    title: { fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    inputGroup: { marginBottom: 16 },
    inputLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      fontFamily: FontFamily.mono,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      height: 50,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      justifyContent: 'center',
      color: theme.text,
      fontSize: 14,
      fontFamily: FontFamily.mono,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputDisabled: { backgroundColor: theme.card2 },
    inputValueText: { color: theme.text, fontSize: 14, fontFamily: FontFamily.mono },
    inputPlaceholderText: { color: theme.textSecondary, fontSize: 14, fontFamily: FontFamily.mono },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    scopeNote: { marginTop: 6, fontSize: 12, color: theme.textSecondary, fontFamily: FontFamily.body },
    typePill: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: RADIUS,
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    typePillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    typePillText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.textMuted },
    typePillTextActive: { color: Paper.ink },
    submitBtn: {
      height: 52,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitBtnDisabled: { backgroundColor: theme.border },
    submitBtnText: { fontSize: 15, fontFamily: FontFamily.display, color: Paper.ink, letterSpacing: 1 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      padding: 24,
      height: '75%',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text, marginBottom: 16 },
    searchInput: {
      height: 48,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      color: theme.text,
      fontSize: 14,
      fontFamily: FontFamily.mono,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    list: { flex: 1 },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    listRowPlate: {
      width: 28,
      fontSize: 13,
      fontFamily: FontFamily.monoMedium,
      color: theme.goldDark,
    },
    listRowText: { fontSize: 14, fontFamily: FontFamily.mono, color: theme.text },
    modalCancelBtn: {
      height: 50,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    modalCancelText: { fontSize: 13, fontFamily: FontFamily.mono, color: theme.textMuted },
  });
