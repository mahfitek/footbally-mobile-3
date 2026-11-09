import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, Paper, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import { sendMatchChallenge } from '../lib/challenges';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';
import BottomSheet from '../components/BottomSheet';
import { TURKEY_CITIES } from '../constants/turkeyCities';

type TeamRow = {
  id: string;
  name: string;
  city: string;
  district?: string | null;
  league: string;
  formation?: string | null;
  playing_style?: string[] | null;
  match_days?: string[] | null;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  isFake?: boolean;
};

const FAKE_TEAMS: TeamRow[] = [
  { id: 'fake-1', name: 'Kadıköy United FC', city: 'İstanbul', district: 'Kadıköy', league: 'Amatör Lig', formation: '4-3-3', wins: 8, losses: 3, draws: 2, rating: 72, playing_style: ['Hızlı Geçiş', 'Teknik'], match_days: ['Cumartesi', 'Pazar'], isFake: true },
  { id: 'fake-2', name: 'Beşiktaş Amatör', city: 'İstanbul', district: 'Beşiktaş', league: 'Süper Amatör', formation: '4-4-2', wins: 12, losses: 2, draws: 3, rating: 85, playing_style: ['Fiziksel', 'Savunma Ağırlıklı'], match_days: ['Cumartesi'], isFake: true },
  { id: 'fake-3', name: 'Ataşehir Spor', city: 'İstanbul', district: 'Ataşehir', league: 'İl Ligi', formation: '3-5-2', wins: 5, losses: 6, draws: 4, rating: 58, playing_style: ['Tiki-Taka'], match_days: ['Pazar'], isFake: true },
  { id: 'fake-4', name: 'Maltepe Gençlik', city: 'İstanbul', district: 'Maltepe', league: 'Amatör Lig', formation: '4-2-3-1', wins: 7, losses: 5, draws: 3, rating: 64, playing_style: ['Hücum Ağırlıklı', 'Hızlı Geçiş'], match_days: ['Cumartesi', 'Pazar'], isFake: true },
  { id: 'fake-5', name: 'Üsküdar SK', city: 'İstanbul', district: 'Üsküdar', league: 'Bölgesel', formation: '5-3-2', wins: 10, losses: 4, draws: 1, rating: 77, playing_style: ['Fiziksel', 'Savunma Ağırlıklı'], match_days: ['Pazar'], isFake: true },
  { id: 'fake-6', name: 'Pendik Yıldızları', city: 'İstanbul', district: 'Pendik', league: 'İlçe Ligi', formation: '4-3-3', wins: 3, losses: 8, draws: 4, rating: 45, playing_style: ['Teknik'], match_days: ['Cumartesi'], isFake: true },
  { id: 'fake-7', name: 'Ankara Gençlerbirliği Amatör', city: 'Ankara', district: 'Çankaya', league: 'Süper Amatör', formation: '4-4-2', wins: 9, losses: 3, draws: 3, rating: 74, playing_style: ['Tiki-Taka', 'Teknik'], match_days: ['Cumartesi', 'Pazar'], isFake: true },
  { id: 'fake-8', name: 'İzmir Karşıyaka Amatör', city: 'İzmir', district: 'Karşıyaka', league: 'Amatör Lig', formation: '3-4-3', wins: 6, losses: 5, draws: 4, rating: 61, playing_style: ['Hücum Ağırlıklı'], match_days: ['Pazar'], isFake: true },
];

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

function getForm(wins: number, losses: number, draws: number): ('W' | 'L' | 'D')[] {
  const pool: ('W' | 'L' | 'D')[] = [
    ...Array(wins).fill('W'),
    ...Array(losses).fill('L'),
    ...Array(draws).fill('D'),
  ];
  return pool.slice(0, 5);
}

type FilterKey = 'city' | 'district' | null;

interface Props {
  navigate: (screen: string, params?: any) => void;
  onBack?: () => void;
}

