import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Animated,
  RefreshControl,
  Easing,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { hexToRgba, Theme, CARD_RADIUS, PILL_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { TranslationKey } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { NOTIFICATION_COLUMNS } from '../lib/columns';
import { fetchPremiumStatus, INACTIVE_PREMIUM } from '../lib/premium';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';
import TournamentTeaser from '../components/TournamentTeaser';

type IoniconName = keyof typeof Ionicons.glyphMap;
const RADIUS = CARD_RADIUS;

const GRID_ICONS: Record<string, IoniconName> = {
  '📈': 'trending-up-outline',
  '⏱️': 'time-outline',
  '🎯': 'flag-outline',
  '⭐': 'star-outline',
  '🤖': 'hardware-chip-outline',
  '🔍': 'search-outline',
};

type MatchItem = {
  id: string;
  icon: IoniconName;
  name: string;
  date: string;
  time: string;
  location: string;
  tag: string;
};

type NotificationItem = {
  id: string;
  msg: string;
  time: string;
  unread: boolean;
};

// Uygulamanın asıl akışını belirleyen 4 temel keşif akışı — Ana Sayfa'da diğer
// kısayollardan daha belirgin gösterilir.
const getDiscoverItems = (t: (key: TranslationKey) => string): { key: string; icon: IoniconName; title: string; sub: string; screen: string; colorKey: 'gold' | 'purple' }[] => [
  { key: 'players', icon: 'people-outline', title: t('discover_players'), sub: t('discover_playersSub'), screen: 'scout', colorKey: 'gold' },
  { key: 'teams', icon: 'shield-outline', title: t('discover_teams'), sub: t('discover_teamsSub'), screen: 'findOpponent', colorKey: 'purple' },
  { key: 'matchSeekers', icon: 'football-outline', title: t('discover_matchSeekers'), sub: t('discover_matchSeekersSub'), screen: 'match', colorKey: 'purple' },
  { key: 'playerSeekers', icon: 'search-outline', title: t('discover_playerSeekers'), sub: t('discover_playerSeekersSub'), screen: 'findPlayer', colorKey: 'gold' },
];

const getGridItems = (t: (key: TranslationKey) => string) => [
  { icon: '⏱️' as const, title: t('matchAnalysis'), sub: t('home_gridMatchAnalysisSub'), screen: 'match' },
  { icon: '⭐' as const, title: t('opportunities'), sub: t('home_gridOpportunitiesSub'), screen: 'activities' },
  { icon: '🤖' as const, title: t('aiAnalysis'), sub: t('home_gridAiSub'), screen: 'ai' },
  { icon: '🔍' as const, title: t('scoutNetwork'), sub: t('home_gridScoutSub'), screen: 'scout' },
];

const getGreeting = (t: (key: TranslationKey) => string) => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return t('home_goodMorning');
  if (hour >= 12 && hour < 18) return t('home_goodAfternoon');
  return t('home_goodEvening');
};

