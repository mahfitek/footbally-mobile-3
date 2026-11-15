import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { referralRpcClient as rpcClient } from '../lib/referralClient';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';
import {
  REFERRAL_GROUP_SIZE,
  buildShareMessage,
  fetchReferralSummary,
  getOrCreateReferralCode,
  normalizeReferralCode,
  redeemReferralCode,
  type ReferralRedeemFailure,
  type ReferralSummary,
} from '../lib/referral';
import { loadPendingReferralCode, clearPendingReferralCode } from '../lib/referralStorage';
import type { TranslationKey } from '../lib/i18n';

const RADIUS = CARD_RADIUS;
const APP_NAME = 'Footbally';

const REDEEM_ERROR_KEYS: Record<ReferralRedeemFailure, TranslationKey> = {
  own_code: 'referral_err_own_code',
  already_used: 'referral_err_already_used',
  too_old: 'referral_err_too_old',
  invalid_code: 'referral_err_invalid_code',
  restricted: 'referral_err_restricted',
  unknown: 'referral_err_unknown',
};

interface Props {
  navigate: (screen: string) => void;
}

export default function ReferralScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const styles = createStyles(theme);

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const load = useCallback(async () => {
    const result = await fetchReferralSummary(rpcClient);
    if (!result.ok) {
      setLoadFailed(true);
      setLoading(false);
      return;
    }
    let currentCode = result.summary.code;
    if (!currentCode) currentCode = await getOrCreateReferralCode(rpcClient);
    setSummary(result.summary);
    setCode(currentCode);
    setLoadFailed(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const pending = await loadPendingReferralCode();
      if (active && pending) setInput(pending);
      await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setToast({ message: t('referral_copied'), type: 'success' });
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({ message: buildShareMessage(lang, APP_NAME, code), title: t('referral_shareTitle') });
    } catch {
      setToast({ message: t('referral_shareFailed'), type: 'error' });
    }
  };

  const handleRedeem = async () => {
    const normalized = normalizeReferralCode(input);
    if (!normalized) return;
    setRedeeming(true);
    const result = await redeemReferralCode(rpcClient, normalized);
    setRedeeming(false);
    if (!result.ok) {
      setToast({ message: t(REDEEM_ERROR_KEYS[result.reason]), type: 'error' });
      return;
    }
    await clearPendingReferralCode();
    setInput('');
    setToast({ message: t('referral_enterDone'), type: 'success' });
    setLoading(true);
    await load();
  };

  const progress = summary ? summary.progress : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('profile')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('referral_title')}</Text>
        <View style={styles.backBtnSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.gold} />
        </View>
      ) : loadFailed ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t('referral_loadFailed')}</Text>
          <HapticTouchable style={styles.primaryBtn} onPress={() => { setLoading(true); void load(); }}>
            <Text style={styles.primaryBtnText}>{t('referral_enterBtn')}</Text>
          </HapticTouchable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>{t('referral_subtitle')}</Text>

          <View style={styles.card}>
            <Text style={styles.label}>{t('referral_yourCode')}</Text>
            {code ? (
              <Text style={styles.code} selectable>{code}</Text>
            ) : (
              <Text style={styles.muted}>{t('referral_codeUnavailable')}</Text>
            )}
            <View style={styles.actionRow}>
              <HapticTouchable style={[styles.secondaryBtn, !code && styles.disabled]} onPress={handleCopy} disabled={!code}>
                <Ionicons name="copy-outline" size={15} color={theme.gold} />
                <Text style={styles.secondaryBtnText}>{t('referral_copy')}</Text>
              </HapticTouchable>
              <HapticTouchable style={[styles.primaryBtnFlex, !code && styles.disabled]} onPress={handleShare} disabled={!code}>
                <Ionicons name="share-social-outline" size={15} color={Paper.ink} />
                <Text style={styles.primaryBtnText}>{t('referral_share')}</Text>
              </HapticTouchable>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.progressHeader}>
              <Text style={styles.label}>{t('referral_stats_nextReward')}</Text>
              <Text style={styles.progressValue}>{progress}/{REFERRAL_GROUP_SIZE}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(progress / REFERRAL_GROUP_SIZE) * 100}%` }]} />
            </View>

            <View style={styles.statsRow}>
              <Stat label={t('referral_stats_invited')} value={summary?.invitedCount ?? 0} styles={styles} />
              <Stat label={t('referral_stats_qualified')} value={summary?.qualifiedCount ?? 0} styles={styles} />
              <Stat label={t('referral_stats_rewards')} value={summary?.rewardMonthsTotal ?? 0} styles={styles} />
            </View>
            <Text style={styles.note}>{t('referral_progressNote')}</Text>
          </View>

          {summary?.canRedeem && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('referral_enterTitle')}</Text>
              <Text style={styles.muted}>{t('referral_enterSub')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('referral_enterPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={input}
                onChangeText={setInput}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
              />
              <HapticTouchable
                style={[styles.primaryBtn, (redeeming || !input.trim()) && styles.disabled]}
                onPress={handleRedeem}
                disabled={redeeming || !input.trim()}
              >
                {redeeming ? (
                  <ActivityIndicator color={Paper.ink} />
                ) : (
                  <Text style={styles.primaryBtnText}>{t('referral_enterBtn')}</Text>
                )}
              </HapticTouchable>
            </View>
          )}
        </ScrollView>
      )}

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
      width: 42,
      height: 42,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backBtnSpacer: { width: 42 },
    title: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text, letterSpacing: 0.5 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
    content: { paddingHorizontal: 20, paddingBottom: 60, gap: 14 },
    subtitle: { fontFamily: FontFamily.body, fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
    card: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 10,
    },
    cardTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 16, color: theme.text },
    label: { fontFamily: FontFamily.mono, fontSize: 11, letterSpacing: 1, color: theme.textSecondary },
    code: { fontFamily: FontFamily.display, fontSize: 30, letterSpacing: 4, color: theme.goldDark },
    muted: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted },
    note: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, marginTop: 4 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    primaryBtn: {
      height: 48,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 18,
    },
    primaryBtnFlex: {
      flex: 1,
      height: 48,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    primaryBtnText: { fontFamily: FontFamily.display, fontSize: 14, letterSpacing: 0.5, color: Paper.ink },
    secondaryBtn: {
      flex: 1,
      height: 48,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    secondaryBtnText: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.goldDark },
    disabled: { opacity: 0.5 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressValue: { fontFamily: FontFamily.display, fontSize: 16, color: theme.goldDark },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: theme.card2, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: theme.gold },
    statsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
    stat: {
      flex: 1,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      gap: 4,
    },
    statValue: { fontFamily: FontFamily.display, fontSize: 20, color: theme.goldDark },
    statLabel: { fontFamily: FontFamily.body, fontSize: 11, color: theme.textMuted, textAlign: 'center' },
    input: {
      height: 50,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      color: theme.text,
      fontSize: 16,
      fontFamily: FontFamily.mono,
      letterSpacing: 2,
      borderWidth: 1,
      borderColor: theme.border,
    },
  });
