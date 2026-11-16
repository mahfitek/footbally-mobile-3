import { classifyInteractionError, rejectMatchApplication } from '../lib/interactionGuard';
import { discoveryRpcClient } from '../lib/discoveryClient';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Share,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, Paper, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { sendLocalNotification } from '../lib/notifications';
import { notifyEvent } from '../lib/notify';
import { MATCH_COLUMNS } from '../lib/columns';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';
import BottomSheet from '../components/BottomSheet';
import MatchCard from '../components/MatchCard';
import {
  filterListings,
  formatOfListing,
  isPaidListing,
  listingTypeOf,
  LISTING_TYPE_SHORT_KEYS,
  LISTING_TYPES,
  type ListingFilter,
} from '../lib/matchListing';
import { MATCH_FORMATS, roleLabel, type LineupEntry, type MatchFormat } from '../lib/formations';

type MatchView = {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  city: string;
  required_players: number;
  type: string;
  category: string;
  creator_id: string;
  participantsCount: number;
  applied: boolean;
  rejected: boolean;
  myApplicationId: string | null;
  myResult: 'win' | 'loss' | 'draw' | null;
  myGoals: number;
  listing_type: string | null;
  match_format: number | null;
  team_payment: number | string | null;
  formation: string | null;
  fee_note: string | null;
  lineup: LineupEntry[] | null;
};

type Participant = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  application_id?: number | null;
  application_status?: string | null;
};

type TabKey = 'upcoming' | 'past' | 'applied' | 'mine';

const getTabs = (t: (key: any) => string): { key: TabKey; label: string }[] => [
  { key: 'upcoming', label: t('match_tabUpcoming') },
  { key: 'past', label: t('match_tabPast') },
  { key: 'applied', label: t('match_tabApplied') },
  { key: 'mine', label: t('match_tabMine') },
];