export default function FindOpponentScreen({ navigate, onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [myTeamName, setMyTeamName] = useState('');
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<number | null>(null);
  const [openFilter, setOpenFilter] = useState<FilterKey>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [challengeTarget, setChallengeTarget] = useState<TeamRow | null>(null);
  const [challengeDate, setChallengeDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [challengeTime, setChallengeTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [challengeLocation, setChallengeLocation] = useState('');
  const [sending, setSending] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    let ownTeamId: string | null = null;
    if (user) {
      const { data: myTeam } = await supabase.from('teams').select('id, name').eq('owner_id', user.id).maybeSingle();
      ownTeamId = myTeam?.id ?? null;
      setMyTeamId(ownTeamId);
      setMyTeamName(myTeam?.name ?? '');
    }
    await loadTeams(ownTeamId);
    setLoading(false);
    setRefreshing(false);
  };

  const loadTeams = async (ownTeamId: string | null) => {
    let query = supabase
      .from('teams')
      .select('id, name, city, district, league, formation, playing_style, match_days, wins, losses, draws, rating')
      .order('rating', { ascending: false });

    if (ownTeamId) query = query.neq('id', ownTeamId);

    const { data, error } = await query;
    if (error && __DEV__) console.log('Takımlar yüklenemedi:', error);

    const realTeams = (data as TeamRow[]) ?? [];
    setTeams([...realTeams, ...FAKE_TEAMS].sort((a, b) => b.rating - a.rating));
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const clearFilters = () => {
    setSelectedCity('');
    setSelectedDistrict('');
    setSelectedFormat(null);
  };

  const openChallenge = (team: TeamRow) => {
    if (!myTeamId) {
      setToast({ message: t('findOpponent_needOwnTeam'), type: 'error' });
      return;
    }
    setChallengeTarget(team);
    setChallengeDate(new Date());
    setChallengeTime(new Date());
    setChallengeLocation('');
  };

  const sendChallenge = async () => {
    if (!myTeamId || !challengeTarget) return;
    if (!challengeLocation.trim()) {
      setToast({ message: t('findOpponent_enterLocation'), type: 'error' });
      return;
    }

    setSending(true);
    try {
      if (!challengeTarget.isFake) {
        const { error } = await sendMatchChallenge(
          myTeamId,
          myTeamName,
          challengeTarget.id,
          challengeTarget.name,
          formatDateForSupabase(challengeDate),
          formatTimeForSupabase(challengeTime),
          challengeLocation.trim(),
          selectedFormat ? `${selectedFormat}v${selectedFormat}` : '11v11'
        );

        if (error) {
          setToast({ message: t('findOpponent_inviteFailed'), type: 'error' });
          setSending(false);
          return;
        }
      }

      sendLocalNotification(t('findOpponent_inviteSentTitle'), `${challengeTarget.name} ${t('findOpponent_inviteSentBody')}`);
      setToast({ message: t('findOpponent_inviteSentToast'), type: 'success' });
      setChallengeTarget(null);
    } catch (err) {
      if (__DEV__) console.log('Davet gönderilirken beklenmeyen hata:', err);
      setToast({ message: t('findOpponent_unexpectedError'), type: 'error' });
    }
    setSending(false);
  };

  const filteredTeams = teams.filter((team) => {
    if (selectedCity && team.city !== selectedCity) return false;
    if (selectedDistrict && team.district !== selectedDistrict) return false;
    return true;
  });

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => (onBack ? onBack() : navigate('home'))}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('findOpponent_title')}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          <SkeletonCard height={100} />
          <SkeletonCard height={100} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} colors={[theme.gold]} />
        }
      >
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => (onBack ? onBack() : navigate('home'))}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('findOpponent_title')}</Text>
        </View>

        <View style={styles.content}>
          {(selectedCity || selectedDistrict || selectedFormat !== null) && (
            <View style={styles.activeChipsRow}>
              {selectedCity && (
                <HapticTouchable style={styles.activeChip} onPress={() => { setSelectedCity(''); setSelectedDistrict(''); }}>
                  <Ionicons name="location" size={12} color={theme.gold} />
                  <Text style={styles.activeChipText}>{selectedCity}</Text>
                  <Ionicons name="close" size={13} color={theme.textSecondary} />
                </HapticTouchable>
              )}
              {selectedDistrict && (
                <HapticTouchable style={styles.activeChip} onPress={() => setSelectedDistrict('')}>
                  <Ionicons name="location" size={12} color={theme.gold} />
                  <Text style={styles.activeChipText}>{selectedDistrict}</Text>
                  <Ionicons name="close" size={13} color={theme.textSecondary} />
                </HapticTouchable>
              )}
              {selectedFormat !== null && (
                <HapticTouchable style={styles.activeChip} onPress={() => setSelectedFormat(null)}>
                  <Text style={styles.activeChipText}>{selectedFormat}v{selectedFormat}</Text>
                  <Ionicons name="close" size={13} color={theme.textSecondary} />
                </HapticTouchable>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[5, 7, 8, 11].map((n) => (
              <HapticTouchable
                key={n}
                onPress={() => setSelectedFormat(selectedFormat === n ? null : n)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: RADIUS,
                  alignItems: 'center',
                  backgroundColor: selectedFormat === n ? theme.gold : theme.card,
                  borderWidth: 1,
                  borderColor: selectedFormat === n ? theme.gold : theme.border,
                }}
              >
                <Text style={{ color: selectedFormat === n ? Paper.ink : theme.text, fontFamily: FontFamily.monoMedium, fontSize: 13 }}>{n}v{n}</Text>
              </HapticTouchable>
            ))}
          </View>

          <HapticTouchable
            style={[styles.filterBtn, { borderColor: selectedCity ? theme.gold : theme.border }]}
            onPress={() => setOpenFilter(openFilter === 'city' ? null : 'city')}
          >
            <Text style={[styles.filterBtnText, { color: selectedCity ? theme.gold : theme.textSecondary }]}>
              {selectedCity || t('findOpponent_selectCity')}
            </Text>
            <Ionicons name={openFilter === 'city' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
          </HapticTouchable>

          {openFilter === 'city' && (
            <View style={styles.dropdown}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 250 }}>
                <HapticTouchable
                  style={styles.dropdownRow}
                  onPress={() => {
                    setSelectedCity('');
                    setSelectedDistrict('');
                    setOpenFilter(null);
                  }}
                >
                  <Text style={styles.dropdownAllText}>{t('findOpponent_allCities')}</Text>
                </HapticTouchable>
                {TURKEY_CITIES.map((c) => (
                  <HapticTouchable
                    key={c.plate}
                    style={styles.dropdownRow}
                    onPress={() => {
                      setSelectedCity(c.name);
                      setSelectedDistrict('');
                      setOpenFilter(null);
                    }}
                  >
                    <Text style={styles.dropdownRowText}>{c.plate}. {c.name}</Text>
                    {selectedCity === c.name && <Text style={styles.checkmark}>✓</Text>}
                  </HapticTouchable>
                ))}
              </ScrollView>
            </View>
          )}

          {selectedCity && (
            <>
              <HapticTouchable
                style={[styles.filterBtn, { borderColor: selectedDistrict ? theme.gold : theme.border }]}
                onPress={() => setOpenFilter(openFilter === 'district' ? null : 'district')}
              >
                <Text style={[styles.filterBtnText, { color: selectedDistrict ? theme.gold : theme.textSecondary }]}>
                  {selectedDistrict || t('findOpponent_selectDistrict')}
                </Text>
                <Ionicons name={openFilter === 'district' ? 'chevron-up' : 'chevron-down'} size={14} color={theme.textSecondary} />
              </HapticTouchable>

              {openFilter === 'district' && (
                <View style={styles.dropdown}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                    <HapticTouchable
                      style={styles.dropdownRow}
                      onPress={() => {
                        setSelectedDistrict('');
                        setOpenFilter(null);
                      }}
                    >
                      <Text style={styles.dropdownAllText}>{t('findOpponent_allDistricts')}</Text>
                    </HapticTouchable>
                    {(TURKEY_CITIES.find((c) => c.name === selectedCity)?.districts ?? []).map((d) => (
                      <HapticTouchable
                        key={d}
                        style={styles.dropdownRow}
                        onPress={() => {
                          setSelectedDistrict(d);
                          setOpenFilter(null);
                        }}
                      >
                        <Text style={styles.dropdownRowText}>{d}</Text>
                        {selectedDistrict === d && <Text style={styles.checkmark}>✓</Text>}
                      </HapticTouchable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          )}

          {(selectedCity || selectedFormat !== null) && (
            <HapticTouchable style={styles.clearAllBtn} onPress={clearFilters}>
              <Text style={styles.clearText}>{t('findOpponent_clearFilters')}</Text>
            </HapticTouchable>
          )}
        </View>

        {filteredTeams.length === 0 ? (
          <EmptyState icon="shield-outline" title={t('findOpponent_notFound')} subtitle={t('findOpponent_tryDifferentFilters')} />
        ) : (
          <View style={styles.list}>
            {filteredTeams.map((team) => {
              const form = getForm(team.wins, team.losses, team.draws);
              return (
                <View key={team.id} style={styles.teamCard}>
                  <View style={styles.teamTop}>
                    <View style={styles.avatar}>
                      <Ionicons name="business-outline" size={22} color={theme.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamName}>{team.name}</Text>
                      <Text style={styles.teamMeta}>
                        {team.city}{team.district ? ` · ${team.district}` : ''} · {team.league}
                      </Text>
                    </View>
                    <Text style={styles.teamRecord}>{team.wins}G {team.draws}B {team.losses}M</Text>
                  </View>

                  <View style={styles.formRow}>
                    {form.length === 0 ? (
                      <Text style={styles.formEmpty}>{t('findOpponent_noFormData')}</Text>
                    ) : (
                      form.map((r, i) => (
                        <View
                          key={i}
                          style={[
                            styles.formPill,
                            r === 'W' && styles.formWin,
                            r === 'L' && styles.formLoss,
                            r === 'D' && styles.formDraw,
                          ]}
                        >
                          <Text style={styles.formPillText}>{r}</Text>
                        </View>
                      ))
                    )}
                  </View>

                  {((team.playing_style && team.playing_style.length > 0) || team.formation) && (
                    <View style={styles.tagsRow}>
                      {team.formation && (
                        <View style={styles.formationTag}>
                          <Text style={styles.formationTagText}>{team.formation}</Text>
                        </View>
                      )}
                      {team.playing_style?.map((s) => (
                        <View key={s} style={styles.styleTag}>
                          <Text style={styles.styleTagText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {team.match_days && team.match_days.length > 0 && (
                    <Text style={styles.matchDaysText}>{team.match_days.join(' · ')}</Text>
                  )}

                  <HapticTouchable style={styles.challengeBtn} onPress={() => openChallenge(team)}>
                    <Text style={styles.challengeBtnText}>{t('findOpponent_challenge')}</Text>
                  </HapticTouchable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={!!challengeTarget} onClose={() => setChallengeTarget(null)} theme={theme}>
        <Text style={styles.modalTitle}>{challengeTarget?.name} {t('findOpponent_challengeModalTitle')}</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('findOpponent_dateLabel')}</Text>
          <HapticTouchable style={styles.input} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.inputValueText}>
              {challengeDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </HapticTouchable>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('findOpponent_timeLabel')}</Text>
          <HapticTouchable style={styles.input} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.inputValueText}>
              {challengeTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </Text>
          </HapticTouchable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={challengeDate}
            mode="date"
            display="spinner"
            locale="tr-TR"
            minimumDate={new Date()}
            onChange={(_event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setChallengeDate(selectedDate);
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={challengeTime}
            mode="time"
            display="spinner"
            is24Hour
            onChange={(_event, selectedTime) => {
              setShowTimePicker(false);
              if (selectedTime) setChallengeTime(selectedTime);
            }}
          />
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('findOpponent_locationLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('findOpponent_locationPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={challengeLocation}
            onChangeText={setChallengeLocation}
          />
        </View>

        <HapticTouchable style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={sendChallenge} disabled={sending}>
          {sending ? <ActivityIndicator color={Paper.ink} /> : <Text style={styles.sendBtnText}>{t('findOpponent_sendInvite')}</Text>}
        </HapticTouchable>

        <HapticTouchable style={styles.cancelBtn} onPress={() => setChallengeTarget(null)}>
          <Text style={styles.cancelBtnText}>{t('findOpponent_giveUp')}</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
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
    title: { fontSize: 20, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    content: { paddingHorizontal: 24, marginBottom: 8 },
    activeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    activeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: hexToRgba(theme.gold, 0.12),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: PILL_RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    activeChipText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.text },
    filterBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
    },
    filterBtnText: { fontSize: 14, fontFamily: FontFamily.mono },
    dropdown: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    dropdownRow: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dropdownAllText: { color: theme.goldDark, fontSize: 14, fontFamily: FontFamily.mono },
    dropdownRowText: { color: theme.text, fontSize: 14, fontFamily: FontFamily.mono },
    checkmark: { color: theme.goldDark, fontWeight: '700' },
    clearAllBtn: { padding: 8, alignItems: 'center', marginBottom: 8 },
    clearText: { color: theme.error, fontSize: 13, fontFamily: FontFamily.mono },
    list: { paddingHorizontal: 24, gap: 14 },
    teamCard: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    teamTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teamName: { fontSize: 15, fontFamily: FontFamily.bodySemiBold, color: theme.text, marginBottom: 2 },
    teamMeta: { fontSize: 12, fontFamily: FontFamily.body, color: theme.textMuted },
    teamRecord: { fontSize: 12, fontFamily: FontFamily.monoMedium, color: theme.goldDark },
    formRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
    formEmpty: { fontSize: 12, fontFamily: FontFamily.mono, color: theme.textSecondary },
    formPill: {
      width: 24,
      height: 24,
      borderRadius: RADIUS - 3,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    formWin: { backgroundColor: theme.card2, borderColor: theme.success },
    formLoss: { backgroundColor: theme.card2, borderColor: theme.error },
    formDraw: { backgroundColor: theme.card2, borderColor: theme.border },
    formPillText: { fontSize: 11, fontFamily: FontFamily.monoMedium, color: theme.text },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    formationTag: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    formationTagText: { fontSize: 11, fontFamily: FontFamily.monoMedium, color: theme.goldDark },
    styleTag: {
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    styleTagText: { fontSize: 11, color: theme.text, fontFamily: FontFamily.bodySemiBold },
    matchDaysText: { fontSize: 12, fontFamily: FontFamily.body, color: theme.textMuted, marginBottom: 12 },
    challengeBtn: {
      height: 44,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    challengeBtnText: { fontSize: 14, fontFamily: FontFamily.bodySemiBold, color: Paper.ink },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      padding: 24,
      paddingBottom: 36,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text, marginBottom: 16 },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 11, color: theme.textSecondary, fontFamily: FontFamily.mono, letterSpacing: 1, marginBottom: 8 },
    input: {
      height: 52,
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
    inputValueText: { color: theme.text, fontSize: 14, fontFamily: FontFamily.mono },
    sendBtn: {
      height: 52,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    sendBtnText: { fontSize: 14, fontFamily: FontFamily.display, color: Paper.ink, letterSpacing: 1 },
    cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
    cancelBtnText: { fontSize: 12, fontFamily: FontFamily.mono, color: theme.textMuted },
  });
