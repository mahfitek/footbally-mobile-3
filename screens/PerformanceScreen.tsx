import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import LoadingScreen from '../components/LoadingScreen';
import EmptyState from '../components/EmptyState';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

const getDays = (t: (key: any) => string) => [
  t('performance_dayMon'),
  t('performance_dayTue'),
  t('performance_dayWed'),
  t('performance_dayThu'),
  t('performance_dayFri'),
  t('performance_daySat'),
  t('performance_daySun'),
];

const getSkills = (t: (key: any) => string) => [
  { name: t('performance_skillSpeed'), value: 0 },
  { name: t('performance_skillPass'), value: 0 },
  { name: t('performance_skillShot'), value: 0 },
  { name: t('performance_skillStamina'), value: 0 },
  { name: t('performance_skillDribbling'), value: 0 },
  { name: t('performance_skillDefense'), value: 0 },
];

const getAiInsight = (matchesPlayed: number, winRate: number, goals: number, hasPlayed: boolean, lang: 'tr' | 'en'): string => {
  if (!hasPlayed) {
    return lang === 'tr' ? 'İlk maçını oyna ve AI analizini gör' : 'Play your first match to see your AI analysis';
  }
  if (matchesPlayed >= 3) {
    const tail = winRate >= 50
      ? (lang === 'tr' ? 'Harika gidiyorsun, bu formu koru!' : "You're doing great, keep up this form!")
      : (lang === 'tr' ? 'Daha fazla maça katılarak formunu yükseltebilirsin.' : 'You can improve your form by joining more matches.');
    return lang === 'tr'
      ? `Son ${matchesPlayed} maçında %${winRate} galibiyet oranın ve toplam ${goals} golün var. ${tail}`
      : `In your last ${matchesPlayed} matches you have a ${winRate}% win rate and ${goals} total goals. ${tail}`;
  }
  return lang === 'tr'
    ? `${matchesPlayed} maç oynadın. Daha fazla maça katıl, performansını takip edelim.`
    : `You've played ${matchesPlayed} match(es). Join more matches so we can track your performance.`;
};

const CHART_HEIGHT = 120;
const PLATFORM_AVERAGE_SCORE = 65;

type ResultRow = { date: string; result: 'win' | 'loss' | 'draw' | null; goals: number };

const formBarHeight = (result: ResultRow['result']) => {
  if (result === 'win') return 100;
  if (result === 'draw') return 55;
  if (result === 'loss') return 22;
  return 0;
};

interface Props {
  navigate: (screen: string) => void;
}

