import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, Paper, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { notifyUser } from '../lib/notify';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

const filters = ['Tümü', 'Forvet', 'Orta Saha', 'Defans', 'Kaleci'];

type PlayerView = {
  id: string;
  name: string;
  position: string;
  age: number | string;
  city: string;
  score: number;
};

type ScoutViewer = {
  id: string;
  name: string;
  role: string;
  icon: IoniconName;
  online: boolean;
};

const SCOUT_VIEWERS: ScoutViewer[] = [
  { id: 'v1', name: 'Mehmet Yılmaz', role: 'Galatasaray Scout', icon: 'business-outline', online: true },
  { id: 'v2', name: 'Hans Mueller', role: 'Bundesliga Scout', icon: 'globe-outline', online: false },
  { id: 'v3', name: 'Ahmet Demir', role: 'Trabzonspor Akademi', icon: 'flash-outline', online: true },
];

const MIN_AGE = 14;
const MAX_AGE = 45;

interface Props {
  navigate: (screen: string, params?: any) => void;
}

export default function ScoutScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [onlineScoutsOnly, setOnlineScoutsOnly] = useState(false);
  const [ageRange, setAgeRange] = useState<[number, number]>([MIN_AGE, MAX_AGE]);
  const [players, setPlayers] = useState<PlayerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState('');
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const isPremiumActive = isPremium && (!premiumUntil || new Date(premiumUntil) > new Date());
  const FREE_PREVIEW_COUNT = 2;

  useEffect(() => {
    loadPlayers();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setViewerId(session.user.id);
      setIsPremium(!!session.user.user_metadata?.premium);
      setPremiumUntil(session.user.user_metadata?.premium_until ?? null);
      supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => setViewerName(data?.full_name ?? ''));
    });
  }, []);

  const recordProfileView = (player: PlayerView) => {
    if (player.id === viewerId) return;
    notifyUser(player.id, 'eye-outline', `${viewerName || t('scout_defaultViewerName')} ${t('scout_viewedNotifBody')}`, 'profile', t('scout_viewedNotifTitle'), 'scout');
  };

  const requestConnection = async (player: PlayerView) => {
    if (!viewerId || player.id === viewerId || requestedIds.has(player.id)) return;
    const { error } = await supabase
      .from('connections')
      .insert({ requester_id: viewerId, target_id: player.id, status: 'pending' });

    if (error) {
      if (error.code === '23505') {
        setRequestedIds((prev) => new Set(prev).add(player.id));
        setToast({ message: t('scout_alreadyRequested'), type: 'error' });
      } else {
        if (__DEV__) console.log('Bağlantı isteği gönderilemedi:', error);
        setToast({ message: t('scout_requestFailed'), type: 'error' });
      }
      return;
    }

    setRequestedIds((prev) => new Set(prev).add(player.id));
    notifyUser(
      player.id,
      'person-add-outline',
      `${viewerName || t('common_defaultUser')} ${t('scout_connectionRequestNotifBody')}`,
      'messages',
      t('scout_connectionRequestNotifTitle'),
      'scout'
    );
    setToast({ message: t('scout_requestSent'), type: 'success' });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPlayers();
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, position, age, city, score')
        .order('score', { ascending: false });

      if (error) {
        if (__DEV__) console.log('Oyuncular yüklenemedi:', error);
        setPlayers([]);
      } else {
        setPlayers(
          (data ?? []).map((p: any) => ({
            id: p.user_id,
            name: p.full_name ?? t('teamProfile_unnamedPlayer'),
            position: p.position ?? '-',
            age: p.age ?? '-',
            city: p.city ?? '-',
            score: p.score ?? 0,
          }))
        );
      }
    } catch (err) {
      if (__DEV__) console.log('Oyuncular yüklenirken beklenmeyen hata:', err);
      setPlayers([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.backBtn} />
          <Text style={styles.title}>{t('scout_title')}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
        </View>
      </SafeAreaView>
    );
  }

  const query = search.trim().toLowerCase();
  const filteredPlayers = players.filter((p) => {
    if (activeFilter !== 'Tümü' && p.position !== activeFilter) return false;
    if (typeof p.age === 'number' && (p.age < ageRange[0] || p.age > ageRange[1])) return false;
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.position.toLowerCase().includes(query) ||
      p.city.toLowerCase().includes(query)
    );
  });

  const visibleScoutViewers = SCOUT_VIEWERS.filter((s) => !onlineScoutsOnly || s.online);

  const handleNearbyMatchesPress = () => {
    setNearbyOnly((prev) => !prev);
    setToast({ message: t('scout_nearbyComingSoon'), type: 'success' });
  };

  const adjustAge = (index: 0 | 1, delta: number) => {
    setAgeRange((prev) => {
      const next: [number, number] = [...prev];
      const updated = Math.min(MAX_AGE, Math.max(MIN_AGE, prev[index] + delta));
      next[index] = updated;
      if (next[0] > next[1]) {
        if (index === 0) next[1] = next[0];
        else next[0] = next[1];
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
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
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('home')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <Text style={styles.title}>{t('scout_title')}</Text>
        </View>

        {/* Beni İnceleyen Scoutlar */}
        <View style={styles.viewersHeader}>
          <Text style={styles.viewersHeaderText}>
            {SCOUT_VIEWERS.length} {t('scout_scoutsViewedProfile')}
          </Text>
          <HapticTouchable onPress={() => setOnlineScoutsOnly((prev) => !prev)}>
            <View style={[styles.onlineToggle, onlineScoutsOnly && styles.onlineToggleActive]}>
              <Text style={[styles.onlineToggleText, onlineScoutsOnly && styles.onlineToggleTextActive]}>
                {t('scout_onlineScouts')}
              </Text>
            </View>
          </HapticTouchable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={styles.viewersRow}
        >
          {visibleScoutViewers.map((s) => (
            <View key={s.id} style={styles.viewerCard}>
              <View style={styles.viewerAvatarWrap}>
                <View style={styles.viewerAvatar}>
                  <Ionicons name={s.icon} size={19} color={theme.gold} />
                </View>
                {s.online && <View style={styles.viewerOnlineDot} />}
              </View>
              <Text style={styles.viewerName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.viewerRole} numberOfLines={1}>{s.role}</Text>
              <HapticTouchable
                style={styles.viewerMsgBtn}
                onPress={() => navigate('chat', { id: s.id, name: s.name })}
              >
                <Text style={styles.viewerMsgBtnText}>{t('scout_sendMessage')}</Text>
              </HapticTouchable>
            </View>
          ))}
        </ScrollView>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={15} color={theme.textSecondary} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('scout_searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={styles.filters}
        >
          <HapticTouchable
            style={[styles.pill, nearbyOnly && styles.pillActive]}
            onPress={handleNearbyMatchesPress}
          >
            <Text style={[styles.pillText, nearbyOnly && styles.pillTextActive]}>
              {t('scout_nearbyMatches')}
            </Text>
          </HapticTouchable>
          {filters.map((f) => (
            <HapticTouchable
              key={f}
              style={[styles.pill, activeFilter === f && styles.pillActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.pillText, activeFilter === f && styles.pillTextActive]}>
                {f}
              </Text>
            </HapticTouchable>
          ))}
        </ScrollView>

        <View style={styles.ageRangeCard}>
          <Text style={styles.ageRangeLabel}>{t('scout_ageRange')}</Text>
          <View style={styles.ageRangeRow}>
            <View style={styles.ageStepper}>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(0, -1)}>
                <Text style={styles.ageStepBtnText}>−</Text>
              </HapticTouchable>
              <Text style={styles.ageStepValue}>{ageRange[0]}</Text>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(0, 1)}>
                <Text style={styles.ageStepBtnText}>+</Text>
              </HapticTouchable>
            </View>
            <Text style={styles.ageRangeDash}>—</Text>
            <View style={styles.ageStepper}>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(1, -1)}>
                <Text style={styles.ageStepBtnText}>−</Text>
              </HapticTouchable>
              <Text style={styles.ageStepValue}>{ageRange[1]}</Text>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(1, 1)}>
                <Text style={styles.ageStepBtnText}>+</Text>
              </HapticTouchable>
            </View>
          </View>
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Ionicons name="hardware-chip-outline" size={15} color={theme.gold} />
            <Text style={styles.aiLabel}>{t('scout_aiSuggestion')}</Text>
          </View>
          <Text style={styles.aiText}>{t('scout_notEnoughData')}</Text>
        </View>

        {filteredPlayers.length === 0 ? (
          <EmptyState icon="search-outline" title={t('scout_notFound')} subtitle={t('scout_tryDifferentFilters')} />
        ) : (
          <View style={styles.list}>
            {(isPremiumActive ? filteredPlayers : filteredPlayers.slice(0, FREE_PREVIEW_COUNT)).map((p) => (
              <HapticTouchable key={p.id} style={styles.playerCard} onPress={() => recordProfileView(p)}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={22} color={theme.gold} />
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <Text style={styles.playerMeta}>
                    {p.position} · {p.age} {t('teamProfile_ageSuffix')} · {p.city}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <HapticTouchable
                      style={styles.contactBtn}
                      onPress={() => navigate('chat', { id: p.id, name: p.name })}
                    >
                      <Text style={styles.contactBtnText}>{t('scout_contact')}</Text>
                    </HapticTouchable>
                    <HapticTouchable
                      style={[styles.contactBtn, requestedIds.has(p.id) && styles.contactBtnDisabled]}
                      onPress={() => requestConnection(p)}
                      disabled={requestedIds.has(p.id)}
                    >
                      <Text style={styles.contactBtnText}>
                        {requestedIds.has(p.id) ? t('scout_requestedLabel') : t('scout_requestConnection')}
                      </Text>
                    </HapticTouchable>
                  </View>
                </View>
                <Text style={styles.playerScore}>{p.score}</Text>
              </HapticTouchable>
            ))}

            {!isPremiumActive && filteredPlayers.length > FREE_PREVIEW_COUNT && (
              <View style={styles.lockedCard}>
                <View style={styles.lockedIconWrap}>
                  <Ionicons name="lock-closed" size={20} color={theme.gold} />
                </View>
                <Text style={styles.lockedBadge}>{t('scout_premiumRequired')}</Text>
                <Text style={styles.lockedTitle}>+{filteredPlayers.length - FREE_PREVIEW_COUNT} {t('scout_morePlayersLocked')}</Text>
                <Text style={styles.lockedSubtitle}>
                  {t('scout_lockedSubtitle')}
                </Text>
                <HapticTouchable style={styles.lockedBtn} onPress={() => navigate('premium')}>
                  <Text style={styles.lockedBtnText}>{t('scout_upgrade')}</Text>
                </HapticTouchable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
      paddingBottom: 20,
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
    title: { fontFamily: FontFamily.display, fontSize: 20, color: theme.text, letterSpacing: 0.5 },
    viewersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 12,
    },
    viewersHeaderText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.text, flex: 1 },
    onlineToggle: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    onlineToggleActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    onlineToggleText: { fontFamily: FontFamily.monoMedium, fontSize: 10, color: theme.textSecondary },
    onlineToggleTextActive: { color: Paper.ink },
    viewersRow: { paddingHorizontal: 24, gap: 12, marginBottom: 24 },
    viewerCard: {
      width: 140,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    viewerAvatarWrap: { position: 'relative', marginBottom: 8 },
    viewerAvatar: {
      width: 42,
      height: 42,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerOnlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: theme.success,
      borderWidth: 2,
      borderColor: theme.card,
    },
    viewerName: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.text, textAlign: 'center' },
    viewerRole: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: 10 },
    viewerMsgBtn: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    viewerMsgBtnText: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.gold },
    ageRangeCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ageRangeLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 1, marginBottom: 12 },
    ageRangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    ageRangeDash: { color: theme.textSecondary, fontSize: 14 },
    ageStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    ageStepBtn: {
      width: 30,
      height: 30,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    ageStepBtnText: { fontSize: 16, fontWeight: '700', color: theme.gold },
    ageStepValue: { fontFamily: FontFamily.monoMedium, fontSize: 15, color: theme.text, width: 28, textAlign: 'center' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 24,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 18,
    },
    searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 14, color: theme.text },
    filters: { paddingHorizontal: 24, gap: 10, marginBottom: 20 },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    pillText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted },
    pillTextActive: { color: Paper.ink },
    aiCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    aiLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.gold, letterSpacing: 1.5 },
    aiText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text, lineHeight: 22 },
    list: { paddingHorizontal: 24, gap: 14 },
    playerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playerInfo: { flex: 1 },
    playerName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, marginBottom: 2 },
    playerMeta: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginBottom: 10 },
    contactBtn: {
      alignSelf: 'flex-start',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    contactBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
    contactBtnDisabled: { borderColor: theme.border, opacity: 0.6 },
    playerScore: { fontFamily: FontFamily.display, fontSize: 20, color: theme.gold },
    lockedCard: {
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    lockedIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: hexToRgba(theme.gold, 0.16),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    lockedBadge: {
      fontFamily: FontFamily.monoMedium,
      fontSize: 10,
      letterSpacing: 1.5,
      color: theme.gold,
      marginBottom: 8,
    },
    lockedTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: theme.text, marginBottom: 6, textAlign: 'center' },
    lockedSubtitle: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 18,
    },
    lockedBtn: {
      backgroundColor: theme.gold,
      borderRadius: PILL_RADIUS,
      paddingHorizontal: 24,
      paddingVertical: 13,
    },
    lockedBtnText: { fontFamily: FontFamily.display, fontSize: 13, color: theme.bg, letterSpacing: 1 },
  });
