import { useEffect, useMemo, useState } from 'react';
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
import FormationPitch, { type PitchSeat } from '../components/FormationPitch';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { sendLocalNotification } from '../lib/notifications';
import Toast from '../components/Toast';
import { TURKEY_CITIES } from '../constants/turkeyCities';
import { useAccountAccess, canWriteProfile, canWriteTeam } from '../lib/accountContext';
import { fetchManagedTeams, type ManagedTeam } from '../lib/managedTeams';
import { classifyMatchResult, type MatchFailureReason, type MatchScope } from '../lib/matchCreation';
import {
  MATCH_FORMATS,
  FORMATIONS,
  getFormationSlots,
  autoFillLineup,
  buildLineupEntries,
  isFormationForFormat,
  roleLabel,
  type FormationSlot,
  type LineupAssignment,
  type LineupCandidate,
  type MatchFormat,
} from '../lib/formations';
import {
  buildListingRow,
  POSITION_OPTIONS,
  LISTING_TYPES,
  MAX_DESCRIPTION_LENGTH,
  type ListingDraftError,
  type ListingType,
} from '../lib/matchListing';
import type { TranslationKey } from '../lib/i18n';

const RADIUS = CARD_RADIUS;

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

const DRAFT_ERROR_KEYS: Record<ListingDraftError, TranslationKey> = {
  title_required: 'listing_err_title_required',
  location_required: 'listing_err_location_required',
  city_required: 'listing_err_city_required',
  date_required: 'listing_err_date_required',
  time_required: 'listing_err_time_required',
  format_required: 'listing_err_format_required',
  team_required: 'listing_err_team_required',
  positions_required: 'listing_err_positions_required',
  missing_players_invalid: 'listing_err_missing_players_invalid',
  fee_required: 'listing_err_fee_required',
  fee_note_too_long: 'listing_err_fee_note_too_long',
  description_too_long: 'listing_err_description_too_long',
  formation_invalid: 'listing_err_formation_invalid',
  lineup_requires_team: 'listing_err_lineup_requires_team',
};

