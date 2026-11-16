import { useEffect, useState } from 'react';
import ListingBoard from '../components/ListingBoard';
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
import { activityFiltersData } from '../api/mockData';
import { supabase } from '../lib/supabase';
import { OPPORTUNITY_COLUMNS } from '../lib/columns';
import {
  appliedOpportunityIds,
  matchesOpportunityFilter,
  normalizeOpportunities,
  type OpportunityRow,
} from '../lib/opportunities';
import { sendLocalNotification } from '../lib/notifications';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;

export default function ActivitiesScreen({ navigate }: { navigate: (screen: string) => void }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [applied, setApplied] = useState<ReadonlySet<string>>(new Set());
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  // Ayrı durumlar: yükleniyor, okunamadı (hata) ve gerçekten boş. Hata, boş liste gibi gösterilmez.
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);


  const onRefresh = () => {
    setRefreshing(true);
    void loadOpportunities();
  };

  // Fırsatlar yalnızca veritabanından okunur. Okunamayan liste hata durumudur; boş liste sayılmaz.
  const loadOpportunities = async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .select(OPPORTUNITY_COLUMNS)
      .order('created_at', { ascending: false });
    if (error) {
      if (__DEV__) console.log('Fırsatlar yüklenemedi:', error);
      setOpportunities([]);
      setStatus('error');
      setRefreshing(false);
      return;
    }
    const rows = normalizeOpportunities(data ?? []);
    setOpportunities(rows);
    setStatus('ready');
    setRefreshing(false);
    await loadMyApplications(rows);
  };

  // Kendi başvurularım: yalnızca hâlâ var olan fırsatlar "Başvuruldu" olur. Fırsatı silinmiş başvurular atlanır.
  const loadMyApplications = async (rows: OpportunityRow[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setApplied(new Set());
      return;
    }
    const { data, error } = await supabase
      .from('match_applications')
      .select('opportunity_id')
      .eq('user_id', uid)
      .not('opportunity_id', 'is', null);
    if (error) {
      if (__DEV__) console.log('Başvurular okunamadı:', error);
      setApplied(new Set());
      return;
    }
    setApplied(appliedOpportunityIds(data ?? [], rows));
  };

  useEffect(() => {
    void loadOpportunities();
  }, []);

  // Başarı yalnızca kayıt gerçekten yapıldıktan sonra gösterilir.
  const handleApply = async (opportunityId: string) => {
    if (applied.has(opportunityId)) return;
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setToast({ message: t('opportunities_applyFailed'), type: 'error' });
      return;
    }
    const { error } = await supabase.from('match_applications').insert({
      user_id: user.id,
      opportunity_id: opportunityId,
      status: 'applied',
    });
    if (error) {
      if (__DEV__) console.log('Başvuru kaydedilemedi:', error);
      setToast({ message: t('opportunities_applyFailed'), type: 'error' });
      return;
    }
    setApplied((prev) => new Set([...prev, opportunityId]));
    setToast({ message: t('activities_applySuccess'), type: 'success' });
    sendLocalNotification(t('activities_applyNotifTitle'), t('activities_applyNotifBody'));
  };

  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('activities_title')}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          <SkeletonCard height={200} />
          <SkeletonCard height={200} />
          <SkeletonCard height={200} />
        </View>
      </SafeAreaView>
    );
  }

  const filteredOpportunities = opportunities.filter((op) => matchesOpportunityFilter(op, activeFilter));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('activities_title')}</Text>
        </View>

        <ListingBoard navigate={navigate} titleKey="listing_activitiesBoardTitle" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={styles.filters}
        >
          {activityFiltersData.map((f) => {
            const count = opportunities.filter((op) => matchesOpportunityFilter(op, f)).length;
            return (
              <HapticTouchable
                key={f}
                style={[styles.pill, activeFilter === f && styles.pillActive]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[styles.pillText, activeFilter === f && styles.pillTextActive]}>
                  {f}
                </Text>
                {count > 0 && (
                  <View style={[styles.pillBadge, activeFilter === f && styles.pillBadgeActive]}>
                    <Text
                      style={[styles.pillBadgeText, activeFilter === f && styles.pillBadgeTextActive]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </HapticTouchable>
            );
          })}
        </ScrollView>

        {status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t('opportunities_loadFailed')}</Text>
            <HapticTouchable
              style={styles.retryBtn}
              onPress={() => {
                setStatus('loading');
                void loadOpportunities();
              }}
            >
              <Text style={styles.retryText}>{t('opportunities_retry')}</Text>
            </HapticTouchable>
          </View>
        ) : filteredOpportunities.length === 0 ? (
          opportunities.length === 0 ? (
            <EmptyState icon="flash-outline" title={t('opportunities_emptyText')} subtitle="" />
          ) : (
            <EmptyState
              icon="search-outline"
              title={t('activities_emptyFilteredTitle')}
              subtitle={t('activities_emptyFilteredSub')}
            />
          )
        ) : (
          <View style={styles.list}>
            {filteredOpportunities.map((op) => (
              <View key={op.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { borderColor: op.badgeColor }]}>
                    <Ionicons name="flag-outline" size={20} color={op.badgeColor} />
                  </View>
                  <View style={styles.cardTopText}>
                    <Text style={styles.cardTitle}>{op.title}</Text>
                    <Text style={styles.cardSubtitle}>{op.subtitle}</Text>
                  </View>
                </View>

                <View style={[styles.badge, { borderColor: op.badgeColor }]}>
                  <Text style={[styles.badgeText, { color: op.badgeColor }]}>{op.badge}</Text>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                    <Text style={styles.metaText}>{op.location}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
                    <Text style={styles.metaText}>{op.age}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                    <Text style={styles.metaText}>{op.deadline}</Text>
                  </View>
                </View>

                <HapticTouchable
                  style={[styles.applyBtn, applied.has(op.id) && styles.applyBtnDone]}
                  onPress={() => handleApply(op.id)}
                  disabled={applied.has(op.id)}
                >
                  <Text style={[styles.applyBtnText, applied.has(op.id) && styles.applyBtnTextDone]}>
                    {applied.has(op.id) ? t('activities_applied') : t('activities_apply')}
                  </Text>
                </HapticTouchable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    errorBox: { alignItems: 'center', gap: 12, marginTop: 40, paddingHorizontal: 32 },
    errorText: { fontFamily: FontFamily.body, fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: theme.gold },
    retryText: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.gold },
    header: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
    },
    title: { fontSize: 22, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    filters: {
      paddingHorizontal: 24,
      gap: 10,
      marginBottom: 24,
    },
    pill: {
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
    pillActive: {
      backgroundColor: theme.gold,
      borderColor: theme.gold,
    },
    pillText: { fontSize: 12, fontFamily: FontFamily.monoMedium, color: theme.textMuted },
    pillTextActive: { color: Paper.ink },
    pillBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: RADIUS - 3,
      backgroundColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    pillBadgeActive: { backgroundColor: 'rgba(0,0,0,0.2)' },
    pillBadgeText: { fontSize: 10, fontFamily: FontFamily.monoMedium, color: theme.goldDark },
    pillBadgeTextActive: { color: Paper.ink },
    list: { paddingHorizontal: 24, gap: 16 },
    card: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: RADIUS,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTopText: { flex: 1 },
    cardTitle: { fontSize: 15, fontFamily: FontFamily.bodySemiBold, color: theme.text, marginBottom: 4 },
    cardSubtitle: { fontSize: 12, fontFamily: FontFamily.body, color: theme.textSecondary, lineHeight: 17 },
    badge: {
      borderRadius: RADIUS,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      marginBottom: 16,
    },
    badgeText: { fontSize: 11, fontFamily: FontFamily.monoMedium },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, fontFamily: FontFamily.mono, color: theme.textSecondary },
    applyBtn: {
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      paddingVertical: 13,
      alignItems: 'center',
    },
    applyBtnDone: {
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.success,
    },
    applyBtnText: { fontSize: 13, fontFamily: FontFamily.display, letterSpacing: 1, color: Paper.ink },
    applyBtnTextDone: { color: theme.success },
  });
