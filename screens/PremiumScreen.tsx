import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import HapticTouchable from '../components/HapticTouchable';
import BottomSheet from '../components/BottomSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import SectionHeader from '../components/SectionHeader';

type PlanId = 'monthly' | 'yearly';

const getPlans = (t: (key: any) => string): {
  id: PlanId;
  label: string;
  price: number;
  period: string;
  originalPrice?: number;
  badge?: string;
  days: number | null;
}[] => [
  { id: 'monthly', label: t('premium_planMonthlyLabel'), price: 99, period: t('premium_perMonth'), days: 30 },
  {
    id: 'yearly',
    label: t('premium_planYearlyLabel'),
    price: 999,
    period: t('premium_perYear'),
    originalPrice: 1188,
    badge: t('premium_bestValueBadge'),
    days: 365,
  },
];

const getStats = (t: (key: any) => string) => [
  { value: '2.4K+', label: t('premium_activePlayers') },
  { value: '180+', label: 'Scout' },
  { value: '%94', label: t('premium_satisfaction') },
];

const getBenefits = (t: (key: any) => string) => [
  t('premium_benefit1'),
  t('premium_benefit2'),
  t('premium_benefit3'),
  t('premium_benefit4'),
  t('premium_benefit5'),
  t('premium_benefit6'),
  t('premium_benefit7'),
  t('premium_benefit8'),
];

const getTestimonials = (t: (key: any) => string) => [
  { name: 'Ahmet K.', age: 19, text: t('premium_testimonial1Text'), rating: 5 },
  { name: 'Mehmet Y.', age: 22, text: t('premium_testimonial2Text'), rating: 5 },
  { name: 'Emre S.', age: 17, text: t('premium_testimonial3Text'), rating: 5 },
];

const formatDate = (iso: string, lang: 'tr' | 'en') =>
  new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  navigate: (screen: string) => void;
  previousScreen?: string;
}

