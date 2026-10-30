import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { TEAM_COLUMNS } from '../lib/columns';
import { profiles } from '../lib/profiles';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';
import BottomSheet from '../components/BottomSheet';

type TeamRecord = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  goals_scored: number;
  goals_conceded: number;
  clean_sheets: number;
};

type ScorerRow = { user_id: string; full_name: string; goals: number };

type ChallengeRow = {
  id: string;
  challenger_team_id: string;
  opponent_team_id: string;
  date: string;
  time: string;
  location: string;
  status: string;
  challenger_goals: number | null;
  opponent_goals: number | null;
  challengerName: string;
  opponentName: string;
};

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId?: string | null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function TeamStatsScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [team, setTeam] = useState<TeamRecord | null>(null);
  const [form, setForm] = useState<('W' | 'L' | 'D')[]>([]);
  const [scorers, setScorers] = useState<ScorerRow[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [scorable, setScorable] = useState<ChallengeRow[]>([]);
  const [scoreTarget, setScoreTarget] = useState<ChallengeRow | null>(null);
  const [challengerGoalsInput, setChallengerGoalsInput] = useState('0');
  const [opponentGoalsInput, setOpponentGoalsInput] = useState('0');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const resolveUserId = async () => {
    if (userId) return userId;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  };

  const loadAll = async () => {
    setLoading(true);
    const uid = await resolveUserId();
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: teamRow, error } = await supabase
      .from('teams')
      .select('id, name, wins, losses, draws, goals_scored, goals_conceded, clean_sheets')
      .eq('owner_id', uid)
      .maybeSingle();

    if (error || !teamRow) {
      if (__DEV__ && error) console.log('Takım yüklenemedi:', error);
      setTeam(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setTeam(teamRow as TeamRecord);
    await Promise.all([loadChallenges(teamRow.id), loadScorers(teamRow.id)]);
    setLoading(false);
    setRefreshing(false);
  };

  const loadChallenges = async (teamId: string) => {
    const { data, error } = await supabase
      .from('match_challenges')
      .select(
        'id, challenger_team_id, opponent_team_id, date, time, location, status, challenger_goals, opponent_goals, challenger:teams!match_challenges_challenger_team_id_fkey(name), opponent:teams!match_challenges_opponent_team_id_fkey(name)'
      )
      .or(`challenger_team_id.eq.${teamId},opponent_team_id.eq.${teamId}`)
      .order('date', { ascending: false });

    if (error || !data) {
      if (__DEV__ && error) console.log('Maç geçmişi yüklenemedi:', error);
      setForm([]);
      setScorable([]);
      setUpcomingCount(0);
      return;
    }

    const rows: ChallengeRow[] = data.map((c: any) => ({
      id: c.id,
      challenger_team_id: c.challenger_team_id,
      opponent_team_id: c.opponent_team_id,
      date: c.date,
      time: c.time,
      location: c.location,
      status: c.status,
      challenger_goals: c.challenger_goals,
      opponent_goals: c.opponent_goals,
      challengerName: c.challenger?.name ?? t('teamStats_defaultTeamName'),
      opponentName: c.opponent?.name ?? t('teamStats_defaultTeamName'),
    }));

    const today = todayStr();
    const completed = rows.filter((r) => r.status === 'completed' && r.challenger_goals !== null && r.opponent_goals !== null);
    const last5Form = completed.slice(0, 5).map((r) => {
      const isChallenger = r.challenger_team_id === teamId;
      const mine = isChallenger ? r.challenger_goals! : r.opponent_goals!;
      const theirs = isChallenger ? r.opponent_goals! : r.challenger_goals!;
      return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
    }) as ('W' | 'L' | 'D')[];
    setForm(last5Form);

    setUpcomingCount(rows.filter((r) => r.status === 'accepted' && r.date >= today).length);
    setScorable(rows.filter((r) => r.status === 'accepted'));
  };

  const loadScorers = async (teamId: string) => {
    const { data: members, error } = await supabase
      .from('team_members')
      .select('user_id, goals')
      .eq('team_id', teamId)
      .order('goals', { ascending: false })
      .limit(3);

    if (error || !members || members.length === 0) {
      setScorers([]);
      return;
    }

    const { data: memberProfiles } = await profiles.publicProfiles(members.map((m: any) => m.user_id), 'user_id, full_name');
    const nameMap = new Map((memberProfiles ?? []).map((p: any) => [p.user_id, p.full_name]));

    setScorers(members.map((m: any) => ({ user_id: m.user_id, full_name: nameMap.get(m.user_id) ?? t('match_defaultPlayerName'), goals: m.goals ?? 0 })));
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const openScoreEntry = (challenge: ChallengeRow) => {
    setScoreTarget(challenge);
    setChallengerGoalsInput('0');
    setOpponentGoalsInput('0');
  };

  const submitScore = async () => {
    if (!scoreTarget || !team) return;
    const challengerGoals = Math.max(0, parseInt(challengerGoalsInput, 10) || 0);
    const opponentGoals = Math.max(0, parseInt(opponentGoalsInput, 10) || 0);

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('match_challenges')
        .update({ challenger_goals: challengerGoals, opponent_goals: opponentGoals, status: 'completed' })
        .eq('id', scoreTarget.id);
      if (updateError) throw updateError;

      const [{ data: challengerTeam }, { data: opponentTeam }] = await Promise.all([
        supabase.from('teams').select(TEAM_COLUMNS).eq('id', scoreTarget.challenger_team_id).maybeSingle(),
        supabase.from('teams').select(TEAM_COLUMNS).eq('id', scoreTarget.opponent_team_id).maybeSingle(),
      ]);

      // teams.clean_sheets canlı şemada yok (bkz. pending missing columns; kullanıcı ertelemiş).
      // Sorguya eklenmez: eklenirse takım yüklemesi tümden kırılır. Yalnızca tip açıklanır.
      type CleanSheetsRow = { clean_sheets?: number | null };
      const updates: { id: string; wins: number; losses: number; draws: number; goals_scored: number; goals_conceded: number; clean_sheets: number }[] = [];
      if (challengerTeam) {
        const won = challengerGoals > opponentGoals;
        const drew = challengerGoals === opponentGoals;
        updates.push({
          id: challengerTeam.id,
          wins: (challengerTeam.wins ?? 0) + (won ? 1 : 0),
          losses: (challengerTeam.losses ?? 0) + (!won && !drew ? 1 : 0),
          draws: (challengerTeam.draws ?? 0) + (drew ? 1 : 0),
          goals_scored: (challengerTeam.goals_scored ?? 0) + challengerGoals,
          goals_conceded: (challengerTeam.goals_conceded ?? 0) + opponentGoals,
          clean_sheets: ((challengerTeam as CleanSheetsRow).clean_sheets ?? 0) + (opponentGoals === 0 ? 1 : 0),
        });
      }
      if (opponentTeam) {
        const won = opponentGoals > challengerGoals;
        const drew = opponentGoals === challengerGoals;
        updates.push({
          id: opponentTeam.id,
          wins: (opponentTeam.wins ?? 0) + (won ? 1 : 0),
          losses: (opponentTeam.losses ?? 0) + (!won && !drew ? 1 : 0),
          draws: (opponentTeam.draws ?? 0) + (drew ? 1 : 0),
          goals_scored: (opponentTeam.goals_scored ?? 0) + opponentGoals,
          goals_conceded: (opponentTeam.goals_conceded ?? 0) + challengerGoals,
          clean_sheets: ((opponentTeam as CleanSheetsRow).clean_sheets ?? 0) + (challengerGoals === 0 ? 1 : 0),
        });
      }

      await Promise.all(
        updates.map((u) =>
          supabase
            .from('teams')
            .update({
              wins: u.wins,
              losses: u.losses,
              draws: u.draws,
              goals_scored: u.goals_scored,
              goals_conceded: u.goals_conceded,
              clean_sheets: u.clean_sheets,
            })
            .eq('id', u.id)
        )
      );

      setToast({ message: t('match_resultSaveSuccess'), type: 'success' });
      setScoreTarget(null);
      loadAll();
    } catch (err) {
      if (__DEV__) console.log('Skor kaydedilemedi:', err);
      setToast({ message: t('teamStats_scoreSaveFailed'), type: 'error' });
    }
    setSaving(false);
  };

  useEffect(() => {
    loadAll();
  }, [userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 24, gap: 12 }}>
          <SkeletonCard height={120} />
          <SkeletonCard height={160} />
          <SkeletonCard height={160} />
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="trending-up-outline" title={t('teamHome_noTeamTitle')} subtitle={t('teamSquad_noTeamSub')} actionLabel={t('teamHome_createTeam')} onAction={() => navigate('teamEdit')} />
      </SafeAreaView>
    );
  }

  const totalMatches = team.wins + team.losses + team.draws;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('teamHome')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('teamStats_title')}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} colors={[theme.gold]} />}
      >
        <View style={styles.statsRow}>
          {[
            { value: String(totalMatches), label: t('teamProfile_statMatches') },
            { value: String(team.wins), label: t('teamProfile_statWins') },
            { value: String(team.draws), label: t('teamProfile_statDraws') },
            { value: String(team.losses), label: t('teamProfile_statLosses') },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('teamStats_goalStatsTitle')}</Text>
          <View style={styles.goalsRow}>
            <View style={styles.goalsItem}>
              <Text style={styles.goalsValue}>{team.goals_scored}</Text>
              <Text style={styles.goalsLabel}>{t('teamStats_goalsScored')}</Text>
            </View>
            <View style={styles.goalsItem}>
              <Text style={styles.goalsValue}>{team.goals_conceded}</Text>
              <Text style={styles.goalsLabel}>{t('teamStats_goalsConceded')}</Text>
            </View>
            <View style={styles.goalsItem}>
              <Text style={styles.goalsValue}>{team.clean_sheets}</Text>
              <Text style={styles.goalsLabel}>{t('teamStats_cleanSheets')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('teamStats_last5FormTitle')}</Text>
            <Text style={styles.upcomingText}>{upcomingCount} {t('teamStats_upcomingSuffix')}</Text>
          </View>
          {form.length === 0 ? (
            <Text style={styles.emptyHint}>{t('teamStats_noCompletedMatches')}</Text>
          ) : (
            <View style={styles.formRow}>
              {form.map((r, i) => (
                <View
                  key={i}
                  style={[
                    styles.formPill,
                    r === 'W' && { borderColor: theme.success },
                    r === 'L' && { borderColor: theme.error },
                    r === 'D' && { borderColor: theme.border },
                  ]}
                >
                  <Text style={styles.formPillText}>{r}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('teamStats_topScorersTitle')}</Text>
          {scorers.length === 0 ? (
            <Text style={styles.emptyHint}>{t('teamStats_noGoalData')}</Text>
          ) : (
            scorers.map((s, i) => (
              <View key={s.user_id} style={styles.scorerRow}>
                <Text style={styles.scorerRank}>{i + 1}</Text>
                <Text style={styles.scorerName}>{s.full_name}</Text>
                <Text style={styles.scorerGoals}>{s.goals} {t('teamStats_goalsSuffix')}</Text>
              </View>
            ))
          )}
        </View>

        {scorable.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('teamStats_acceptedMatchesTitle')}</Text>
            {scorable.map((c) => (
              <View key={c.id} style={styles.scorableRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scorableTitle}>{c.challengerName} vs {c.opponentName}</Text>
                  <Text style={styles.scorableMeta}>{c.date} · {c.time}</Text>
                </View>
                <HapticTouchable style={styles.scoreEntryBtn} onPress={() => openScoreEntry(c)}>
                  <Text style={styles.scoreEntryBtnText}>{t('teamStats_enterScore')}</Text>
                </HapticTouchable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={!!scoreTarget} onClose={() => setScoreTarget(null)} theme={theme}>
        <Text style={styles.modalTitle}>{t('teamStats_matchResultTitle')}</Text>
        <Text style={styles.scorableMeta}>{scoreTarget?.challengerName} vs {scoreTarget?.opponentName}</Text>

        <View style={styles.scoreInputRow}>
          <View style={styles.scoreInputCol}>
            <Text style={styles.scoreInputLabel} numberOfLines={1}>{scoreTarget?.challengerName}</Text>
            <TextInput
              style={styles.scoreInput}
              keyboardType="number-pad"
              value={challengerGoalsInput}
              onChangeText={setChallengerGoalsInput}
            />
          </View>
          <Text style={styles.scoreDash}>—</Text>
          <View style={styles.scoreInputCol}>
            <Text style={styles.scoreInputLabel} numberOfLines={1}>{scoreTarget?.opponentName}</Text>
            <TextInput
              style={styles.scoreInput}
              keyboardType="number-pad"
              value={opponentGoalsInput}
              onChangeText={setOpponentGoalsInput}
            />
          </View>
        </View>

        <HapticTouchable style={styles.saveBtn} onPress={submitScore} disabled={saving}>
          {saving ? <ActivityIndicator color={Paper.ink} /> : <Text style={styles.saveBtnText}>{t('match_save')}</Text>}
        </HapticTouchable>
        <HapticTouchable style={styles.cancelBtn} onPress={() => setScoreTarget(null)}>
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    backBtn: {
      width: 42, height: 42,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    statValue: { fontFamily: FontFamily.display, fontSize: 17, color: theme.goldDark },
    statLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary, marginTop: 2 },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    cardTitle: { fontFamily: FontFamily.display, fontSize: 16, color: theme.text, marginBottom: 16, letterSpacing: 0.5 },
    upcomingText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.goldDark },
    goalsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    goalsItem: { alignItems: 'center' },
    goalsValue: { fontFamily: FontFamily.display, fontSize: 22, color: theme.goldDark },
    goalsLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginTop: 4 },
    formRow: { flexDirection: 'row', gap: 8 },
    formPill: { width: 30, height: 30, borderRadius: RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    formPillText: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.text },
    emptyHint: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
    scorerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    scorerRank: { width: 20, fontFamily: FontFamily.monoMedium, fontSize: 14, color: theme.goldDark },
    scorerName: { flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text },
    scorerGoals: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.goldDark },
    scorableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    scorableTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text },
    scorableMeta: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginTop: 2 },
    scoreEntryBtn: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    scoreEntryBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.goldDark },
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
    modalTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, marginBottom: 6, letterSpacing: 0.5 },
    scoreInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20, marginBottom: 20 },
    scoreInputCol: { alignItems: 'center', width: 100 },
    scoreInputLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginBottom: 8, textAlign: 'center' },
    scoreInput: {
      width: 64,
      height: 56,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.text,
      fontFamily: FontFamily.display,
      fontSize: 22,
      textAlign: 'center',
    },
    scoreDash: { fontFamily: FontFamily.mono, fontSize: 20, color: theme.textSecondary, marginTop: 20 },
    saveBtn: { height: 52, borderRadius: RADIUS, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { fontFamily: FontFamily.display, fontSize: 14, letterSpacing: 0.5, color: Paper.ink },
    cancelBtn: { alignItems: 'center', paddingVertical: 14 },
    cancelBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
  });
