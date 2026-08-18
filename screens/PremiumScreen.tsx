import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import HapticTouchable from '../components/HapticTouchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';

type PlanId = 'monthly' | 'yearly' | 'lifetime';

const PLANS: {
  id: PlanId;
  label: string;
  price: number;
  period: string;
  originalPrice?: number;
  badge?: string;
  days: number | null;
}[] = [
  { id: 'monthly', label: 'Aylık', price: 299, period: '/ay', days: 30 },
  {
    id: 'yearly',
    label: 'Yıllık',
    price: 1990,
    period: '/yıl',
    originalPrice: 2988,
    badge: '%33 İndirim',
    days: 365,
  },
  { id: 'lifetime', label: 'Ömür Boyu', price: 4990, period: 'tek seferlik', days: null },
];

const STATS = [
  { value: '2.4K+', label: 'Aktif Oyuncu' },
  { value: '180+', label: 'Scout' },
  { value: '%94', label: 'Memnuniyet' },
];

const BENEFITS = [
  'Sınırsız AI Performans Analizi',
  "Scout'lar Tarafından Öncelikli Görünme",
  'Detaylı Maç İstatistikleri',
  'Premium Profil Rozeti',
  'Özel Kulüp Davetleri',
  '7/24 Öncelikli Destek',
  'Gelişmiş Oyuncu Karşılaştırma',
  'Video Galeri (50 video)',
];

const TESTIMONIALS = [
  {
    name: 'Ahmet K.',
    age: 19,
    text: "Scout beni Footbally üzerinden buldu, şimdi 2. lig takımıyla görüşüyorum!",
    rating: 5,
  },
  {
    name: 'Mehmet Y.',
    age: 22,
    text: 'AI analizi sayesinde eksiklerimi gördüm ve 3 ayda büyük ilerleme kaydettim.',
    rating: 5,
  },
  {
    name: 'Emre S.',
    age: 17,
    text: 'Akademi seçmelerine Footbally üzerinden davet aldım. Harika platform!',
    rating: 5,
  },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  navigate: (screen: string) => void;
  previousScreen?: string;
}