const getResultOptions = (
  t: (key: any) => string
): { key: 'win' | 'loss' | 'draw'; label: string; color: 'success' | 'error' | 'textSecondary' }[] => [
  { key: 'win', label: t('match_resultWin'), color: 'success' },
  { key: 'draw', label: t('match_resultDraw'), color: 'textSecondary' },
  { key: 'loss', label: t('match_resultLoss'), color: 'error' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  navigate: (screen: string) => void;
}

export default function MatchScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const TABS = getTabs(t);
  const RESULT_OPTIONS = getResultOptions(t);
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedScope, setLoadedScope] = useState<'active' | 'all'>('active');
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [listingFilter, setListingFilter] = useState<ListingFilter>('all');
  const [formatFilter, setFormatFilter] = useState<MatchFormat | 'all'>('all');
  const [myCity, setMyCity] = useState('');
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [selected, setSelected] = useState<MatchView | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [resultTarget, setResultTarget] = useState<MatchView | null>(null);
  const [resultChoice, setResultChoice] = useState<'win' | 'loss' | 'draw'>('win');
  const [goalsChoice, setGoalsChoice] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [ratingBusyFor, setRatingBusyFor] = useState<string | null>(null);



  // "Aktif İlanlar" (Yaklaşan) sekmesi için DB seviyesinde tarih filtresi;
  // diğer sekmeler (Geçmiş/Başvurulan/Benim Maçlarım) geçmiş tarihli maçlara
  // da ihtiyaç duyduğundan, o sekmelere ilk geçişte 'all' scope ayrıca çekilir.
  const fetchMatches = async (scope: 'active' | 'all', currentUserId: string | null) => {
    try {
      let query = supabase.from('matches').select(MATCH_COLUMNS).order('date', { ascending: true });
      if (scope === 'active') {
        query = query.gte('date', todayStr());
      }
      const { data, error } = await query;

      if (error) {
        if (__DEV__) console.log('Maçlar yüklenemedi:', error);
        if (!error.code) setToast({ message: t('match_loadFailed'), type: 'error' });
        setMatches([]);
        return;
      }

      const rows = data ?? [];
      const ids = rows.map((m: any) => m.id);
      let appRows: any[] = [];
      if (ids.length > 0) {
        const { data: apps } = await supabase
          .from('match_applications')
          .select('id, match_id, user_id, result, goals, status')
          .in('match_id', ids);
        appRows = apps ?? [];
      }

      setMatches(
        rows.map((m: any) => {
          const myApp = currentUserId ? appRows.find((a) => a.match_id === m.id && a.user_id === currentUserId) : null;
          return {
            id: m.id,
            title: m.title,
            date: m.date,
            time: m.time,
            location: m.location,
            city: m.city,
            required_players: m.required_players ?? 0,
            type: m.type,
            category: m.category ?? 'Eğlence',
            creator_id: m.creator_id,
            participantsCount: appRows.filter((a) => a.match_id === m.id).length,
            applied: !!myApp && myApp.status !== 'rejected',
            rejected: myApp?.status === 'rejected',
            myApplicationId: myApp?.id ?? null,
            myResult: myApp?.result ?? null,
            myGoals: myApp?.goals ?? 0,
            listing_type: m.listing_type ?? null,
            match_format: m.match_format ?? null,
            team_payment: m.team_payment ?? 0,
            formation: m.formation ?? null,
            fee_note: m.fee_note ?? null,
            lineup: Array.isArray(m.lineup) ? (m.lineup as LineupEntry[]) : null,
          };
        })
      );
      setLoadedScope(scope);
    } catch (err) {
      if (__DEV__) console.log('Maçlar yüklenirken beklenmeyen hata:', err);
      setMatches([]);
    }
  };

  useEffect(() => {
    if (activeTab !== 'upcoming' && loadedScope !== 'all') {
      setTabLoading(true);
      fetchMatches('all', userId).finally(() => setTabLoading(false));
    }
  }, [activeTab]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setUserId(user?.id ?? null);

      if (user) {
        const { data: profile } = await profiles.ownProfile('full_name, city');
        setMyName(profile?.full_name ?? '');
        setMyCity(profile?.city ?? '');
      }

      await fetchMatches('active', user?.id ?? null);
    } catch (err) {
      if (__DEV__) console.log('Maçlar yüklenirken beklenmeyen hata:', err);
      setMatches([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadInitial();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMatches(loadedScope, userId).finally(() => setRefreshing(false));
  };

  // İlan sahibi bir başvuruyu reddeder (onay sorulur). Başarıda satır "Reddedildi" olur.
  const handleRejectParticipant = (participant: Participant) => {
    if (!participant.application_id) return;
    const applicationId = participant.application_id;
    Alert.alert(t('application_rejectConfirmTitle'), t('application_rejectConfirmBody'), [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: t('application_rejectAction'),
        style: 'destructive',
        onPress: async () => {
          const outcome = await rejectMatchApplication(discoveryRpcClient, applicationId);
          if (outcome.ok) {
            setParticipants((prev) =>
              prev.map((p) => (p.application_id === applicationId ? { ...p, application_status: 'rejected' } : p)),
            );
            setToast({ message: t('application_rejectDone'), type: 'success' });
          } else if (outcome.reason === 'not_owner') {
            setToast({ message: t('application_notOwner'), type: 'error' });
          } else {
            setToast({ message: t('application_rejectFailed'), type: 'error' });
          }
        },
      },
    ]);
  };

  const loadParticipants = async (matchId: number) => {
    setLoadingParticipants(true);
    const { data: apps } = await supabase
      .from('match_applications')
      .select('id, user_id, status')
      .eq('match_id', matchId);
    const appRows = (apps ?? []) as { id: number; user_id: string; status: string | null }[];
    const userIds = appRows.map((a) => a.user_id).filter(Boolean);
    if (userIds.length === 0) {
      setParticipants([]);
      setLoadingParticipants(false);
      return;
    }
    const { data: participantProfiles } = await profiles.publicProfiles(userIds, 'user_id, full_name, avatar_url');
    setParticipants(
      ((participantProfiles ?? []) as Participant[]).map((p) => {
        const app = appRows.find((a) => a.user_id === p.user_id);
        return { ...p, application_id: app?.id ?? null, application_status: app?.status ?? null };
      }),
    );
    setLoadingParticipants(false);

    if (userId) {
      const { data: ratingRows } = await supabase
        .from('player_ratings')
        .select('rated_user_id, rating')
        .eq('match_id', matchId)
        .eq('rater_id', userId);
      const map: Record<string, number> = {};
      (ratingRows ?? []).forEach((r: any) => {
        map[r.rated_user_id] = r.rating;
      });
      setMyRatings(map);
    }
  };

  const submitRating = async (matchId: number, ratedUserId: string, rating: number) => {
    if (!userId || ratedUserId === userId) return;
    setRatingBusyFor(ratedUserId);
    setMyRatings((prev) => ({ ...prev, [ratedUserId]: rating }));
    const { error } = await supabase
      .from('player_ratings')
      .upsert(
        { match_id: matchId, rater_id: userId, rated_user_id: ratedUserId, rating, updated_at: new Date().toISOString() },
        { onConflict: 'match_id,rater_id,rated_user_id' }
      );
    setRatingBusyFor(null);
    if (error) {
      if (__DEV__) console.log('Oyuncu değerlendirilemedi:', error);
      setToast({ message: t('match_ratingSaveFailed'), type: 'error' });
    }
  };

  const openMatch = (match: MatchView) => {
    setSelected(match);
    loadParticipants(match.id);
  };

  const handleJoin = async (match: MatchView) => {
    if (!userId || match.applied || match.rejected || match.creator_id === userId) return;
    setJoining(true);
    try {
      const { data: inserted, error } = await supabase
        .from('match_applications')
        .insert({ match_id: match.id, user_id: userId, status: 'applied' })
        .select()
        .single();

      if (error) {
        if (__DEV__) console.log('Maça katılım kaydedilemedi:', error);
        const kind = classifyInteractionError(error);
        if (kind === 'application_rejected') {
          // Reddedilmiş başvuru: aynı ilana yeniden katılınamaz; etiket güncellenir.
          setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, rejected: true, applied: false } : m)));
          setSelected((prev) => (prev && prev.id === match.id ? { ...prev, rejected: true, applied: false } : prev));
        }
        const message =
          kind === 'blocked' ? t('block_interactionBlocked')
          : kind === 'application_rejected' ? t('application_reapplyBlocked')
          : t('match_joinFailed');
        setToast({ message, type: 'error' });
      } else {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === match.id
              ? { ...m, applied: true, participantsCount: m.participantsCount + 1, myApplicationId: inserted?.id ?? null }
              : m
          )
        );
        setSelected((prev) =>
          prev && prev.id === match.id
            ? { ...prev, applied: true, participantsCount: prev.participantsCount + 1, myApplicationId: inserted?.id ?? null }
            : prev
        );
        setToast({ message: t('match_joinSuccess'), type: 'success' });
        sendLocalNotification(t('match_joinedNotifTitle'), `${match.title} ${t('match_joinedNotifBody')}`);
        notifyEvent({ kind: 'match_join', matchId: match.id });
      }
    } catch (err) {
      if (__DEV__) console.log('Maça katılırken beklenmeyen hata:', err);
      setToast({ message: t('match_joinFailed'), type: 'error' });
    }
    setJoining(false);
  };

  const handleLeave = async (match: MatchView) => {
    if (!match.myApplicationId) return;
    setJoining(true);
    try {
      const { error } = await supabase.from('match_applications').delete().eq('id', match.myApplicationId);
      if (error) {
        if (__DEV__) console.log('Maçtan ayrılınamadı:', error);
        setToast({ message: t('match_leaveFailed'), type: 'error' });
      } else {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === match.id
              ? { ...m, applied: false, participantsCount: Math.max(0, m.participantsCount - 1), myApplicationId: null }
              : m
          )
        );
        setSelected((prev) =>
          prev && prev.id === match.id
            ? { ...prev, applied: false, participantsCount: Math.max(0, prev.participantsCount - 1), myApplicationId: null }
            : prev
        );
        setToast({ message: t('match_leaveSuccess'), type: 'success' });
      }
    } catch (err) {
      if (__DEV__) console.log('Maçtan ayrılırken beklenmeyen hata:', err);
      setToast({ message: t('match_leaveFailed'), type: 'error' });
    }
    setJoining(false);
  };

  const handleShare = async (match: MatchView) => {
    try {
      await Share.share({
        message: `${t('match_shareMessage')} ${match.title}\n${match.date} · ${match.time}\n${match.location}, ${match.city}\n\n${t('match_shareJoinFootbally')}`,
        title: match.title,
      });
    } catch {
      // user dismissed the share sheet; nothing to do
    }
  };

  const openInMaps = (match: MatchView) => {
    const query = encodeURIComponent(`${match.location}, ${match.city}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const openResultEntry = (match: MatchView) => {
    setResultTarget(match);
    setResultChoice(match.myResult ?? 'win');
    setGoalsChoice(match.myGoals ?? 0);
  };

  const saveResult = async () => {
    if (!resultTarget?.myApplicationId) return;
    setSavingResult(true);
    const { error } = await supabase
      .from('match_applications')
      .update({ result: resultChoice, goals: goalsChoice })
      .eq('id', resultTarget.myApplicationId);
    if (error) {
      if (__DEV__) console.log('Maç sonucu kaydedilemedi:', error);
      setToast({ message: t('match_resultSaveFailed'), type: 'error' });
    } else {
      setMatches((prev) =>
        prev.map((m) => (m.id === resultTarget.id ? { ...m, myResult: resultChoice, myGoals: goalsChoice } : m))
      );
      setToast({ message: t('match_resultSaveSuccess'), type: 'success' });
      setResultTarget(null);
    }
    setSavingResult(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.backBtn} />
            <Text style={styles.title}>{t('match_title')}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          <SkeletonCard height={130} />
          <SkeletonCard height={130} />
          <SkeletonCard height={130} />
        </View>
      </SafeAreaView>
    );
  }

  const today = todayStr();
  let filtered = matches.filter((m) => {
    if (activeTab === 'applied') return m.applied;
    if (activeTab === 'mine') return m.applied || m.creator_id === userId;
    if (activeTab === 'upcoming') return m.date >= today;
    return m.date < today;
  });
  if (nearbyOnly && myCity) {
    filtered = filtered.filter((m) => m.city.toLocaleLowerCase('tr-TR').includes(myCity.toLocaleLowerCase('tr-TR')));
  }
  filtered = filterListings(filtered, { listingType: listingFilter, format: formatFilter });

  const matchFormatText = (m: MatchView) => {
    const format = formatOfListing(m);
    return format ? `${format}v${format}` : m.type;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('home')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('match_title')}</Text>
        </View>
        <HapticTouchable style={[styles.createBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => navigate('createMatch')}>
          <Ionicons name="add" size={14} color={Paper.ink} />
          <Text style={styles.createBtnText}>{t('match_createMatch')}</Text>
        </HapticTouchable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollOuter} contentContainerStyle={styles.tabsScroll}>
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <HapticTouchable
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </HapticTouchable>
          ))}
        </View>
      </ScrollView>

      {myCity ? (
        <HapticTouchable
          style={[styles.nearbyChip, nearbyOnly && styles.nearbyChipActive]}
          onPress={() => setNearbyOnly((prev) => !prev)}
        >
          <Text style={[styles.nearbyChipText, nearbyOnly && styles.nearbyChipTextActive]}>
            {t('match_nearby')} ({myCity})
          </Text>
        </HapticTouchable>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollOuter} contentContainerStyle={styles.tabsScroll}>
        <View style={styles.tabs}>
          <HapticTouchable
            style={[styles.tabBtn, listingFilter === 'all' && styles.tabBtnActive]}
            onPress={() => setListingFilter('all')}
          >
            <Text style={[styles.tabText, listingFilter === 'all' && styles.tabTextActive]}>{t('listing_filterAll')}</Text>
          </HapticTouchable>
          {LISTING_TYPES.map((type) => (
            <HapticTouchable
              key={type}
              style={[styles.tabBtn, listingFilter === type && styles.tabBtnActive]}
              onPress={() => setListingFilter(type)}
            >
              <Text style={[styles.tabText, listingFilter === type && styles.tabTextActive]}>
                {t(LISTING_TYPE_SHORT_KEYS[type])}
              </Text>
            </HapticTouchable>
          ))}
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScrollOuter} contentContainerStyle={styles.tabsScroll}>
        <View style={styles.tabs}>
          <HapticTouchable
            style={[styles.tabBtn, formatFilter === 'all' && styles.tabBtnActive]}
            onPress={() => setFormatFilter('all')}
          >
            <Text style={[styles.tabText, formatFilter === 'all' && styles.tabTextActive]}>{t('listing_filterFormatAll')}</Text>
          </HapticTouchable>
          {MATCH_FORMATS.map((format) => (
            <HapticTouchable
              key={format}
              style={[styles.tabBtn, formatFilter === format && styles.tabBtnActive]}
              onPress={() => setFormatFilter(format)}
            >
              <Text style={[styles.tabText, formatFilter === format && styles.tabTextActive]}>
                {format}v{format}
              </Text>
            </HapticTouchable>
          ))}
        </View>
      </ScrollView>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >
        {tabLoading ? (
          <View style={{ paddingHorizontal: 24, gap: 14 }}>
            <SkeletonCard height={130} />
            <SkeletonCard height={130} />
          </View>
        ) : filtered.length === 0 ? (
          activeTab === 'upcoming' ? (
            <EmptyState
              icon="football-outline"
              title={t('match_emptyUpcomingTitle')}
              subtitle={t('match_emptyUpcomingSub')}
              actionLabel={t('match_createMatch')}
              onAction={() => navigate('createMatch')}
            />
          ) : activeTab === 'past' ? (
            <EmptyState
              icon="football-outline"
              title={t('match_emptyPastTitle')}
              subtitle={t('match_emptyPastSub')}
            />
          ) : activeTab === 'mine' ? (
            <EmptyState
              icon="football-outline"
              title={t('match_emptyMineTitle')}
              subtitle={t('match_emptyMineSub')}
              actionLabel={t('match_createMatch')}
              onAction={() => navigate('createMatch')}
            />
          ) : (
            <EmptyState
              icon="football-outline"
              title={t('match_emptyAppliedTitle')}
              subtitle={t('match_emptyAppliedSub')}
            />
          )
        ) : (
          <View style={styles.list}>
            {filtered.map((m) => {
              const isUpcoming = m.date >= today;
              const statusLabel = m.rejected ? t('application_rejectedLabel') : m.applied ? t('match_statusApplied') : isUpcoming ? t('match_statusUpcoming') : t('match_statusPast');
              const needsResult = m.applied && !isUpcoming && !m.myResult;
              const remainingSlots = m.required_players - m.participantsCount;
              const isUrgent = isUpcoming && !m.applied && remainingSlots > 0 && remainingSlots <= 2;
              const statusTone = m.applied ? 'solid' : isUpcoming ? 'soft' : 'muted';
              return (
                <MatchCard
                  key={m.id}
                  title={m.title}
                  date={m.date}
                  time={m.time}
                  location={m.location}
                  typeLabel={[
                    t(LISTING_TYPE_SHORT_KEYS[listingTypeOf(m)]),
                    matchFormatText(m),
                    isPaidListing(m) ? t('listing_paidBadge') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  categoryLabel={m.category}
                  participantsText={`${m.participantsCount}/${m.required_players}`}
                  status={{ label: statusLabel, tone: statusTone }}
                  urgentLabel={isUrgent ? `${t('match_urgentLast')} ${remainingSlots} ${t('match_urgentSpotsLeft')}` : undefined}
                  resultLabel={needsResult ? t('match_enterResult') : undefined}
                  onPress={() => openMatch(m)}
                  onResultPress={needsResult ? () => openResultEntry(m) : undefined}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={!!selected} onClose={() => setSelected(null)} theme={theme} contentStyle={{ maxHeight: '85%', paddingHorizontal: 0 }}>
        <ScrollView style={{ paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 12 }}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>{selected.title}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('match_detailDate')}</Text>
                  <Text style={styles.detailValue}>{selected.date} · {selected.time}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('match_detailLocation')}</Text>
                  <Text style={styles.detailValue}>{selected.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('match_detailCity')}</Text>
                  <Text style={styles.detailValue}>{selected.city}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('match_detailFormat')}</Text>
                  <Text style={styles.detailValue}>{matchFormatText(selected)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('listing_filterType')}</Text>
                  <Text style={styles.detailValue}>{t(LISTING_TYPE_SHORT_KEYS[listingTypeOf(selected)])}</Text>
                </View>
                {selected.formation ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('listing_formationLabel')}</Text>
                    <Text style={styles.detailValue}>{selected.formation}</Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('listing_feeLabel')}</Text>
                  <Text style={styles.detailValue}>
                    {isPaidListing(selected)
                      ? `${Number(selected.team_payment)} ₺${selected.fee_note ? ` · ${selected.fee_note}` : ''}`
                      : t('listing_feeFree')}
                  </Text>
                </View>
                {isPaidListing(selected) && (
                  <Text style={styles.detailValue}>{t('listing_paymentDisclaimer')}</Text>
                )}
                {selected.lineup && selected.lineup.length > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{t('listing_lineupHeader')}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      {selected.lineup.map((entry) => (
                        <Text key={entry.slot} style={styles.detailValue}>
                          {roleLabel(entry.slot.split('-')[0], lang === 'en' ? 'en' : 'tr')} · {entry.name}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{t('match_detailType')}</Text>
                  <Text style={styles.detailValue}>{selected.category}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.detailLabel}>{t('match_detailParticipants')}</Text>
                  <Text style={styles.detailValue}>
                    {selected.participantsCount}/{selected.required_players}
                  </Text>
                </View>

                <HapticTouchable style={[styles.mapBtn, { flexDirection: 'row', gap: 6, justifyContent: 'center' }]} onPress={() => openInMaps(selected)}>
                  <Ionicons name="map-outline" size={14} color={theme.text} />
                  <Text style={styles.mapBtnText}>{t('match_openInMaps')}</Text>
                </HapticTouchable>

                <Text style={styles.participantsHeader}>{t('match_participantsHeader')}</Text>
                {loadingParticipants ? (
                  <ActivityIndicator color={theme.gold} style={{ marginVertical: 12 }} />
                ) : participants.length === 0 ? (
                  <Text style={styles.noParticipantsText}>{t('match_noParticipants')}</Text>
                ) : (
                  <View style={styles.participantsList}>
                    {participants.map((p) => {
                      const canRate = selected.date < today && selected.applied && p.user_id !== userId;
                      const myRating = myRatings[p.user_id] ?? 0;
                      return (
                        <View key={p.user_id} style={styles.participantRow}>
                          <View style={styles.participantAvatar}>
                            {p.avatar_url ? (
                              <Image source={{ uri: p.avatar_url }} style={styles.participantAvatarImg} />
                            ) : (
                              <Ionicons name="person-outline" size={15} color={theme.gold} />
                            )}
                          </View>
                          <Text style={styles.participantName}>{p.full_name || t('match_defaultPlayerName')}</Text>
                          {selected.creator_id === userId && p.application_id ? (
                            p.application_status === 'rejected' ? (
                              <Text style={styles.participantRejectedText}>{t('application_rejectedLabel')}</Text>
                            ) : (
                              <HapticTouchable onPress={() => handleRejectParticipant(p)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                                <Text style={styles.participantRejectText}>{t('application_rejectAction')}</Text>
                              </HapticTouchable>
                            )
                          ) : null}
                          {canRate && (
                            <View style={styles.starRow}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <HapticTouchable
                                  key={n}
                                  onPress={() => submitRating(selected.id, p.user_id, n)}
                                  disabled={ratingBusyFor === p.user_id}
                                  hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                                >
                                  <Ionicons
                                    name={n <= myRating ? 'star' : 'star-outline'}
                                    size={15}
                                    color={theme.gold}
                                  />
                                </HapticTouchable>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {selected.creator_id === userId ? (
                  <View style={styles.ownerNotice}>
                    <Text style={styles.ownerNoticeText}>{t('match_ownerNotice')}</Text>
                  </View>
                ) : selected.applied ? (
                  <HapticTouchable
                    style={[styles.joinBtn, styles.leaveBtn]}
                    onPress={() => handleLeave(selected)}
                    disabled={joining}
                  >
                    {joining ? <ActivityIndicator color={theme.error} /> : (
                      <Text style={styles.leaveBtnText}>{t('match_leave')}</Text>
                    )}
                  </HapticTouchable>
                ) : (
                  <HapticTouchable
                    style={[
                      styles.joinBtn,
                      selected.participantsCount >= selected.required_players && styles.joinBtnDisabled,
                    ]}
                    onPress={() => handleJoin(selected)}
                    disabled={joining || selected.rejected || selected.participantsCount >= selected.required_players}
                  >
                    {joining ? (
                      <ActivityIndicator color={Paper.ink} />
                    ) : (
                      <Text style={styles.joinBtnText}>
                        {selected.rejected ? t('application_rejectedLabel') : selected.participantsCount >= selected.required_players ? t('match_full') : t('match_join')}
                      </Text>
                    )}
                  </HapticTouchable>
                )}

                <HapticTouchable style={[styles.shareBtn, { flexDirection: 'row', gap: 6, justifyContent: 'center' }]} onPress={() => handleShare(selected)}>
                  <Ionicons name="share-outline" size={13} color={theme.gold} />
                  <Text style={styles.shareBtnText}>{t('match_shareMatch')}</Text>
                </HapticTouchable>

                <HapticTouchable style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtnText}>{t('match_close')}</Text>
                </HapticTouchable>
              </>
            )}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={!!resultTarget} onClose={() => setResultTarget(null)} theme={theme}>
        <Text style={styles.modalTitle}>{resultTarget?.title} · {t('match_resultModalSuffix')}</Text>

        <Text style={styles.detailLabel}>{t('match_resultLabel')}</Text>
        <View style={styles.resultOptionsRow}>
          {RESULT_OPTIONS.map((opt) => (
            <HapticTouchable
              key={opt.key}
              style={[
                styles.resultOptionBtn,
                resultChoice === opt.key && { backgroundColor: theme[opt.color], borderColor: theme[opt.color] },
              ]}
              onPress={() => setResultChoice(opt.key)}
            >
              <Text
                style={[
                  styles.resultOptionText,
                  resultChoice === opt.key && { color: opt.key === 'draw' ? theme.text : Paper.ink },
                ]}
              >
                {opt.label}
              </Text>
            </HapticTouchable>
          ))}
        </View>

        <Text style={[styles.detailLabel, { marginTop: 16 }]}>{t('match_goalsLabel')}</Text>
        <View style={styles.goalsStepper}>
          <HapticTouchable style={styles.goalsBtn} onPress={() => setGoalsChoice((g) => Math.max(0, g - 1))}>
            <Text style={styles.goalsBtnText}>−</Text>
          </HapticTouchable>
          <Text style={styles.goalsValue}>{goalsChoice}</Text>
          <HapticTouchable style={styles.goalsBtn} onPress={() => setGoalsChoice((g) => Math.min(20, g + 1))}>
            <Text style={styles.goalsBtnText}>+</Text>
          </HapticTouchable>
        </View>

        <HapticTouchable style={[styles.joinBtn, { marginTop: 20 }]} onPress={saveResult} disabled={savingResult}>
          {savingResult ? <ActivityIndicator color={Paper.ink} /> : <Text style={styles.joinBtnText}>{t('match_save')}</Text>}
        </HapticTouchable>
        <HapticTouchable style={styles.closeBtn} onPress={() => setResultTarget(null)}>
          <Text style={styles.closeBtnText}>{t('match_giveUp')}</Text>
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
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 16,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    backBtn: {
      width: 40,
      height: 40,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { fontSize: 20, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    createBtn: {
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    createBtnText: { fontSize: 12, fontFamily: FontFamily.mono, color: Paper.ink },
    tabsScrollOuter: { flexGrow: 0, flexShrink: 0, marginBottom: 12 },
    tabsScroll: { paddingHorizontal: 24 },
    tabs: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 2,
    },
    tabBtn: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: RADIUS - 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabBtnActive: { backgroundColor: theme.gold },
    tabText: { fontSize: 12, fontFamily: FontFamily.monoMedium, color: theme.textSecondary },
    tabTextActive: { color: Paper.ink },
    nearbyChip: {
      alignSelf: 'flex-start',
      marginHorizontal: 24,
      marginBottom: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    nearbyChipActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    nearbyChipText: { fontSize: 12, fontFamily: FontFamily.monoMedium, color: theme.textSecondary },
    nearbyChipTextActive: { color: Paper.ink },
    list: { paddingHorizontal: 24, gap: 14 },
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
      maxHeight: '85%',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text, marginBottom: 16 },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    detailLabel: { fontSize: 12, fontFamily: FontFamily.mono, color: theme.textSecondary },
    detailValue: { fontSize: 13, color: theme.text, fontFamily: FontFamily.bodySemiBold },
    mapBtn: {
      marginTop: 14,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapBtnText: { fontSize: 13, fontFamily: FontFamily.mono, color: theme.text },
    participantsHeader: { fontSize: 13, fontFamily: FontFamily.display, letterSpacing: 0.3, color: theme.text, marginTop: 18, marginBottom: 10 },
    noParticipantsText: { fontSize: 12, fontFamily: FontFamily.mono, color: theme.textSecondary },
    participantsList: { gap: 8 },
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    participantAvatar: {
      width: 32,
      height: 32,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    participantAvatarImg: { width: 32, height: 32, borderRadius: RADIUS },
    participantName: { fontSize: 13, color: theme.text, fontFamily: FontFamily.bodySemiBold, flex: 1 },
    participantRejectText: { fontSize: 12, color: theme.error, fontFamily: FontFamily.monoMedium },
    participantRejectedText: { fontSize: 11, color: theme.textMuted, fontFamily: FontFamily.mono },
    starRow: { flexDirection: 'row', gap: 2 },
    ownerNotice: {
      marginTop: 18,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ownerNoticeText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.goldDark },
    joinBtn: {
      marginTop: 18,
      height: 52,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Dolu maç: opacity yerine gri zemin; metin koyu kaldığı için okunabilirlik korunur.
    joinBtnDisabled: { backgroundColor: theme.border },
    joinBtnText: { fontSize: 14, fontFamily: FontFamily.display, letterSpacing: 0.5, color: Paper.ink },
    leaveBtn: { backgroundColor: theme.card2, borderWidth: 1, borderColor: theme.error },
    leaveBtnText: { fontSize: 14, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.error },
    shareBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
    shareBtnText: { fontSize: 12, fontFamily: FontFamily.mono, color: theme.goldDark },
    closeBtn: { alignItems: 'center', paddingVertical: 10 },
    closeBtnText: { fontSize: 12, color: theme.textSecondary, fontFamily: FontFamily.mono },
    resultOptionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    resultOptionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: RADIUS,
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    resultOptionText: { fontSize: 13, fontFamily: FontFamily.monoMedium, color: theme.text },
    goalsStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 8 },
    goalsBtn: {
      width: 38,
      height: 38,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    goalsBtnText: { fontSize: 20, fontWeight: '700', color: theme.goldDark },
    goalsValue: { fontSize: 22, fontFamily: FontFamily.display, color: theme.text, width: 40, textAlign: 'center' },
  });