const formatRelativeTime = (iso: string, t: (key: TranslationKey) => string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('time_now');
  if (minutes < 60) return `${minutes} ${t('time_minutesAgoSuffix')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t('time_hoursAgoSuffix')}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return t('time_yesterday');
  return `${days} ${t('time_daysAgoSuffix')}`;
};

interface Props {
  navigate: (screen: string) => void;
  userId?: string | null;
}

export default function HomeScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const unreadCount = notifications.filter((n) => n.unread).length;
  const isPremiumActive = isPremium && (!premiumUntil || new Date(premiumUntil) > new Date());
  // Gün, ekran ilk açıldığında sabitlenir; render sırasında saat okunmaz (saf render).
  const [dayIndex] = useState(() => Math.floor(Date.now() / 86400000));
  const gridItems = getGridItems(t);
  const [scoreAnim] = useState(() => new Animated.Value(0));
  const [scoreCountAnim] = useState(() => new Animated.Value(0));
  const [gridAnims] = useState(() => gridItems.map(() => new Animated.Value(0)));

  useEffect(() => {
    Animated.timing(scoreAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.stagger(
      50,
      gridAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  useEffect(() => {
    if (loading) return;
    const listenerId = scoreCountAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
    Animated.timing(scoreCountAnim, {
      toValue: score,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => scoreCountAnim.removeListener(listenerId);
  }, [loading, score]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const uid = userId ?? user?.id ?? null;
    if (uid) {
      // Premium durumu sunucudan (subscriptions) okunur; user_metadata istemci tarafından yazılabilir.
      const status = await fetchPremiumStatus(uid).catch(() => INACTIVE_PREMIUM);
      setIsPremium(status.active);
      setPremiumUntil(status.until);

      // Skor ve görev durumları tek kaynaktan (sunucu) gelir. Önce yeniden hesaplanır, sonra okunur.
      const { error: refreshError } = await profiles.refreshMyScore();
      if (refreshError) {
        console.warn('Skor yenilenemedi (refresh_my_score):', refreshError.message);
        setToast({ message: t('profile_scoreRefreshFailed'), type: 'error' });
      }

      const { data } = await profiles.ownProfile('full_name, score');
      if (data) setName(data.full_name ?? '');

      setScore(data?.score ?? 0);
    }
    setLoading(false);
  };

  const loadUpcomingMatches = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('matches')
        .select('id, title, date, time, location')
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(2);

      if (error || !data) {
        if (__DEV__ && error) console.log('Maçlar yüklenemedi:', error);
        setMatches([]);
        return;
      }

      setMatches(
        data.map((m: any) => ({
          id: m.id,
          icon: 'football-outline' as IoniconName,
          name: m.title,
          date: m.date,
          time: m.time,
          location: m.location,
          tag: t('home_upcomingTag'),
        }))
      );
    } catch (err) {
      if (__DEV__) console.log('Maçlar yüklenirken beklenmeyen hata:', err);
      setMatches([]);
    }
  };

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(NOTIFICATION_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data) {
        if (__DEV__ && error) console.log('Bildirimler yüklenemedi:', error);
        setNotifications([]);
        return;
      }

      setNotifications(
        data.map((n: any) => ({
          id: String(n.id),
          msg: n.message ?? n.msg ?? '',
          time: formatRelativeTime(n.created_at, t),
          unread: !n.read,
        }))
      );
    } catch (err) {
      if (__DEV__) console.log('Bildirimler yüklenirken beklenmeyen hata:', err);
      setNotifications([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadUpcomingMatches(), loadNotifications()]).finally(() => setRefreshing(false));
  };

  const firstName = name.trim() ? name.trim().split(' ')[0] : '';

  useEffect(() => {
    loadProfile();
    loadUpcomingMatches();
    loadNotifications();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 24, gap: 12 }}>
          <SkeletonCard height={100} />
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >

        <View style={styles.topStrip}>
          <Text style={styles.topStripText}>FOOTBALLY</Text>
          <Text style={styles.topStripText}>
            {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>{getGreeting(t).toUpperCase()}</Text>
              {isPremiumActive && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>{t('premium').toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={styles.greetingName}>
              {firstName ? (
                <>
                  {t('hello')} <Text style={styles.gold}>{firstName}</Text>
                </>
              ) : (
                t('hello')
              )}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <HapticTouchable style={styles.notifBtn} onPress={() => navigate('search')}>
              <Ionicons name="search-outline" size={19} color={theme.text} />
            </HapticTouchable>
            <HapticTouchable style={styles.notifBtn} onPress={() => navigate('notifications')}>
              <Ionicons name="notifications-outline" size={19} color={theme.text} />
              {unreadCount > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </HapticTouchable>
          </View>
        </View>

        <TournamentTeaser />
        {/* SAHADAN_SECTION */}

        {/* Matches */}
        <SectionHeader
          title={t('upcomingMatches')}
          actionLabel={t('common_all')}
          onAction={() => navigate('match')}
        />
        {matches.length === 0 && (
          <EmptyState
            icon="football-outline"
            title={t('home_noMatchesYet')}
            subtitle={t('home_noMatchesSub')}
          />
        )}
        {matches.map((match) => {
          // Tarih "YYYY-MM-DD" biçiminde geliyor; gün/ay karosu için parçalara ayrılır.
          const [, month = '', day = ''] = (match.date ?? '').split('-');
          return (
            <HapticTouchable
              key={match.id}
              style={styles.matchItem}
              onPress={() => navigate('match')}
            >
              <View style={styles.dateTile}>
                <Text style={styles.dateDay}>{day}</Text>
                <Text style={styles.dateMonth}>{month}</Text>
              </View>
              <View style={styles.matchBody}>
                <Text style={styles.matchName} numberOfLines={1}>{match.name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={theme.textMuted} />
                  <Text style={styles.matchDate} numberOfLines={1}>{match.time}</Text>
                  <Ionicons name="location-outline" size={13} color={theme.textMuted} />
                  <Text style={styles.matchDate} numberOfLines={1}>{match.location}</Text>
                </View>
              </View>
              <View style={styles.matchTag}>
                <Text style={styles.matchTagText}>{match.tag}</Text>
              </View>
            </HapticTouchable>
          );
        })}

        {/* Grid */}
        <SectionHeader title={t('quickAccess')} />
        <View style={styles.grid}>
          {gridItems.map((item, i) => (
            <Animated.View
              key={i}
              style={{
                width: '47%',
                opacity: gridAnims[i],
                transform: [
                  {
                    translateY: gridAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <HapticTouchable style={styles.gridCard} onPress={() => navigate(item.screen)}>
                <View style={styles.gridIconWrap}>
                  <Ionicons name={GRID_ICONS[item.icon] ?? 'ellipse-outline'} size={19} color={theme.gold} />
                </View>
                <Text style={styles.gridTitle}>{item.title}</Text>
                <Text style={styles.gridSub}>{item.sub}</Text>
              </HapticTouchable>
            </Animated.View>
          ))}
        </View>

        <View style={{ height: 100 }} />
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
    container: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 24,
      paddingTop: 16,
    },
    topStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    topStripText: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 1,
    },
    greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    greeting: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 2 },
    greetingName: { fontFamily: FontFamily.display, fontSize: 30, color: theme.text, marginTop: 2 },
    gold: { color: theme.goldDark },
    premiumBadge: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    premiumBadgeText: { fontFamily: FontFamily.mono, fontSize: 9, color: theme.goldDark, letterSpacing: 0.5 },
    tipCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tipText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textMuted, lineHeight: 18 },
    scoreLevelPill: {
      alignSelf: 'flex-start',
      borderRadius: RADIUS,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 6,
    },
    scoreLevelText: { fontFamily: FontFamily.mono, fontSize: 11 },
    notifBtn: {
      width: 42, height: 42,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    notifDot: {
      position: 'absolute',
      top: 6, right: 6,
      minWidth: 16, height: 16,
      borderRadius: RADIUS - 3,
      paddingHorizontal: 3,
      backgroundColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifDotText: { fontFamily: FontFamily.monoMedium, fontSize: 9, color: '#fff' },
    scoreCard: {
      margin: 24,
      marginTop: 0,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      padding: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
    },
    scoreInfo: { flex: 1 },
    scoreLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 2 },
    scoreValue: { fontFamily: FontFamily.display, fontSize: 48, color: theme.goldDark, lineHeight: 54 },
    scoreSub: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    scoreUp: { fontFamily: FontFamily.bodySemiBold, color: theme.success },
    scoreDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: theme.border,
      marginHorizontal: 18,
    },
    scorePercent: { alignItems: 'center' },
    scoreRingText: { fontFamily: FontFamily.display, fontSize: 22, color: theme.goldDark },
    scorePercentLabel: { fontFamily: FontFamily.mono, fontSize: 9, color: theme.textSecondary, letterSpacing: 1, marginTop: 2 },
    discoverGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 28,
    },
    discoverCard: {
      width: '47%',
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    discoverIconWrap: {
      width: 48,
      height: 48,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    discoverTitle: { fontFamily: FontFamily.display, fontSize: 16, color: theme.text, marginBottom: 4, letterSpacing: 0.3 },
    discoverSub: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textSecondary },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 28,
    },
    gridCard: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    gridIconWrap: {
      width: 40,
      height: 40,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    gridTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text, marginBottom: 4 },
    gridSub: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary },
    activityList: { paddingHorizontal: 24, marginBottom: 28, gap: 10 },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activityIconWrap: {
      width: 34,
      height: 34,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityText: { fontFamily: FontFamily.body, flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
    activityTime: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary },
    matchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      marginHorizontal: 24,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dateTile: {
      width: 52,
      height: 56,
      borderRadius: 14,
      backgroundColor: hexToRgba(theme.goldDark, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateDay: { fontFamily: FontFamily.bodySemiBold, fontSize: 20, color: theme.goldDark, lineHeight: 24 },
    dateMonth: { fontFamily: FontFamily.body, fontSize: 11, color: theme.textMuted },
    matchBody: { flex: 1, gap: 4 },
    matchName: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    matchDate: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, marginRight: 6, flexShrink: 1 },
    matchTag: {
      borderRadius: PILL_RADIUS,
      backgroundColor: hexToRgba(theme.goldDark, 0.1),
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    matchTagText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: theme.goldDark },
    notifItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    notifAvatar: {
      width: 38, height: 38,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifText: { flex: 1 },
    notifMsg: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, lineHeight: 18 },
    notifTime: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginTop: 3 },
    unreadDot: {
      width: 6, height: 6,
      borderRadius: 3,
      backgroundColor: theme.gold,
      marginTop: 6,
    },
  });