const LISTING_TYPE_KEYS: Record<ListingType, { title: TranslationKey; desc: TranslationKey; icon: 'person-outline' | 'shield-outline' | 'people-outline' }> = {
  individual: { title: 'listing_type_individual', desc: 'listing_typeDesc_individual', icon: 'person-outline' },
  opponent: { title: 'listing_type_opponent', desc: 'listing_typeDesc_opponent', icon: 'shield-outline' },
  players: { title: 'listing_type_players', desc: 'listing_typeDesc_players', icon: 'people-outline' },
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

const firstName = (name: string) => (name ? name.split(' ')[0] : '');

export default function CreateMatchScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const styles = createStyles(theme);

  // Adım 1: ilan türü. Adım 2: türe göre form.
  const [listingType, setListingType] = useState<ListingType | null>(null);
  const [step, setStep] = useState<'type' | 'form'>('type');

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
  const [format, setFormat] = useState<MatchFormat | null>(null);
  const [category, setCategory] = useState(MATCH_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [missingPlayers, setMissingPlayers] = useState(1);

  // Kapsam: kişisel ya da takım. Rakip ilanında takım zorunludur.
  const [scope, setScope] = useState<MatchScope>({ kind: 'personal' });
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]);
  const [teamsComplete, setTeamsComplete] = useState(true);
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const { access: accountAccess } = useAccountAccess();

  // Diziliş ve kadro (yalnızca takım ilanlarında kadro; bireysel ilanda diziliş/kadro yok).
  const [formation, setFormation] = useState<string | null>(null);
  const [members, setMembers] = useState<LineupCandidate[]>([]);
  const [assignments, setAssignments] = useState<LineupAssignment[]>([]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  // Ücret
  const [isPaid, setIsPaid] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeNote, setFeeNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const teamScope = scope.kind === 'team';
  const selectedTeamId = scope.kind === 'team' ? scope.teamId : null;
  const showsFormation = listingType !== null && listingType !== 'individual' && format !== null;
  const showsLineup = showsFormation && teamScope && formation !== null;
  const showsPositions = listingType === 'individual' || listingType === 'players';
  const showsMissing = listingType === 'players';
  const showsScopePicker = listingType === 'players';

  const slots: FormationSlot[] = useMemo(
    () => (format && formation ? getFormationSlots(format, formation) : []),
    [format, formation],
  );

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    void loadManagedTeams();
  }, []);

  // Seçili takımın kadrosu: profil adı ve pozisyonu ile birlikte.
  const loadMembers = async (teamId: string) => {
    const { data: rows, error } = await supabase
      .from('team_members')
      .select('user_id, position, jersey_number')
      .eq('team_id', teamId);
    if (error || !rows) {
      setMembers([]);
      return;
    }
    const userIds = rows.map((r: { user_id: string | null }) => r.user_id).filter((id): id is string => !!id);
    const profileById = new Map<string, { full_name: string | null; position: string | null }>();
    if (userIds.length > 0) {
      const { data: profileRows } = await profiles.publicProfiles(userIds, 'user_id, full_name, position');
      (profileRows ?? []).forEach((p: { user_id: string; full_name: string | null; position: string | null }) =>
        profileById.set(p.user_id, p),
      );
    }
    setMembers(
      rows
        .filter((r: { user_id: string | null }) => !!r.user_id)
        .map((r: { user_id: string | null; position: string | null; jersey_number: number | null }) => {
          const profile = profileById.get(r.user_id as string);
          return {
            user_id: r.user_id as string,
            name: profile?.full_name || t('match_defaultPlayerName'),
            position: profile?.position || r.position,
            jersey_number: r.jersey_number,
          };
        }),
    );
  };

  useEffect(() => {
    if (!selectedTeamId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMembers([]);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    void loadMembers(selectedTeamId);
  }, [selectedTeamId]);

  const resetLineup = () => {
    setAssignments([]);
    setPickerIndex(null);
  };

  const selectType = (type: ListingType) => {
    setListingType(type);
    setScope({ kind: 'personal' });
    setFormation(null);
    resetLineup();
    setStep('form');
  };

  const selectFormat = (value: MatchFormat) => {
    setFormat(value);
    if (formation && !isFormationForFormat(value, formation)) setFormation(null);
    resetLineup();
  };

  const selectFormation = (value: string | null) => {
    setFormation(value);
    resetLineup();
  };

  const selectScope = (next: MatchScope) => {
    setScope(next);
    resetLineup();
  };

  const togglePosition = (position: string) => {
    setPositions((prev) => (prev.includes(position) ? prev.filter((p) => p !== position) : [...prev, position]));
  };

  const handleAutoFill = () => {
    setAssignments(autoFillLineup(members, slots));
  };

  const assignPlayer = (index: number, candidate: LineupCandidate | null) => {
    setAssignments((prev) => {
      const next: LineupAssignment[] = slots.map((_, i) => prev[i] ?? null);
      // Aynı oyuncu iki slota konamaz: önce önceki yerinden çıkar.
      if (candidate) {
        for (let i = 0; i < next.length; i += 1) {
          if (next[i]?.user_id === candidate.user_id) next[i] = null;
        }
      }
      next[index] = candidate;
      return next;
    });
    setPickerIndex(null);
  };

  const seats: PitchSeat[] = slots.map((_, index) => {
    const member = assignments[index];
    return member ? { label: firstName(member.name), number: member.jersey_number ?? index + 1 } : null;
  });

  const selectedTeamName = managedTeams.find((tm) => tm.id === selectedTeamId)?.name ?? '';

  const selectedCity = TURKEY_CITIES.find((c) => c.name === city);
  const filteredCities = TURKEY_CITIES.filter((c) =>
    c.name.toLocaleLowerCase('tr-TR').includes(citySearch.toLocaleLowerCase('tr-TR')),
  );
  const filteredDistricts = (selectedCity?.districts ?? []).filter((d) =>
    d.toLocaleLowerCase('tr-TR').includes(districtSearch.toLocaleLowerCase('tr-TR')),
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
    if (!listingType) return;

    // Hesap durumu doğrulanmadıysa ya da ilgili kapsam kısıtlıysa yazma yapılmaz (fail closed).
    const writeAllowed = teamScope ? canWriteTeam(accountAccess) : canWriteProfile(accountAccess);
    if (!writeAllowed) {
      const restrictedTeam = teamScope && accountAccess?.verified && accountAccess.teamRestricted;
      setToast({ message: restrictedTeam ? t('account_teamWriteBlocked') : t('account_writeBlocked'), type: 'error' });
      return;
    }

    const parsedFee = feeAmount.trim() ? Number(feeAmount.trim().replace(',', '.')) : null;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setToast({ message: t('createMatch_needSession'), type: 'error' });
      return;
    }

    let lineup: ReturnType<typeof buildLineupEntries> = [];
    if (showsLineup && slots.length > 0) {
      try {
        lineup = buildLineupEntries(slots, assignments);
      } catch {
        setToast({ message: t('createMatch_createFailed'), type: 'error' });
        return;
      }
    }

    const built = buildListingRow({
      listingType,
      title,
      date: formatDateForSupabase(date),
      time: formatTimeForSupabase(time),
      location,
      city,
      district,
      format,
      category,
      description,
      positions: showsPositions ? positions : [],
      missingPlayers: showsMissing ? missingPlayers : null,
      teamId: listingType === 'individual' ? null : selectedTeamId,
      formation: showsFormation ? formation : null,
      lineup,
      isPaid,
      feePerPerson: isPaid ? parsedFee : null,
      feeNote,
      creatorId: user.id,
    });
    if (!built.ok) {
      setToast({ message: t(DRAFT_ERROR_KEYS[built.error]), type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const outcome = classifyMatchResult(await supabase.from('matches').insert(built.row), built.scope);
      if (outcome.status === 'failed') {
        if (__DEV__) console.log('İlan oluşturulamadı:', outcome.reason);
        setToast({ message: t(MATCH_FAILURE_KEYS[outcome.reason]), type: 'error' });
        setSaving(false);
        return;
      }

      sendLocalNotification(t('createMatch_createdNotifTitle'), `${title.trim()} ${t('createMatch_createdNotifBody')}`);
      setToast({ message: t('createMatch_createdToast'), type: 'success' });
      setTimeout(() => navigate('match'), 800);
    } catch (err) {
      if (__DEV__) console.log('İlan oluşturulurken beklenmeyen hata:', err);
      setToast({ message: t('createMatch_unexpectedError'), type: 'error' });
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 'form') {
      setStep('type');
      return;
    }
    navigate('match');
  };

  // ---------------------------------------------------------------------------------------------
  // Adım 1: ilan türü
  // ---------------------------------------------------------------------------------------------
  if (step === 'type') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('createMatch_title')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.stepTitle}>{t('listing_pickType')}</Text>
          {LISTING_TYPES.map((type) => {
            const meta = LISTING_TYPE_KEYS[type];
            return (
              <HapticTouchable key={type} style={styles.typeCard} onPress={() => selectType(type)}>
                <View style={styles.typeIcon}>
                  <Ionicons name={meta.icon} size={20} color={theme.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeCardTitle}>{t(meta.title)}</Text>
                  <Text style={styles.typeCardDesc}>{t(meta.desc)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </HapticTouchable>
            );
          })}
        </ScrollView>
        <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />
      </SafeAreaView>
    );
  }

  const isOpponent = listingType === 'opponent';
  const needsTeamPicker = isOpponent || (showsScopePicker && managedTeams.length > 0);

  // ---------------------------------------------------------------------------------------------
  // Adım 2: form
  // ---------------------------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{listingType ? t(LISTING_TYPE_KEYS[listingType].title) : t('createMatch_title')}</Text>
        </View>

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}>
          {/* Takım / kapsam */}
          {listingType === 'individual' ? null : (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t(isOpponent ? 'listing_teamLabel' : 'createMatch_scopeLabel')}</Text>
              <View style={styles.typeRow}>
                {showsScopePicker && (
                  <HapticTouchable
                    style={[styles.typePill, scope.kind === 'personal' && styles.typePillActive]}
                    onPress={() => selectScope({ kind: 'personal' })}
                  >
                    <Text style={[styles.typePillText, scope.kind === 'personal' && styles.typePillTextActive]}>
                      {t('listing_organizer')}
                    </Text>
                  </HapticTouchable>
                )}
                {needsTeamPicker &&
                  managedTeams.map((team) => (
                    <HapticTouchable
                      key={team.id}
                      style={[styles.typePill, scope.kind === 'team' && scope.teamId === team.id && styles.typePillActive]}
                      onPress={() => selectScope({ kind: 'team', teamId: team.id })}
                    >
                      <Text style={[styles.typePillText, scope.kind === 'team' && scope.teamId === team.id && styles.typePillTextActive]}>
                        {team.name}
                      </Text>
                    </HapticTouchable>
                  ))}
              </View>
              {isOpponent && teamsLoaded && managedTeams.length === 0 ? (
                <View style={styles.teamNeeded}>
                  <Text style={styles.scopeNote}>{t('listing_teamNone')}</Text>
                  <HapticTouchable style={styles.teamCreateBtn} onPress={() => navigate('teamEdit')}>
                    <Text style={styles.teamCreateText}>{t('listing_teamCreate')}</Text>
                  </HapticTouchable>
                </View>
              ) : (
                <Text style={styles.scopeNote}>
                  {teamScope ? t('createMatch_scopeTeamHint') : t('createMatch_scopePersonalHint')}
                </Text>
              )}
              {!teamsComplete && <Text style={styles.scopeNote}>{t('createMatch_teamsUnavailable')}</Text>}
              {showsScopePicker && teamsLoaded && teamsComplete && managedTeams.length === 0 && (
                <Text style={styles.scopeNote}>{t('createMatch_noTeamsHint')}</Text>
              )}
            </View>
          )}

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

          {/* Format */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('listing_formatLabel')}</Text>
            <View style={styles.typeRow}>
              {MATCH_FORMATS.map((value) => (
                <HapticTouchable
                  key={value}
                  style={[styles.typePill, format === value && styles.typePillActive]}
                  onPress={() => selectFormat(value)}
                >
                  <Text style={[styles.typePillText, format === value && styles.typePillTextActive]}>
                    {value}v{value}
                  </Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          {/* Pozisyonlar */}
          {showsPositions && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t(listingType === 'individual' ? 'listing_positionsLabel' : 'listing_positionsWanted')}
              </Text>
              <View style={styles.typeRow}>
                {POSITION_OPTIONS.map((position) => (
                  <HapticTouchable
                    key={position}
                    style={[styles.typePill, positions.includes(position) && styles.typePillActive]}
                    onPress={() => togglePosition(position)}
                  >
                    <Text style={[styles.typePillText, positions.includes(position) && styles.typePillTextActive]}>
                      {position}
                    </Text>
                  </HapticTouchable>
                ))}
              </View>
            </View>
          )}

          {/* Eksik oyuncu sayısı */}
          {showsMissing && format !== null && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('listing_missingLabel')}</Text>
              <View style={styles.stepper}>
                <HapticTouchable
                  style={styles.stepBtn}
                  onPress={() => setMissingPlayers((n) => Math.max(1, n - 1))}
                >
                  <Ionicons name="remove" size={18} color={theme.text} />
                </HapticTouchable>
                <Text style={styles.stepValue}>{missingPlayers}</Text>
                <HapticTouchable
                  style={styles.stepBtn}
                  onPress={() => setMissingPlayers((n) => Math.min(format - 1, n + 1))}
                >
                  <Ionicons name="add" size={18} color={theme.text} />
                </HapticTouchable>
              </View>
            </View>
          )}

          {/* Diziliş */}
          {showsFormation && format !== null && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('listing_formationLabel')}</Text>
              <View style={styles.typeRow}>
                <HapticTouchable
                  style={[styles.typePill, formation === null && styles.typePillActive]}
                  onPress={() => selectFormation(null)}
                >
                  <Text style={[styles.typePillText, formation === null && styles.typePillTextActive]}>
                    {t('listing_formationNone')}
                  </Text>
                </HapticTouchable>
                {FORMATIONS[format].map((name) => (
                  <HapticTouchable
                    key={name}
                    style={[styles.typePill, formation === name && styles.typePillActive]}
                    onPress={() => selectFormation(name)}
                  >
                    <Text style={[styles.typePillText, formation === name && styles.typePillTextActive]}>{name}</Text>
                  </HapticTouchable>
                ))}
              </View>
            </View>
          )}

          {/* Kadro (yalnızca takım ilanı + diziliş) */}
          {showsLineup && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('listing_lineupTitle')}</Text>
              <Text style={styles.scopeNote}>{selectedTeamName ? `${selectedTeamName} · ` : ''}{t('listing_lineupHint')}</Text>
              <View style={styles.lineupActions}>
                <HapticTouchable style={styles.lineupBtn} onPress={handleAutoFill} disabled={members.length === 0}>
                  <Ionicons name="flash-outline" size={14} color={theme.goldDark} />
                  <Text style={styles.lineupBtnText}>{t('listing_autoFill')}</Text>
                </HapticTouchable>
                <HapticTouchable style={styles.lineupBtn} onPress={() => setAssignments([])}>
                  <Ionicons name="trash-outline" size={14} color={theme.goldDark} />
                  <Text style={styles.lineupBtnText}>{t('listing_clearLineup')}</Text>
                </HapticTouchable>
              </View>
              {members.length === 0 && <Text style={styles.scopeNote}>{t('listing_noMembers')}</Text>}
              <View style={{ marginTop: 12 }}>
                <FormationPitch slots={slots} seats={seats} lang={lang} onSeatPress={(index) => setPickerIndex(index)} />
              </View>
            </View>
          )}

          {/* Ücret */}
          {listingType !== null && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('listing_feeLabel')}</Text>
              <View style={styles.typeRow}>
                <HapticTouchable style={[styles.typePill, !isPaid && styles.typePillActive]} onPress={() => setIsPaid(false)}>
                  <Text style={[styles.typePillText, !isPaid && styles.typePillTextActive]}>{t('listing_feeFree')}</Text>
                </HapticTouchable>
                <HapticTouchable style={[styles.typePill, isPaid && styles.typePillActive]} onPress={() => setIsPaid(true)}>
                  <Text style={[styles.typePillText, isPaid && styles.typePillTextActive]}>{t('listing_feePaid')}</Text>
                </HapticTouchable>
              </View>
              {isPaid && (
                <View style={{ marginTop: 12, gap: 12 }}>
                  <View>
                    <Text style={styles.inputLabel}>{t('listing_feeAmount')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="decimal-pad"
                      value={feeAmount}
                      onChangeText={setFeeAmount}
                    />
                  </View>
                  <View>
                    <Text style={styles.inputLabel}>{t('listing_feeNote')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('listing_feeNotePlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      maxLength={120}
                      value={feeNote}
                      onChangeText={setFeeNote}
                    />
                  </View>
                  <View style={styles.disclaimer}>
                    <Ionicons name="information-circle-outline" size={16} color={theme.goldDark} />
                    <Text style={styles.disclaimerText}>{t('listing_paymentDisclaimer')}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Kategori (mevcut) */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('createMatch_typeLabel')}</Text>
            <View style={styles.typeRow}>
              {MATCH_CATEGORIES.map((c) => (
                <HapticTouchable key={c} style={[styles.typePill, category === c && styles.typePillActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.typePillText, category === c && styles.typePillTextActive]}>{c}</Text>
                </HapticTouchable>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('listing_descLabel')}</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <HapticTouchable style={[styles.submitBtn, saving && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color={Paper.ink} /> : <Text style={styles.submitBtnText}>{t('match_createMatch')}</Text>}
          </HapticTouchable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Kadro koltuğu seçici */}
      <BottomSheet visible={pickerIndex !== null} onClose={() => setPickerIndex(null)} theme={theme} contentStyle={{ maxHeight: '75%' }}>
        <Text style={styles.modalTitle}>
          {pickerIndex !== null && slots[pickerIndex] ? roleLabel(slots[pickerIndex].role, lang) : t('listing_pickPlayer')}
        </Text>
        <HapticTouchable style={styles.listRow} onPress={() => pickerIndex !== null && assignPlayer(pickerIndex, null)}>
          <Ionicons name="close-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={styles.listRowText}>{t('listing_noPick')}</Text>
        </HapticTouchable>
        <FlatList
          data={members.filter((m) => !assignments.some((a, i) => a?.user_id === m.user_id && i !== pickerIndex))}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => (
            <HapticTouchable style={styles.listRow} onPress={() => pickerIndex !== null && assignPlayer(pickerIndex, item)}>
              <Text style={styles.listRowText}>{item.name}</Text>
              <Text style={styles.listRowMeta}>{item.position ?? ''}</Text>
            </HapticTouchable>
          )}
          style={styles.list}
        />
      </BottomSheet>

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
        <HapticTouchable style={styles.modalCancelBtn} onPress={() => setDistrictModalVisible(false)}>
          <Text style={styles.modalCancelText}>{t('match_giveUp')}</Text>
        </HapticTouchable>
      </BottomSheet>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />
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
    stepTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: theme.text, marginBottom: 4 },
    typeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    typeIcon: {
      width: 42,
      height: 42,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeCardTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text },
    typeCardDesc: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, marginTop: 3 },
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
    multiline: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
    inputDisabled: { backgroundColor: theme.card2 },
    inputValueText: { color: theme.text, fontSize: 14, fontFamily: FontFamily.mono },
    inputPlaceholderText: { color: theme.textSecondary, fontSize: 14, fontFamily: FontFamily.mono },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    scopeNote: { marginTop: 6, fontSize: 12, color: theme.textSecondary, fontFamily: FontFamily.body },
    teamNeeded: { marginTop: 8, gap: 10 },
    teamCreateBtn: {
      height: 44,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teamCreateText: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.goldDark },
    typePill: {
      flexGrow: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: RADIUS,
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    typePillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    typePillText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.textMuted },
    typePillTextActive: { color: Paper.ink },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: { fontFamily: FontFamily.display, fontSize: 20, color: theme.text, minWidth: 28, textAlign: 'center' },
    lineupActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    lineupBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 38,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    lineupBtnText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.goldDark },
    disclaimer: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    disclaimerText: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
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
    listRowPlate: { width: 28, fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.goldDark },
    listRowText: { fontSize: 14, fontFamily: FontFamily.mono, color: theme.text, flex: 1 },
    listRowMeta: { fontSize: 12, fontFamily: FontFamily.mono, color: theme.textMuted },
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
