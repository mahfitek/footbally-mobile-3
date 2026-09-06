import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { sendMatchChallenge } from '../lib/challenges';
import { sanitizeSearchTerm } from '../lib/security';
import { sendLocalNotification } from '../lib/notifications';
import EmptyState from '../components/EmptyState';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';
import BottomSheet from '../components/BottomSheet';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

type PlayerResult = { user_id: string; full_name: string; position: string | null; city: string | null; score: number };
type TeamResult = { id: string; name: string; city: string | null; league: string | null; rating: number };
type MatchResult = { id: string; title: string; date: string; time: string; location: string; creator_id: string };
type OpportunityResult = { id: string | number; title: string; subtitle: string; location: string; badge: string };

type TabKey = 'players' | 'teams' | 'matches' | 'opportunities';

const getTabs = (t: (key: any) => string): { key: TabKey; label: string; icon: IoniconName }[] => [
  { key: 'players', label: t('search_tabPlayers'), icon: 'person-outline' },
  { key: 'teams', label: t('search_tabTeams'), icon: 'business-outline' },
  { key: 'matches', label: t('search_tabMatches'), icon: 'football-outline' },
  { key: 'opportunities', label: t('search_tabOpportunities'), icon: 'flash-outline' },
];

interface Props {
  navigate: (screen: string, params?: any) => void;
  userType?: 'player' | 'team';
}

