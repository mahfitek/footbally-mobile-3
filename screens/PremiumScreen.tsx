import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
} from 'react-native';
import HapticTouchable from '../components/HapticTouchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { fetchPremiumStatus, INACTIVE_PREMIUM, PremiumStatus } from '../lib/premium';
import LoadingScreen from '../components/LoadingScreen';
import SectionHeader from '../components/SectionHeader';
import PremiumEftSection from '../components/PremiumEftSection';

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

const formatDate = (iso: string, lang: 'tr' | 'en') =>
  new Date(iso).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  navigate: (screen: string) => void;
  previousScreen?: string;
}

export default function PremiumScreen({ navigate, previousScreen }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  // Yalnızca aylık plan satılır (99 TL/ay). Yıllık fiyat ve deneme süresi kaldırıldı:
  // ödeme altyapısı yalnızca aylık dönemi destekliyor.
  const PLANS = getPlans(t).filter((p) => p.id === 'monthly');
  const BENEFITS = getBenefits(t);
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [memberNo, setMemberNo] = useState<number | null>(null);
  const [premium, setPremium] = useState<PremiumStatus>(INACTIVE_PREMIUM);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('monthly');

  useEffect(() => {
    loadData();
  }, []);

  // Premium durumu ve üye numarası sunucudan okunur. Kullanıcı metadata'sındaki
  // premium alanı istemci tarafından yazılabildiği için hiçbir karar ona dayanmaz.
  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const [status, profileRes] = await Promise.all([
          fetchPremiumStatus(user.id),
          profiles.ownProfile('member_no'),
        ]);
        setPremium(status);
        setMemberNo(profileRes.data?.member_no ?? null);
      }
    } catch (err) {
      if (__DEV__) console.log('Premium durumu yüklenirken beklenmeyen hata:', err);
    }
    setLoading(false);
  };

  const isPremiumActive = premium.active;
  const premiumUntil = premium.until;

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

        {!isPremiumActive && (
          <>
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

        {/* Havale/EFT akışı yalnızca geliştirme önizlemesinde açılır. Mağaza
            sürümlerinde IBAN talimatı yayımlanmaz; uygun ödeme sistemi ayrıca belirlenir. */}
        {!isPremiumActive && (__DEV__ ? (
          <PremiumEftSection memberNo={memberNo} />
        ) : (
          <Text style={styles.ctaSub}>{t('premium_productionNote')}</Text>
        ))}
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
