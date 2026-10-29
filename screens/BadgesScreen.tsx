import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { fetchPremiumStatus, INACTIVE_PREMIUM } from '../lib/premium';
import {
  getLevel,
  getBadges,
  claimBadgeReward,
  loadRewardProgress,
  MAX_REWARD_PREMIUM_DAYS_PER_MONTH,
  REWARD_CLAIM_ENABLED,
  Badge,
} from '../lib/rewards';
import { calculateProfileCompletion } from '../lib/profileScore';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';
import SectionHeader from '../components/SectionHeader';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

interface Props {
  navigate: (screen: string) => void;
  userId?: string | null;
}

export default function BadgesScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [hasProfileBasics, setHasProfileBasics] = useState(false);
  const [isPremiumActive, setIsPremiumActive] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [claimedKeys, setClaimedKeys] = useState<string[]>([]);
  const [daysClaimedThisMonth, setDaysClaimedThisMonth] = useState(0);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    load();
  }, [userId]);

  const load = async () => {
    setLoading(true);
    let uid = userId;
    const { data: { session } } = await supabase.auth.getSession();
    if (!uid) uid = session?.user?.id ?? null;
    setResolvedUserId(uid ?? null);

    if (uid) {
      const status = await fetchPremiumStatus(uid).catch(() => INACTIVE_PREMIUM);
      setIsPremiumActive(status.active);
    }

    if (uid) {
      // ProfileScreen ile aynı tamamlanma puanı; sunucudaki profiles.score okunmaz (güncel olmayabilir).
      const { data } = await profiles.ownProfile(
        'full_name, position, age, height, weight, city, district, foot, club'
      );
      setScore(data ? calculateProfileCompletion(data) : 0);
      setHasProfileBasics(!!(data?.position && data?.city && data?.age));

      const progress = await loadRewardProgress(uid);
      setClaimedKeys(progress.claimedBadgeKeys);
      setDaysClaimedThisMonth(progress.daysClaimedThisMonth);
    }
    setLoading(false);
  };

  const handleClaim = async (badge: Badge) => {
    if (!resolvedUserId || claimingKey) return;
    setClaimingKey(badge.key);
    const result = await claimBadgeReward(resolvedUserId, badge, t);
    if (result.ok) {
      setClaimedKeys((prev) => [...prev, badge.key]);
      setDaysClaimedThisMonth((prev) => prev + result.grantedDays);
      setIsPremiumActive(true);
    }
    setToast({ message: result.message, type: result.ok ? 'success' : 'error' });
    setClaimingKey(null);
  };

  const level = getLevel(score, t);
  const progressPct = Math.min(100, score);
  const remainingRewardDays = Math.max(0, MAX_REWARD_PREMIUM_DAYS_PER_MONTH - daysClaimedThisMonth);

  const badges = getBadges(score, hasProfileBasics, isPremiumActive, t);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.backBtn} />
          <Text style={styles.title}>{t('badges_title')}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <SkeletonCard height={100} />
          <SkeletonCard height={80} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('settings')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('badges_title')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.levelCard}>
          <View style={styles.levelTopRow}>
            <Text style={styles.levelLabel}>{t('badges_yourLevel')}</Text>
            <Text style={[styles.levelValue, { color: theme[level.colorKey] }]}>{level.label}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: theme[level.colorKey] }]} />
          </View>
          <Text style={styles.progressText}>{t('profile_completionLabel')} {score}/100</Text>
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="sparkles-outline" size={16} color={theme.gold} />
          <Text style={styles.tipText}>
            {t('badges_tip')}
          </Text>
        </View>

        <View style={styles.rewardCard}>
          <View style={styles.levelTopRow}>
            <Text style={styles.levelLabel}>{t('badges_monthlyRewardLabel')}</Text>
            <Text style={[styles.levelValue, { fontSize: 15, color: theme.goldDark }]}>{daysClaimedThisMonth}/{MAX_REWARD_PREMIUM_DAYS_PER_MONTH} {t('badges_daysSuffix')}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(daysClaimedThisMonth / MAX_REWARD_PREMIUM_DAYS_PER_MONTH) * 100}%`, backgroundColor: theme.gold }]} />
          </View>
          <Text style={styles.progressText}>
            {remainingRewardDays > 0
              ? `${t('badges_remainingRewardPrefix')}${remainingRewardDays}${t('badges_remainingRewardSuffix')}`
              : t('badges_capReachedText')}
          </Text>
        </View>

        <SectionHeader title={`${t('badges_badgesHeader')} (${badges.filter((b) => b.unlocked).length}/${badges.length})`} />

        <View style={styles.grid}>
          {badges.map((b) => {
            const claimed = claimedKeys.includes(b.key);
            const canClaim = REWARD_CLAIM_ENABLED && b.unlocked && b.rewardDays > 0 && !claimed;
            return (
              <View key={b.key} style={[styles.badgeCard, !b.unlocked && styles.badgeCardLocked]}>
                <View style={[styles.badgeIconWrap, { backgroundColor: b.unlocked ? hexToRgba(theme.gold, 0.16) : theme.card2 }]}>
                  <Ionicons name={b.unlocked ? (b.icon as IoniconName) : 'lock-closed-outline'} size={20} color={b.unlocked ? theme.gold : theme.textSecondary} />
                </View>
                <Text style={[styles.badgeTitle, !b.unlocked && { color: theme.textSecondary }]}>{b.title}</Text>
                <Text style={styles.badgeDesc}>{b.desc}</Text>
                {b.rewardDays > 0 && (
                  <Text style={styles.badgeRewardText}>
                    {claimed ? `+${b.rewardDays} ${t('badges_daysPremiumClaimed')}` : `+${b.rewardDays} ${t('badges_daysPremium')}`}
                  </Text>
                )}
                {canClaim && (
                  <HapticTouchable
                    style={[styles.claimBtn, claimingKey === b.key && { opacity: 0.6 }]}
                    onPress={() => handleClaim(b)}
                    disabled={!!claimingKey}
                  >
                    <Text style={styles.claimBtnText}>{claimingKey === b.key ? t('badges_claiming') : t('badges_claimReward')}</Text>
                  </HapticTouchable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

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
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
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
    title: { color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5 },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    levelCard: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
    },
    levelTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    levelLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 1.5 },
    levelValue: { fontFamily: FontFamily.display, fontSize: 18, letterSpacing: 0.5 },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: theme.border, overflow: 'hidden', marginBottom: 8 },
    progressFill: { height: 8, borderRadius: 4 },
    progressText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
    tipCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.35),
      borderRadius: RADIUS,
      padding: 14,
      marginBottom: 20,
      alignItems: 'flex-start',
    },
    tipText: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
    rewardCard: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.gold,
      marginBottom: 20,
    },
    sectionLabel: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, letterSpacing: 1.5, marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badgeCard: {
      width: '47%',
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.gold,
    },
    // Kilitli rozet: opacity yerine sakin çerçeve; metinler okunur kalır.
    badgeCardLocked: { borderColor: theme.border },
    badgeIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    badgeTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text, marginBottom: 4 },
    badgeDesc: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, lineHeight: 16 },
    badgeRewardText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: theme.goldDark, marginTop: 8 },
    claimBtn: {
      marginTop: 10,
      backgroundColor: theme.gold,
      borderRadius: RADIUS - 4,
      paddingVertical: 8,
      alignItems: 'center',
    },
    claimBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: Paper.ink },
  });