export default function SearchScreen({ navigate, userType }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const TABS = getTabs(t);
  const styles = createStyles(theme);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('players');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string } | null>(null);
  const [players, setPlayers] = useState<PlayerResult[]>([]);
  const [teams, setTeams] = useState<TeamResult[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityResult[]>([]);
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});
  const [joinedMatchIds, setJoinedMatchIds] = useState<Record<string, boolean>>({});
  const [challengeTarget, setChallengeTarget] = useState<TeamResult | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid && userType === 'team') {
        supabase.from('teams').select('id, name').eq('owner_id', uid).maybeSingle().then(({ data }) => {
          if (data) setMyTeam(data);
        });
      }
    });
  }, [userType]);

  useEffect(() => {
    const timer = setTimeout(() => runSearch(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeTab]);

  const runSearch = async () => {
    setLoading(true);
    const q = sanitizeSearchTerm(query.trim());
    try {
      if (activeTab === 'players') {
        let req = supabase.from('profiles').select('user_id, full_name, position, city, score').order('score', { ascending: false }).limit(20);
        if (q) req = req.or(`full_name.ilike.%${q}%,position.ilike.%${q}%,city.ilike.%${q}%`);
        const { data } = await req;
        setPlayers((data ?? []) as PlayerResult[]);
      } else if (activeTab === 'teams') {
        let req = supabase.from('teams').select('id, name, city, league, rating').order('rating', { ascending: false }).limit(20);
        if (q) req = req.or(`name.ilike.%${q}%,city.ilike.%${q}%,league.ilike.%${q}%`);
        const { data } = await req;
        setTeams((data ?? []) as TeamResult[]);
      } else if (activeTab === 'matches') {
        const today = new Date().toISOString().slice(0, 10);
        let req = supabase.from('matches').select('id, title, date, time, location, creator_id').gte('date', today).order('date', { ascending: true }).limit(20);
        if (q) req = req.or(`title.ilike.%${q}%,location.ilike.%${q}%`);
        const { data } = await req;
        setMatches((data ?? []) as MatchResult[]);
      } else {
        let req = supabase.from('opportunities').select('id, title, subtitle, location, badge').order('created_at', { ascending: false }).limit(20);
        if (q) req = req.or(`title.ilike.%${q}%,subtitle.ilike.%${q}%,location.ilike.%${q}%`);
        const { data } = await req;
        setOpportunities((data ?? []) as OpportunityResult[]);
      }
    } catch (err) {
      if (__DEV__) console.log('Arama yapılamadı:', err);
    }
    setLoading(false);
  };

  const handleJoinMatch = async (match: MatchResult) => {
    if (!userId || match.creator_id === userId) return;
    const { error } = await supabase.from('match_applications').insert({ match_id: match.id, user_id: userId, status: 'applied' });
    if (error) {
      setToast({ message: t('match_joinFailed'), type: 'error' });
      return;
    }
    setJoinedMatchIds((prev) => ({ ...prev, [match.id]: true }));
    setToast({ message: t('match_joinSuccess'), type: 'success' });
    sendLocalNotification(t('search_joinedNotifTitle'), `${match.title} ${t('match_joinedNotifBody')}`);
  };

  const handleApplyOpportunity = async (op: OpportunityResult) => {
    if (userId) {
      await supabase.from('match_applications').insert({ user_id: userId, opportunity_id: op.id, status: 'applied' });
    }
    setAppliedIds((prev) => ({ ...prev, [String(op.id)]: true }));
    setToast({ message: t('activities_applySuccess'), type: 'success' });
    sendLocalNotification(t('activities_applyNotifTitle'), t('search_applyNotifBodyShort'));
  };

  const sendChallenge = async () => {
    if (!myTeam || !challengeTarget) return;
    setSending(true);
    const now = new Date();
    const { error } = await sendMatchChallenge(
      myTeam.id,
      myTeam.name,
      challengeTarget.id,
      challengeTarget.name,
      now.toISOString().slice(0, 10),
      '20:00',
      'Belirlenecek',
      '11v11'
    );
    setSending(false);
    if (error) {
      setToast({ message: t('findOpponent_inviteFailed'), type: 'error' });
      return;
    }
    setToast({ message: t('findOpponent_inviteSentToast'), type: 'success' });
    setChallengeTarget(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate(userType === 'team' ? 'teamHome' : 'home')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <TextInput
          style={styles.searchInput}
          placeholder={t('search_placeholder')}
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.tabsScroll}>
        {TABS.map((tab) => (
          <HapticTouchable
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon} size={13} color={activeTab === tab.key ? Paper.ink : theme.textMuted} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </HapticTouchable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {activeTab === 'players' && (
            players.length === 0 ? (
              <EmptyState icon="person-outline" title={t('search_emptyPlayers')} subtitle={t('search_tryDifferentSearch')} />
            ) : (
              <View style={{ gap: 12 }}>
                {players.map((p) => (
                  <View key={p.user_id} style={styles.row}>
                    <View style={styles.avatar}><Ionicons name="person-outline" size={19} color={theme.gold} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{p.full_name || t('match_defaultPlayerName')}</Text>
                      <Text style={styles.rowMeta}>{[p.position, p.city].filter(Boolean).join(' · ') || '-'}</Text>
                    </View>
                    <Text style={styles.scoreText}>{p.score}</Text>
                    <HapticTouchable style={styles.actionBtn} onPress={() => navigate('chat', { id: p.user_id, name: p.full_name })}>
                      <Text style={styles.actionBtnText}>{t('scout_sendMessage')}</Text>
                    </HapticTouchable>
                  </View>
                ))}
              </View>
            )
          )}

          {activeTab === 'teams' && (
            teams.length === 0 ? (
              <EmptyState icon="business-outline" title={t('search_emptyTeams')} subtitle={t('search_tryDifferentSearch')} />
            ) : (
              <View style={{ gap: 12 }}>
                {teams.map((tm) => (
                  <View key={tm.id} style={styles.row}>
                    <View style={styles.avatar}><Ionicons name="business-outline" size={19} color={theme.gold} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{tm.name}</Text>
                      <Text style={styles.rowMeta}>{[tm.city, tm.league].filter(Boolean).join(' · ') || '-'}</Text>
                    </View>
                    <Text style={styles.scoreText}>{tm.rating}</Text>
                    {userType === 'team' && myTeam && myTeam.id !== tm.id && (
                      <HapticTouchable style={styles.actionBtn} onPress={() => setChallengeTarget(tm)}>
                        <Text style={styles.actionBtnText}>{t('findOpponent_challenge')}</Text>
                      </HapticTouchable>
                    )}
                  </View>
                ))}
              </View>
            )
          )}

          {activeTab === 'matches' && (
            matches.length === 0 ? (
              <EmptyState icon="football-outline" title={t('search_emptyMatches')} subtitle={t('search_tryDifferentSearch')} />
            ) : (
              <View style={{ gap: 12 }}>
                {matches.map((m) => {
                  const joined = joinedMatchIds[m.id];
                  const mine = m.creator_id === userId;
                  return (
                    <View key={m.id} style={styles.row}>
                      <View style={styles.avatar}><Ionicons name="football-outline" size={19} color={theme.gold} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{m.title}</Text>
                        <Text style={styles.rowMeta}>{m.date} · {m.time} · {m.location}</Text>
                      </View>
                      {!mine && (
                        <HapticTouchable
                          style={[styles.actionBtn, joined && styles.actionBtnDone]}
                          onPress={() => handleJoinMatch(m)}
                          disabled={joined}
                        >
                          <Text style={styles.actionBtnText}>{joined ? t('search_joined') : t('match_join')}</Text>
                        </HapticTouchable>
                      )}
                    </View>
                  );
                })}
              </View>
            )
          )}

          {activeTab === 'opportunities' && (
            opportunities.length === 0 ? (
              <EmptyState icon="flash-outline" title={t('search_emptyOpportunities')} subtitle={t('search_tryDifferentSearch')} />
            ) : (
              <View style={{ gap: 12 }}>
                {opportunities.map((op) => {
                  const applied = appliedIds[String(op.id)];
                  return (
                    <View key={op.id} style={styles.row}>
                      <View style={styles.avatar}><Ionicons name="flash-outline" size={19} color={theme.gold} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{op.title}</Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>{op.subtitle} · {op.location}</Text>
                      </View>
                      <HapticTouchable
                        style={[styles.actionBtn, applied && styles.actionBtnDone]}
                        onPress={() => handleApplyOpportunity(op)}
                        disabled={applied}
                      >
                        <Text style={styles.actionBtnText}>{applied ? t('activities_applied') : t('activities_apply')}</Text>
                      </HapticTouchable>
                    </View>
                  );
                })}
              </View>
            )
          )}
        </ScrollView>
      )}

      <BottomSheet visible={!!challengeTarget} onClose={() => setChallengeTarget(null)} theme={theme}>
        <Text style={styles.modalTitle}>{t('search_challengeModalPrefix')}{challengeTarget?.name}{t('search_challengeModalSuffix')}</Text>
        <Text style={styles.rowMeta}>{t('search_challengeModalBody')}</Text>
        <HapticTouchable style={[styles.saveBtn, sending && { opacity: 0.6 }]} onPress={sendChallenge} disabled={sending}>
          {sending ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>{t('findOpponent_sendInvite')}</Text>}
        </HapticTouchable>
        <HapticTouchable style={styles.cancelBtn} onPress={() => setChallengeTarget(null)}>
          <Text style={styles.cancelBtnText}>{t('match_giveUp')}</Text>
        </HapticTouchable>
      </BottomSheet>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
    backBtn: {
      width: 44, height: 44,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchInput: {
      flex: 1,
      height: 48,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      color: theme.text,
      fontFamily: FontFamily.mono,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabsScroll: { paddingHorizontal: 16, gap: 8, marginBottom: 12 },
    tabBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabBtnActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    tabText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted },
    tabTextActive: { color: Paper.ink },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatar: {
      width: 42, height: 42,
      borderRadius: 21,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
    rowMeta: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    scoreText: { fontFamily: FontFamily.display, fontSize: 16, color: theme.gold },
    actionBtn: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    actionBtnDone: { backgroundColor: theme.card2, borderColor: theme.success },
    actionBtnText: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.gold },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      padding: 24,
      paddingBottom: 36,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    modalTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, marginBottom: 4, letterSpacing: 0.5 },
    saveBtn: { height: 52, borderRadius: RADIUS, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    saveBtnText: { fontFamily: FontFamily.display, fontSize: 14, letterSpacing: 1, color: Paper.ink },
    cancelBtn: { alignItems: 'center', paddingVertical: 14 },
    cancelBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
  });
