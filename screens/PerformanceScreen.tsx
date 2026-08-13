import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import LoadingScreen from '../components/LoadingScreen';
import EmptyState from '../components/EmptyState';
import HapticTouchable from '../components/HapticTouchable';

const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const skills = [
  { name: 'Hız', value: 0 },
  { name: 'Pas', value: 0 },
  { name: 'Şut', value: 0 },
  { name: 'Dayanıklılık', value: 0 },
  { name: 'Dribbling', value: 0 },
  { name: 'Savunma', value: 0 },
];

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

  const miniStats = [
    { icon: '⚽', val: String(goals), label: 'Gol' },
    { icon: '🏆', val: String(wins), label: 'Galibiyet' },
    { icon: '🏟️', val: String(matchesPlayed), label: 'Maç' },
  ];

  const hasPlayed = matchesPlayed > 0;
  const winRate = hasPlayed ? Math.round((wins / matchesPlayed) * 100) : 0;

  const aiInsight = hasPlayed
    ? matchesPlayed >= 3
      ? `Son ${matchesPlayed} maçında %${winRate} galibiyet oranın ve toplam ${goals} golün var. ${
          winRate >= 50 ? 'Harika gidiyorsun, bu formu koru!' : 'Daha fazla maça katılarak formunu yükseltebilirsin.'
        }`
      : `${matchesPlayed} maç oynadın. Daha fazla maça katıl, performansını takip edelim.`
    : 'İlk maçını oyna ve AI analizini gör';

  const chartAvgLabel = weeklyForm.length > 0
    ? Math.round(weeklyForm.reduce((sum, r) => sum + formBarHeight(r.result), 0) / weeklyForm.length)
    : 0;

  const last7 = Array.from({ length: 7 }, (_, i) => weeklyForm[weeklyForm.length - 7 + i] ?? null);

  if (loading) {
    return <LoadingScreen message="Performans yükleniyor..." />;
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
          <Text style={styles.title}>Performans</Text>
        </View>

        {/* AI Insight */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiIcon}>🤖</Text>
            <Text style={styles.aiLabel}>AI ANALİZİ</Text>
          </View>
          <Text style={styles.aiText}>{aiInsight}</Text>
        </View>

        {!hasPlayed ? (
          <EmptyState
            icon="🏆"
            title="Henüz maç verisi yok"
            subtitle="Maçlara katıl ve performansını takip et!"
            actionLabel="Maç Bul"
            onAction={() => navigate('match')}
          />
        ) : (
          <>
            {/* Mini Stats */}
            <View style={styles.miniRow}>
              {miniStats.map((m, i) => (
                <View key={i} style={styles.miniCard}>
                  <Text style={styles.miniIcon}>{m.icon}</Text>
                  <Text style={styles.miniVal}>{m.val}</Text>
                  <Text style={styles.miniLabel}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* Weekly Form Chart */}
            <View style={styles.card}>
              <View style={styles.chartHeader}>
                <Text style={styles.cardTitle}>Son 7 Maç Formu</Text>
                <Text style={styles.chartAvg}>Ort. {chartAvgLabel}</Text>
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
                      {r ? (r.result === 'win' ? 'G' : r.result === 'draw' ? 'B' : r.result === 'loss' ? 'M' : '-') : days[i]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Platform comparison */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Platform Karşılaştırması</Text>
              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>Sen</Text>
                <View style={styles.compareTrack}>
                  <View style={[styles.compareFill, { width: `${Math.min(100, score)}%`, backgroundColor: theme.gold }]} />
                </View>
                <Text style={styles.compareValue}>{score}</Text>
              </View>
              <View style={styles.compareRow}>
                <Text style={styles.compareLabel}>Ortalama</Text>
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
                  ? `Platform ortalamasının ${score - PLATFORM_AVERAGE_SCORE} puan üzerindesin 🎉`
                  : `Platform ortalamasının ${PLATFORM_AVERAGE_SCORE - score} puan altındasın`}
              </Text>
            </View>

            {/* Skill Bars */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Yetenek Skorları</Text>
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
          <Text style={styles.premiumIcon}>✦</Text>
          <Text style={styles.premiumTitle}>Premium'a Geç</Text>
          <Text style={styles.premiumSub}>
            Detaylı analiz, sınırsız video ve scout görünürlüğü
          </Text>
          <View style={styles.premiumBtn}>
            <Text style={styles.premiumBtnText}>Şimdi Yükselt →</Text>
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
    title: { fontSize: 22, fontWeight: '800', color: theme.text },
    aiCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1.5,
      borderColor: theme.gold,
    },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    aiIcon: { fontSize: 16 },
    aiLabel: { fontSize: 11, fontWeight: '700', color: theme.gold, letterSpacing: 1.5 },
    aiText: { fontSize: 15, color: theme.text, lineHeight: 22, fontWeight: '600' },
    miniRow: {
      flexDirection: 'row',
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 20,
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
    miniIcon: { fontSize: 20, marginBottom: 6 },
    miniVal: { fontSize: 20, fontWeight: '800', color: theme.gold },
    miniLabel: { fontSize: 10, color: theme.textSecondary, fontWeight: '600', marginTop: 2 },
    card: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    chartAvg: { fontSize: 12, color: theme.gold, fontWeight: '700' },
    chartRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
    },
    barCol: { alignItems: 'center', gap: 10 },
    barTrack: {
      height: 120,
      width: 18,
      backgroundColor: theme.border,
      borderRadius: 6,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: {
      width: '100%',
      backgroundColor: hexToRgba(theme.gold, 0.45),
      borderRadius: 6,
    },
    barFillToday: { backgroundColor: theme.gold },
    barLabel: { fontSize: 10, color: theme.textSecondary, fontWeight: '600' },
    compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    compareLabel: { fontSize: 12, color: theme.textSecondary, width: 70, fontWeight: '600' },
    compareTrack: { flex: 1, height: 10, backgroundColor: theme.border, borderRadius: 5, overflow: 'hidden' },
    compareFill: { height: 10, borderRadius: 5 },
    compareValue: { fontSize: 13, color: theme.text, fontWeight: '800', width: 30, textAlign: 'right' },
    compareHint: { fontSize: 12, color: theme.textSecondary, marginTop: 14 },
    skillItem: { marginTop: 16 },
    skillTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    skillName: { fontSize: 13, color: theme.textMuted },
    skillVal: { fontSize: 13, color: theme.text, fontWeight: '700' },
    skillTrack: { height: 4, backgroundColor: theme.border, borderRadius: 2 },
    skillFill: {
      height: 4,
      backgroundColor: theme.gold,
      borderRadius: 2,
    },
    premiumCard: {
      marginHorizontal: 24,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.2),
    },
    premiumIcon: { fontSize: 26, color: theme.gold, marginBottom: 10 },
    premiumTitle: { fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 6 },
    premiumSub: {
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 18,
    },
    premiumBtn: {
      backgroundColor: theme.gold,
      borderRadius: 14,
      paddingHorizontal: 24,
      paddingVertical: 13,
    },
    premiumBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
  });
