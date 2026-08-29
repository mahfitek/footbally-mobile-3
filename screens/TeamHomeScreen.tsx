import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { notifyUser } from '../lib/notify';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

type TeamInfo = {
  id: string;
  name: string;
  city: string | null;
  league: string | null;
  logo_url: string | null;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
};

type PendingChallenge = {
  id: string;
  challenger_team_id: string;
  challengerName: string;
  date: string;
  time: string;
  location: string;
  format: string;
};

type ActivityItem = {
  id: string;
  icon: IoniconName;
  text: string;
  time: string;
  sortKey: number;
};

const ACTIONS: { icon: IoniconName; title: string; sub: string; screen: string; accent: 'gold' | 'error' | 'success' }[] = [
  {
    icon: 'search-outline',
    title: 'Oyuncu Bul',
    sub: 'Takımına yeni yetenek ekle',
    screen: 'findPlayer',
    accent: 'gold',
  },
  {
    icon: 'shield-outline',
    title: 'Rakip Bul',
    sub: 'Maç ayarla, rekabet et',
    screen: 'findOpponent',
    accent: 'error',
  },
  {
    icon: 'people-outline',
    title: 'Kadroyu Yönet',
    sub: 'Diziliş ve oyuncular',
    screen: 'teamSquad',
    accent: 'gold',
  },
  {
    icon: 'bar-chart-outline',
    title: 'Maç Analizi',
    sub: 'İstatistik ve performans',
    screen: 'teamProfile',
    accent: 'success',
  },
  {
    icon: 'trending-up-outline',
    title: 'İstatistikler',
    sub: 'Form, gol krallığı, seri',
    screen: 'teamStats',
    accent: 'gold',
  },
  {
    icon: 'megaphone-outline',
    title: 'Tribün',
    sub: 'Tüm oyuncular ve takımlarla sohbet et',
    screen: 'tribun',
    accent: 'gold',
  },
];