export default function PremiumScreen({ navigate, previousScreen }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const PLANS = getPlans(t);
  const STATS = getStats(t);
  const BENEFITS = getBenefits(t);
  const TESTIMONIALS = getTestimonials(t);
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setIsPremium(!!user.user_metadata?.premium);
      setPremiumUntil(user.user_metadata?.premium_until ?? null);
    } catch (err) {
      if (__DEV__) console.log('Premium durumu yüklenirken beklenmeyen hata:', err);
    }
    setLoading(false);
  };

  const isPremiumActive = isPremium && (!premiumUntil || new Date(premiumUntil) > new Date());

  const handleStartTrial = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const { error } = await supabase.auth.updateUser({
        data: { premium: true, premium_until: until.toISOString() },
      });
      if (error) throw error;

      setIsPremium(true);
      setPremiumUntil(until.toISOString());
      setModalVisible(true);
      sendLocalNotification(t('premium_activatedNotifTitle'), t('premium_activatedNotifBody'));
    } catch (err) {
      if (__DEV__) console.log('Premium aktifleştirilemedi:', err);
      setToast({ message: t('premium_trialFailed'), type: 'error' });
    }
    setSubmitting(false);
  };

  const handleCloseSuccess = () => {
    setModalVisible(false);
    navigate('profile');
  };

  if (loading) {
    return <LoadingScreen message={t('premium_loading')} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate(previousScreen ?? 'home')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
        </View>

        <View style={{ backgroundColor: 'transparent' }}>
          <Image
            source={require('../assets/logo-text.png')}
            style={{ width: 180, height: 48, resizeMode: 'contain', alignSelf: 'center' }}
          />
        </View>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>FOOTBALLY PRO</Text>
          </View>
          {isPremiumActive ? (
            <Text style={styles.title}>
              {t('premium_heroActivePrefix')}<Text style={styles.titleGold}>{t('premium_heroActiveGold')}</Text>
            </Text>
          ) : (
            <Text style={styles.title}>
              {t('premium_heroInactivePrefix')}<Text style={styles.titleGold}>{t('premium_heroInactiveGold')}</Text>
            </Text>
          )}
          <Text style={styles.subtitle}>
            {isPremiumActive
              ? premiumUntil
                ? `${t('premium_activeUntilPrefix')}${formatDate(premiumUntil, lang)}${t('premium_activeUntilSuffix')}`
                : t('premium_lifetimeActive')
              : t('premium_heroSubtitleInactive')}
          </Text>
        </View>

        <View style={styles.statsRow}>
          {STATS.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {!isPremiumActive && (
          <>
            <View style={styles.launchBanner}>
              <Ionicons name="flash" size={13} color={theme.gold} />
              <Text style={styles.launchBannerText}>{t('premium_specialPricingBanner')}</Text>
            </View>
            <Text style={styles.sectionTitle}>{t('premium_sectionPlan')}</Text>
            <View style={styles.plansRow}>
              {PLANS.map((p) => {
                const selected = selectedPlan === p.id;
                return (
                  <HapticTouchable
                    key={p.id}
                    style={[styles.planCard, selected && styles.planCardSelected]}
                    onPress={() => setSelectedPlan(p.id)}
                  >
                    {p.badge && (
                      <View style={styles.planBadge}>
                        <Text style={styles.planBadgeText}>{p.badge}</Text>
                      </View>
                    )}
                    <Text style={[styles.planLabel, selected && styles.planLabelSelected]}>{p.label}</Text>
                    <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>₺{p.price}</Text>
                    <Text style={styles.planPeriod}>{p.period}</Text>
                    {p.originalPrice && <Text style={styles.planOriginal}>{t('premium_insteadOfPrefix')}₺{p.originalPrice}{t('premium_insteadOfSuffix')}</Text>}
                  </HapticTouchable>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.benefitsCard}>
          {BENEFITS.map((b, i) => (
            <View
              key={i}
              style={[styles.benefitRow, i === BENEFITS.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={styles.check}>
                <Ionicons name="checkmark" size={13} color={theme.gold} />
              </View>
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title={t('premium_sectionTestimonials')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={styles.testimonialsRow}
        >
          {TESTIMONIALS.map((item, i) => (
            <View key={i} style={styles.testimonialCard}>
              <View style={styles.testimonialStars}>
                {Array.from({ length: item.rating }).map((_, si) => (
                  <Ionicons key={si} name="star" size={12} color={theme.gold} />
                ))}
              </View>
              <Text style={styles.testimonialText}>"{item.text}"</Text>
              <Text style={styles.testimonialName}>
                {item.name}, {item.age} {t('teamProfile_ageSuffix')}
              </Text>
            </View>
          ))}
        </ScrollView>

        {!isPremiumActive && (
          <>
            <HapticTouchable
              style={[styles.ctaBtn, submitting && styles.btnDisabled]}
              onPress={handleStartTrial}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Paper.ink} />
              ) : (
                <Text style={styles.ctaText}>{t('premium_ctaText')}</Text>
              )}
            </HapticTouchable>
            <Text style={styles.ctaSub}>{t('premium_ctaSub')}</Text>
          </>
        )}
      </ScrollView>

      <BottomSheet visible={modalVisible} onClose={handleCloseSuccess} theme={theme}>
        <View style={styles.successWrap}>
          <Ionicons name="trophy-outline" size={44} color={theme.gold} style={{ marginBottom: 16 }} />
          <Text style={styles.successTitle}>{t('premium_successTitle')}</Text>
          <Text style={styles.successSub}>
            {t('premium_successSub')}
          </Text>
          <HapticTouchable style={styles.modalSaveBtn} onPress={handleCloseSuccess}>
            <Text style={styles.modalSaveText}>{t('premium_goToProfile')}</Text>
          </HapticTouchable>
        </View>
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
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 8,
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
    hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
    badge: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginBottom: 20,
    },
    badgeText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.goldDark, letterSpacing: 1.5 },
    title: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 34,
      letterSpacing: 0.5,
    },
    titleGold: { color: theme.goldDark },
    subtitle: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginTop: 10, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 24, marginBottom: 28 },
    statCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    statValue: { fontFamily: FontFamily.display, color: theme.goldDark, fontSize: 22 },
    statLabel: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 11, marginTop: 4 },
    launchBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      alignSelf: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      paddingVertical: 6,
      marginBottom: 14,
    },
    launchBannerText: { fontFamily: FontFamily.monoMedium, fontSize: 11, color: theme.goldDark, letterSpacing: 0.5 },
    sectionTitle: {
      fontFamily: FontFamily.display,
      fontSize: 16,
      color: theme.text,
      paddingHorizontal: 24,
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    plansRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 28 },
    planCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      position: 'relative',
    },
    planCardSelected: { borderColor: theme.gold, backgroundColor: theme.card2 },
    planBadge: {
      position: 'absolute',
      top: -10,
      backgroundColor: theme.gold,
      borderRadius: RADIUS - 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    planBadgeText: { fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: Paper.ink },
    planLabel: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted, marginTop: 8 },
    planLabelSelected: { color: theme.goldDark },
    planPrice: { fontFamily: FontFamily.display, fontSize: 19, color: theme.text, marginTop: 8 },
    planPriceSelected: { color: theme.goldDark },
    planPeriod: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginTop: 2 },
    planOriginal: {
      fontFamily: FontFamily.mono,
      fontSize: 10,
      color: theme.textSecondary,
      marginTop: 4,
      textDecorationLine: 'line-through',
    },
    benefitsCard: {
      marginHorizontal: 24,
      marginBottom: 28,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: RADIUS - 2,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitText: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, flex: 1 },
    testimonialsRow: { paddingHorizontal: 24, paddingBottom: 28 },
    testimonialCard: {
      width: 250,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    testimonialStars: { flexDirection: 'row', gap: 2, marginBottom: 8 },
    testimonialText: { fontFamily: FontFamily.body, color: theme.text, fontSize: 13, lineHeight: 20, marginBottom: 12 },
    testimonialName: { fontFamily: FontFamily.bodySemiBold, color: theme.textMuted, fontSize: 12 },
    ctaBtn: {
      marginHorizontal: 24,
      height: 56,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontFamily: FontFamily.display, fontSize: 14, color: Paper.ink, letterSpacing: 0.5 },
    ctaSub: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, textAlign: 'center', marginTop: 14 },
    // Pasif CTA: opacity yerine gri zemin, spinner/metin okunur kalır.
    btnDisabled: { backgroundColor: theme.border },
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
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalSaveBtn: {
      flex: 1,
      height: 50,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSaveText: { fontFamily: FontFamily.display, fontSize: 13, color: Paper.ink, letterSpacing: 0.5 },
    successWrap: { alignItems: 'center', paddingVertical: 20 },
    successTitle: { fontFamily: FontFamily.display, fontSize: 22, color: theme.goldDark, marginBottom: 8, letterSpacing: 0.5 },
    successSub: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
  });