export default function PremiumScreen({ navigate, previousScreen }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [modalVisible, setModalVisible] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
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
  const plan = PLANS.find((p) => p.id === selectedPlan)!;

  const handleOpenPayment = () => {
    setSuccess(false);
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setModalVisible(true);
  };

  // TODO: gerçek ödeme entegrasyonu (Iyzico/PayTR) gelince bu buton tekrar aktif edilecek
  const handleCompletePayment = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      // No real payment processor is wired up yet — this simulates a card charge,
      // but the resulting premium status is genuinely persisted to the account.
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const until = plan.days ? new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000) : null;
      const { error } = await supabase.auth.updateUser({
        data: { premium: true, premium_until: until ? until.toISOString() : null },
      });
      if (error) throw error;

      setIsPremium(true);
      setPremiumUntil(until ? until.toISOString() : null);
      setSuccess(true);
      sendLocalNotification('Premium Aktif', 'Footbally Pro üyeliğiniz başarıyla aktifleştirildi.');
    } catch (err) {
      if (__DEV__) console.log('Premium aktifleştirilemedi:', err);
      setToast({ message: 'Ödeme tamamlanamadı, tekrar deneyin', type: 'error' });
    }
    setSubmitting(false);
  };

  const handleCloseSuccess = () => {
    setModalVisible(false);
    setSuccess(false);
    navigate('profile');
  };

  if (loading) {
    return <LoadingScreen message="Yükleniyor..." />;
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
              Premium <Text style={styles.titleGold}>Aktif</Text>
            </Text>
          ) : (
            <Text style={styles.title}>
              Kariyerini <Text style={styles.titleGold}>Zirveye Taşı</Text>
            </Text>
          )}
          <Text style={styles.subtitle}>
            {isPremiumActive
              ? premiumUntil
                ? `${formatDate(premiumUntil)} tarihine kadar geçerli`
                : 'Ömür boyu üyeliğin aktif'
              : "Binlerce futbolcu Footbally Pro ile hayallerine ulaştı"}
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
            <Text style={styles.sectionTitle}>Planını Seç</Text>
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
                    {p.originalPrice && <Text style={styles.planOriginal}>₺{p.originalPrice} yerine</Text>}
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

        <Text style={styles.sectionTitle}>Oyuncularımız Ne Diyor?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.testimonialsRow}
        >
          {TESTIMONIALS.map((t, i) => (
            <View key={i} style={styles.testimonialCard}>
              <View style={styles.testimonialStars}>
                {Array.from({ length: t.rating }).map((_, si) => (
                  <Ionicons key={si} name="star" size={12} color={theme.gold} />
                ))}
              </View>
              <Text style={styles.testimonialText}>"{t.text}"</Text>
              <Text style={styles.testimonialName}>
                {t.name}, {t.age} yaş
              </Text>
            </View>
          ))}
        </ScrollView>

        {!isPremiumActive && (
          <>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Çok Yakında Hizmetinizde</Text>
            </View>
            <HapticTouchable style={[styles.ctaBtn, styles.ctaBtnDisabled]} disabled>
              <Text style={styles.ctaText}>Hemen Başla - 7 Gün Ücretsiz Dene</Text>
            </HapticTouchable>
            <Text style={styles.ctaSub}>Ödeme altyapımız hazırlanıyor · Çok yakında</Text>
          </>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !submitting && setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {success ? (
              <View style={styles.successWrap}>
                <Ionicons name="trophy-outline" size={44} color={theme.gold} style={{ marginBottom: 16 }} />
                <Text style={styles.successTitle}>Premium Aktif!</Text>
                <Text style={styles.successSub}>
                  Footbally Pro ayrıcalıkların hemen kullanıma hazır.
                </Text>
                <HapticTouchable style={styles.modalSaveBtn} onPress={handleCloseSuccess}>
                  <Text style={styles.modalSaveText}>Profilime Git</Text>
                </HapticTouchable>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>GÜVENLİ ÖDEME</Text>
                <View style={styles.planSummary}>
                  <Text style={styles.planSummaryLabel}>{plan.label} Plan</Text>
                  <Text style={styles.planSummaryValue}>
                    ₺{plan.price} {plan.period}
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>KART NUMARASI</Text>
                  <TextInput
                    style={styles.cardInput}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    placeholder="•••• •••• •••• ••••"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    maxLength={19}
                  />
                </View>

                <View style={styles.cardRow}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>AA/YY</Text>
                    <TextInput
                      style={styles.cardInput}
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                      placeholder="AA/YY"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>CVV</Text>
                    <TextInput
                      style={styles.cardInput}
                      value={cardCvv}
                      onChangeText={setCardCvv}
                      placeholder="•••"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="number-pad"
                      maxLength={3}
                      secureTextEntry
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <HapticTouchable
                    style={styles.modalCancelBtn}
                    onPress={() => setModalVisible(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.modalCancelText}>Vazgeç</Text>
                  </HapticTouchable>
                  <HapticTouchable
                    style={[styles.modalSaveBtn, submitting && styles.btnDisabled]}
                    onPress={handleCompletePayment}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color={Paper.ink} />
                    ) : (
                      <Text style={styles.modalSaveText}>Ödemeyi Tamamla</Text>
                    )}
                  </HapticTouchable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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
    badgeText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold, letterSpacing: 1.5 },
    title: {
      fontFamily: FontFamily.display,
      fontSize: 28,
      color: theme.text,
      textAlign: 'center',
      lineHeight: 34,
      letterSpacing: 0.5,
    },
    titleGold: { color: theme.gold },
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
    statValue: { fontFamily: FontFamily.display, color: theme.gold, fontSize: 22 },
    statLabel: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 11, marginTop: 4 },
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
    planBadgeText: { fontFamily: FontFamily.mono, fontSize: 9, color: Paper.ink },
    planLabel: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textMuted, marginTop: 8 },
    planLabelSelected: { color: theme.gold },
    planPrice: { fontFamily: FontFamily.display, fontSize: 19, color: theme.text, marginTop: 8 },
    planPriceSelected: { color: theme.gold },
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
    testimonialName: { fontFamily: FontFamily.mono, color: theme.textSecondary, fontSize: 12 },
    ctaBtn: {
      marginHorizontal: 24,
      height: 56,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaText: { fontFamily: FontFamily.display, fontSize: 14, color: Paper.ink, letterSpacing: 0.5 },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaSub: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 14 },
    comingSoonBadge: {
      alignSelf: 'center',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginBottom: 14,
    },
    comingSoonText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold, letterSpacing: 1 },
    btnDisabled: { opacity: 0.5 },
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
    modalTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, marginBottom: 16, letterSpacing: 0.5 },
    planSummary: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    planSummaryLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.textMuted },
    planSummaryValue: { fontFamily: FontFamily.monoMedium, fontSize: 15, color: theme.gold },
    field: { marginBottom: 14 },
    fieldLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    cardInput: {
      height: 48,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      color: theme.text,
      fontFamily: FontFamily.mono,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardRow: { flexDirection: 'row', gap: 12 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalCancelBtn: {
      flex: 1,
      height: 50,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: { fontFamily: FontFamily.mono, fontSize: 13, color: theme.textMuted },
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
    successTitle: { fontFamily: FontFamily.display, fontSize: 22, color: theme.gold, marginBottom: 8, letterSpacing: 0.5 },
    successSub: {
      fontFamily: FontFamily.body,
      fontSize: 13,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
  });