function StatCard({ value, label }: { value: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={{
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    }}>
      <Text style={{ fontFamily: FontFamily.display, fontSize: 17, color: theme.gold }}>{value}</Text>
      <Text style={{ fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ActionCard({ item, theme, onPress }: { item: typeof ACTIONS[number]; theme: Theme; onPress: () => void }) {
  const accentColor = theme[item.accent];
  return (
    <HapticTouchable style={styles.gridCardWrap} onPress={onPress}>
      <View style={[styles.gridCard, { backgroundColor: theme.card, borderColor: accentColor }]}>
        <View style={[styles.gridIconWrap, { backgroundColor: theme.card2 }]}>
          <Ionicons name={item.icon} size={19} color={accentColor} />
        </View>
        <Text style={[styles.gridTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.gridSub, { color: theme.textSecondary }]}>{item.sub}</Text>
        <Ionicons name="chevron-forward" size={15} color={accentColor} style={{ marginTop: 10 }} />
      </View>
    </HapticTouchable>
  );
}

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId?: string | null;
}

export default function TeamHomeScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingChallenges, setPendingChallenges] = useState<PendingChallenge[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    await loadTeam();
    setLoading(false);
  };

  const loadTeam = async () => {
    let uid = userId;
    if (!uid) {
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id ?? null;
    }
    if (!uid) return;
    setResolvedUserId(uid);

    const { data, error } = await supabase
      .from('teams')
      .select('id, name, city, league, logo_url, wins, losses, draws, rating')
      .eq('owner_id', uid)
      .maybeSingle();

    if (error || !data) {
      if (__DEV__ && error) console.log('Takım yüklenemedi:', error);
      setTeam(null);
      return;
    }

    setTeam(data as TeamInfo);
    await Promise.all([loadPlayerCount(data.id), loadActivity(data.id), loadPendingChallenges(data.id)]);
  };

  const loadPendingChallenges = async (teamId: string) => {
    const { data, error } = await supabase
      .from('match_challenges')
      .select('id, challenger_team_id, date, time, location, format, challenger:teams!match_challenges_challenger_team_id_fkey(name)')
      .eq('opponent_team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (__DEV__ && error) console.log('Bekleyen davetler yüklenemedi:', error);
      setPendingChallenges([]);
      return;
    }

    setPendingChallenges(
      data.map((c: any) => ({
        id: c.id,
        challenger_team_id: c.challenger_team_id,
        challengerName: c.challenger?.name ?? 'Rakip Takım',
        date: c.date,
        time: c.time,
        location: c.location,
        format: c.format,
      }))
    );
  };

  const respondToChallenge = async (challenge: PendingChallenge, accept: boolean) => {
    if (!team) return;
    setRespondingId(challenge.id);
    try {
      const { error: updateError } = await supabase
        .from('match_challenges')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', challenge.id);

      if (updateError) {
        if (__DEV__) console.log('Davet güncellenemedi:', updateError);
        setRespondingId(null);
        return;
      }

      if (accept) {
        const players = parseInt(challenge.format, 10) || 11;
        await supabase.from('matches').insert({
          title: `${challenge.challengerName} vs ${team.name}`,
          date: challenge.date,
          time: challenge.time,
          location: challenge.location,
          city: team.city || challenge.location,
          required_players: players * 2,
          type: challenge.format,
          category: 'Takım Maçı',
          creator_id: resolvedUserId,
        });
      }

      const { data: challengerTeam } = await supabase
        .from('teams')
        .select('owner_id')
        .eq('id', challenge.challenger_team_id)
        .maybeSingle();
      if (challengerTeam?.owner_id) {
        notifyUser(
          challengerTeam.owner_id,
          accept ? 'checkmark-circle-outline' : 'close-circle-outline',
          accept
            ? `${team.name} maç davetini kabul etti`
            : `${team.name} maç davetini reddetti`,
          'teamHome',
          'Maç Daveti Yanıtlandı',
          'match'
        );
      }

      setPendingChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
      if (accept) loadActivity(team.id);
    } catch (err) {
      if (__DEV__) console.log('Davet yanıtlanırken beklenmeyen hata:', err);
    }
    setRespondingId(null);
  };

  const loadPlayerCount = async (teamId: string) => {
    const { count, error } = await supabase
      .from('team_members')
      .select('id', { count: 'exact' })
      .eq('team_id', teamId);
    if (error) {
      if (__DEV__) console.log('Oyuncu sayısı yüklenemedi:', error);
      return;
    }
    setPlayerCount(count ?? 0);
  };

  const loadActivity = async (teamId: string) => {
    const [membersRes, challengesRes] = await Promise.all([
      supabase
        .from('team_members')
        .select('id, joined_at')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: false })
        .limit(5),
      supabase
        .from('match_challenges')
        .select('id, status, created_at, challenger_team_id, opponent_team_id, opponent:teams!match_challenges_opponent_team_id_fkey(name), challenger:teams!match_challenges_challenger_team_id_fkey(name)')
        .or(`challenger_team_id.eq.${teamId},opponent_team_id.eq.${teamId}`)
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const items: ActivityItem[] = [];

    if (!membersRes.error && membersRes.data) {
      membersRes.data.forEach((m: any) => {
        items.push({
          id: `member-${m.id}`,
          icon: 'person-outline',
          text: 'Bir oyuncu kadroya katıldı',
          time: new Date(m.joined_at).toLocaleDateString('tr-TR'),
          sortKey: new Date(m.joined_at).getTime(),
        });
      });
    } else if (__DEV__ && membersRes.error) {
      console.log('Aktiviteler yüklenemedi:', membersRes.error);
    }

    if (!challengesRes.error && challengesRes.data) {
      challengesRes.data.forEach((c: any) => {
        const opponentName = c.challenger_team_id === teamId ? c.opponent?.name ?? 'Rakip Takım' : c.challenger?.name ?? 'Rakip Takım';
        const statusText = c.status === 'accepted' ? `vs ${opponentName} maçı onaylandı` : c.status === 'completed' ? `vs ${opponentName} maçı tamamlandı` : `vs ${opponentName} için meydan okuma gönderildi`;
        items.push({
          id: `challenge-${c.id}`,
          icon: c.status === 'completed' ? 'flag-outline' : 'shield-outline',
          text: statusText,
          time: new Date(c.created_at).toLocaleDateString('tr-TR'),
          sortKey: new Date(c.created_at).getTime(),
        });
      });
    } else if (__DEV__ && challengesRes.error) {
      console.log('Maç aktiviteleri yüklenemedi:', challengesRes.error);
    }

    items.sort((a, b) => b.sortKey - a.sortKey);
    setActivity(items.slice(0, 6));
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAll().finally(() => setRefreshing(false));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 24, gap: 12 }}>
          <SkeletonCard height={140} />
          <SkeletonCard height={200} />
          <SkeletonCard height={80} />
        </View>
      </SafeAreaView>
    );
  }

  const statsRow = team
    ? [
        { value: String(team.wins + team.losses + team.draws), label: 'Maç' },
        { value: String(team.wins), label: 'Galibiyet' },
        { value: String(team.draws), label: 'Beraberlik' },
        { value: String(team.losses), label: 'Mağlubiyet' },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} colors={[theme.gold]} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {team?.logo_url ? (
              <Image source={{ uri: team.logo_url }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="business-outline" size={22} color={theme.gold} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.teamName} numberOfLines={1}>{team?.name ?? 'Takımın'}</Text>
              <View style={styles.leagueBadge}>
                <Text style={styles.leagueBadgeText}>{team?.league ?? 'Amatör'}</Text>
              </View>
            </View>
            <HapticTouchable style={styles.notifBtn} onPress={() => navigate('search')}>
              <Ionicons name="search-outline" size={17} color={theme.text} />
            </HapticTouchable>
            <HapticTouchable style={styles.notifBtn} onPress={() => navigate('notifications')}>
              <Ionicons name="notifications-outline" size={17} color={theme.text} />
              {unreadCount > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </HapticTouchable>
          </View>
        </View>

        {!team && (
          <EmptyState
            icon="business-outline"
            title="Henüz takımın yok"
            subtitle="Takım profilini oluşturarak oyuncu ve rakip bulmaya başla"
            actionLabel="Takım Oluştur"
            onAction={() => navigate('teamEdit')}
          />
        )}

        {team && (
          <>
            <View style={styles.statsRow}>
              {statsRow.map((s) => (
                <StatCard key={s.label} value={s.value} label={s.label} />
              ))}
            </View>

            <View style={styles.grid}>
              {ACTIONS.map((item) => (
                <ActionCard key={item.screen} item={item} theme={theme} onPress={() => navigate(item.screen)} />
              ))}
            </View>

            {pendingChallenges.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>BEKLEYEN MAÇ DAVETLERİ</Text>
                </View>
                <View style={styles.activityList}>
                  {pendingChallenges.map((c) => (
                    <View key={c.id} style={styles.challengeCard}>
                      <Text style={styles.challengeTitle}>{c.challengerName}</Text>
                      <Text style={styles.challengeMeta}>
                        {c.date} · {c.time} · {c.location} · {c.format}
                      </Text>
                      <View style={styles.challengeActions}>
                        <HapticTouchable
                          style={[styles.challengeBtn, styles.declineBtn]}
                          onPress={() => respondToChallenge(c, false)}
                          disabled={respondingId === c.id}
                        >
                          {respondingId === c.id ? (
                            <ActivityIndicator size="small" color={theme.error} />
                          ) : (
                            <Text style={styles.declineBtnText}>Reddet</Text>
                          )}
                        </HapticTouchable>
                        <HapticTouchable
                          style={[styles.challengeBtn, styles.acceptBtn]}
                          onPress={() => respondToChallenge(c, true)}
                          disabled={respondingId === c.id}
                        >
                          {respondingId === c.id ? (
                            <ActivityIndicator size="small" color={Paper.ink} />
                          ) : (
                            <Text style={styles.acceptBtnText}>Kabul Et</Text>
                          )}
                        </HapticTouchable>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>SON AKTİVİTE</Text>
            </View>
            {activity.length === 0 ? (
              <EmptyState icon="flash-outline" title="Henüz aktivite yok" subtitle="Kadro ve maç aktiviteleri burada görünecek" />
            ) : (
              <View style={styles.activityList}>
                {activity.map((a) => (
                  <View key={a.id} style={styles.activityItem}>
                    <View style={styles.activityIconWrap}>
                      <Ionicons name={a.icon} size={16} color={theme.gold} />
                    </View>
                    <Text style={styles.activityText}>{a.text}</Text>
                    <Text style={styles.activityTime}>{a.time}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1, backgroundColor: theme.bg },
    header: { padding: 24, paddingTop: 16 },
    headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    logo: {
      width: 54, height: 54, borderRadius: RADIUS,
      borderWidth: 1, borderColor: theme.gold,
    },
    logoPlaceholder: {
      width: 54, height: 54, borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1, borderColor: theme.gold,
      alignItems: 'center', justifyContent: 'center',
    },
    teamName: { fontFamily: FontFamily.display, fontSize: 20, color: theme.text, letterSpacing: 0.5 },
    leagueBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 4,
    },
    leagueBadgeText: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.gold, letterSpacing: 0.5 },
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
    statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 24 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 14,
    },
    sectionTitle: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 28,
    },
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
    challengeCard: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    challengeTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, marginBottom: 4 },
    challengeMeta: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginBottom: 12 },
    challengeActions: { flexDirection: 'row', gap: 10 },
    challengeBtn: { flex: 1, height: 40, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' },
    declineBtn: { backgroundColor: theme.card2, borderWidth: 1, borderColor: theme.error },
    declineBtnText: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.error },
    acceptBtn: { backgroundColor: theme.gold },
    acceptBtnText: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: Paper.ink },
  });

const styles = StyleSheet.create({
  gridCardWrap: { width: '47%' },
  gridCard: {
    borderRadius: RADIUS,
    padding: 18,
    borderWidth: 1,
    minHeight: 140,
  },
  gridIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, marginBottom: 4 },
  gridSub: { fontFamily: FontFamily.mono, fontSize: 11, lineHeight: 15 },
});