export default function PerformanceScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const days = getDays(t);
  const skills = getSkills(t);
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matchesPlayed, setMatchesPlayed] = useState(0);
  const [wins, setWins] = useState(0);
  const [goals, setGoals] = useState(0);
  const [score, setScore] = useState(0);
  const [weeklyForm, setWeeklyForm] = useState<ResultRow[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('score')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) setScore(profile.score ?? 0);

      const today = new Date().toISOString().slice(0, 10);
      const { data: apps } = await supabase
        .from('match_applications')
        .select('result, goals, matches(date)')
        .eq('user_id', user.id);

      const played = (apps ?? [])
        .filter((a: any) => a.matches?.date && a.matches.date < today)
        .map((a: any) => ({ date: a.matches.date as string, result: a.result, goals: a.goals ?? 0 }))
        .sort((a: ResultRow, b: ResultRow) => (a.date < b.date ? -1 : 1));

      setMatchesPlayed(played.length);
      setWins(played.filter((p) => p.result === 'win').length);
      setGoals(played.reduce((sum, p) => sum + (p.goals ?? 0), 0));
      setWeeklyForm(played.slice(-7));
    } catch (err) {
      if (__DEV__) console.log('Performans verisi yüklenemedi:', err);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const miniStats: { icon: IoniconName; val: string; label: string }[] = [
    { icon: 'football-outline', val: String(goals), label: t('performance_goalsLabel') },
    { icon: 'trophy-outline', val: String(wins), label: t('teamProfile_statWins') },
    { icon: 'business-outline', val: String(matchesPlayed), label: t('teamProfile_statMatches') },
  ];

  const hasPlayed = matchesPlayed > 0;
  const winRate = hasPlayed ? Math.round((wins / matchesPlayed) * 100) : 0;

  const aiInsight = getAiInsight(matchesPlayed, winRate, goals, hasPlayed, lang);

  const chartAvgLabel = weeklyForm.length > 0
    ? Math.round(weeklyForm.reduce((sum, r) => sum + formBarHeight(r.result), 0) / weeklyForm.length)
    : 0;

  const last7 = Array.from({ length: 7 }, (_, i) => weeklyForm[weeklyForm.length - 7 + i] ?? null);

  if (loading) {
    return <LoadingScreen message={t('performance_loading')} />;
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
          <Text style={styles.title}>{t('performance_title')}</Text>
        </View>

        {/* AI Insight */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Ionicons name="hardware-chip-outline" size={15} color={theme.gold} />
            <Text style={styles.aiLabel}>{t('performance_aiLabel')}</Text>
          </View>
          <Text style={styles.aiText}>{aiInsight}</Text>
        </View>

        {!hasPlayed ? (
          <EmptyState
            icon="trophy-outline"
            title={t('performance_emptyTitle')}
            subtitle={t('performance_emptySub')}
            actionLabel={t('performance_findMatch')}
            onAction={() => navigate('match')}
          />
        ) : (
          <>
            {/* Mini Stats */}
            <View style={styles.miniRow}>
              {miniStats.map((m, i) => (
                <View key={i} style={styles.miniCard}>
                  <Ionicons name={m.icon} size={17} color={theme.gold} style={{ marginBottom: 6 }} />
                  <Text style={styles.miniVal}>{m.val}</Text>
                  <Text style={styles.miniLabel}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* Weekly Form Chart */}
            <View style={styles.card}>
              <View style={styles.chartHeader}>
                <Text style={styles.cardTitle}>{t('performance_weeklyFormTitle')}</Text>
                <Text style={styles.chartAvg}>{t('performance_avgPrefix')} {chartAvgLabel}</Text>
              </View>
              <View style={styles.chartRow}>
                {last7.map((r, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: (formBarHeight(r?.result ?? null) / 100) * CHART_HEIGHT },
                          i === last7.length - 1 && styles.barFillToday,
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>
                      {r ? (r.result === 'win' ? t('performance_formWin') : r.result === 'draw' ? t('performance_formDraw') : r.result === 'loss' ? t('performance_formLoss') : '-') : days[i]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Platform comparison */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('performance_platformComparisonTitle')}</Text>
              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>{t('performance_you')}</Text>
                <View style={styles.compareTrack}>
                  <View style={[styles.compareFill, { width: `${Math.min(100, score)}%`, backgroundColor: theme.gold }]} />
                </View>
                <Text style={styles.compareValue}>{score}</Text>
              </View>
              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>{t('performance_average')}</Text>
                <View style={styles.compareTrack}>
                  <View
                    style={[
                      styles.compareFill,
                      { width: `${Math.min(100, PLATFORM_AVERAGE_SCORE)}%`, backgroundColor: theme.textSecondary },
                    ]}
                  />
                </View>
                <Text style={styles.compareValue}>{PLATFORM_AVERAGE_SCORE}</Text>
              </View>
              <Text style={styles.compareHint}>
                {score >= PLATFORM_AVERAGE_SCORE
                  ? `${t('performance_aboveAveragePrefix')}${score - PLATFORM_AVERAGE_SCORE}${t('performance_aboveAverageSuffix')}`
                  : `${t('performance_belowAveragePrefix')}${PLATFORM_AVERAGE_SCORE - score}${t('performance_belowAverageSuffix')}`}
              </Text>
            </View>

            {/* Skill Bars */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('performance_skillScoresTitle')}</Text>
              {skills.map((s, i) => (
                <View key={i} style={styles.skillItem}>
                  <View style={styles.skillTop}>
                    <Text style={styles.skillName}>{s.name}</Text>
                    <Text style={styles.skillVal}>{s.value}</Text>
                  </View>
                  <View style={styles.skillTrack}>
                    <View style={[styles.skillFill, { width: `${s.value}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Premium CTA */}
        <HapticTouchable style={styles.premiumCard} onPress={() => navigate('premium')}>
          <Ionicons name="star" size={22} color={theme.gold} style={{ marginBottom: 10 }} />
          <Text style={styles.premiumTitle}>{t('performance_premiumCta')}</Text>
          <Text style={styles.premiumSub}>
            {t('performance_premiumSub')}
          </Text>
          <View style={styles.premiumBtn}>
            <Text style={styles.premiumBtnText}>{t('performance_upgradeNow')}</Text>
          </View>
        </HapticTouchable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1 },
    header: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
    },
    title: { fontFamily: FontFamily.display, fontSize: 22, color: theme.text, letterSpacing: 0.5 },
    aiCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    aiLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.gold, letterSpacing: 1.5 },
    aiText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text, lineHeight: 22 },
    miniRow: {
      flexDirection: 'row',
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    miniCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 18,
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    miniVal: { fontFamily: FontFamily.display, fontSize: 20, color: theme.gold },
    miniLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary, marginTop: 2 },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { fontFamily: FontFamily.display, fontSize: 16, color: theme.text, letterSpacing: 0.5 },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    chartAvg: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.gold },
    chartRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    barCol: { alignItems: 'center', gap: 10 },
    barTrack: {
      height: 120,
      width: 16,
      backgroundColor: theme.border,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      backgroundColor: theme.card2,
    },
    barFillToday: { backgroundColor: theme.gold },
    barLabel: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary },
    compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    compareLabel: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, width: 70 },
    compareTrack: { flex: 1, height: 6, backgroundColor: theme.border, overflow: 'hidden' },
    compareFill: { height: 6 },
    compareValue: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.text, width: 30, textAlign: 'right' },
    compareHint: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginTop: 14 },
    skillItem: { marginTop: 16 },
    skillTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    skillName: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted },
    skillVal: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.text },
    skillTrack: { height: 4, backgroundColor: theme.border },
    skillFill: {
      height: 4,
      backgroundColor: theme.gold,
    },
    premiumCard: {
      marginHorizontal: 24,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.gold,
    },
    premiumTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 17, color: theme.text, marginBottom: 6 },
    premiumSub: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 18,
    },
    premiumBtn: {
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 24,
      paddingVertical: 13,
    },
    premiumBtnText: { fontFamily: FontFamily.display, fontSize: 13, letterSpacing: 0.5, color: Paper.ink },
  });
