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
import { activityFiltersData } from '../api/mockData';
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

type OpportunityView = {
  id: number | string;
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  location: string;
  age: string;
  deadline: string;
};

export default function ActivitiesScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [applied, setApplied] = useState<Record<string | number, boolean>>({});
  const [opportunities, setOpportunities] = useState<OpportunityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadOpportunities();
  };

  const loadOpportunities = async () => {
    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (__DEV__) console.log('Fırsatlar yüklenemedi:', error);
        // A missing PostgREST error code means the request never reached the
        // server (real network failure).
        if (!error.code) {
          setToast({ message: 'Fırsatlar yüklenemedi', type: 'error' });
        }
        setOpportunities([]);
      } else if (data && data.length > 0) {
        setOpportunities(
          data.map((o: any) => ({
            id: o.id,
            icon: '⚽',
            title: o.title,
            subtitle: o.subtitle,
            badge: o.badge,
            badgeColor: o.badge_color,
            location: o.location,
            age: o.age_range,
            deadline: o.deadline,
          }))
        );
      } else {
        setOpportunities([]);
      }
    } catch (err) {
      if (__DEV__) console.log('Fırsatlar yüklenirken beklenmeyen hata:', err);
      setOpportunities([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleApply = async (opportunityId: number | string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const { error } = await supabase.from('match_applications').insert({
          user_id: user.id,
          opportunity_id: opportunityId,
          status: 'applied',
        });
        if (error) {
          if (__DEV__) console.log('Başvuru kaydedilemedi:', error);
        }
      } else {
        if (__DEV__) console.log('Başvuru kaydedilemedi: oturum açmış kullanıcı bulunamadı');
      }
    } catch (err) {
      if (__DEV__) console.log('Başvuru gönderilirken beklenmeyen hata:', err);
    }

    setApplied((prev) => ({ ...prev, [opportunityId]: true }));
    setToast({ message: 'Başvurunuz alındı', type: 'success' });
    sendLocalNotification('Başvuru Alındı! 🎯', 'Başvurunuz iletildi. Kulüpten yanıt bekleyin.');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Fırsatlar</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          <SkeletonCard height={200} />
          <SkeletonCard height={200} />
          <SkeletonCard height={200} />
        </View>
      </SafeAreaView>
    );
  }

  const matchesFilter = (op: OpportunityView, filter: string) => {
    if (filter === 'Tümü') return true;
    if (filter === 'Türkiye') return op.location.includes('TR');
    if (filter === 'Avrupa') return !op.location.includes('TR');
    return op.badge === filter;
  };

  const filteredOpportunities = opportunities.filter((op) => matchesFilter(op, activeFilter));

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
          <Text style={styles.title}>Fırsatlar</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {activityFiltersData.map((f) => {
            const count = opportunities.filter((op) => matchesFilter(op, f)).length;
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

        {filteredOpportunities.length === 0 ? (
          opportunities.length === 0 ? (
            <EmptyState
              icon="⚡"
              title="Henüz fırsat yok"
              subtitle="Yeni fırsatlar yakında eklenecek"
            />
          ) : (
            <EmptyState
              icon="🔍"
              title="Bu filtrede fırsat yok"
              subtitle="Farklı bir filtre deneyin"
            />
          )
        ) : (
          <View style={styles.list}>
            {filteredOpportunities.map((op) => (
              <View key={op.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconWrap, { backgroundColor: op.badgeColor + '1A' }]}>
                    <Text style={styles.icon}>{op.icon}</Text>
                  </View>
                  <View style={styles.cardTopText}>
                    <Text style={styles.cardTitle}>{op.title}</Text>
                    <Text style={styles.cardSubtitle}>{op.subtitle}</Text>
                  </View>
                </View>

                <View style={[styles.badge, { backgroundColor: op.badgeColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: op.badgeColor }]}>{op.badge}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>📍 {op.location}</Text>
                  <Text style={styles.metaText}>🎯 {op.age}</Text>
                  <Text style={styles.metaText}>⏳ {op.deadline}</Text>
                </View>

                <HapticTouchable
                  style={[styles.applyBtn, applied[op.id] && styles.applyBtnDone]}
                  onPress={() => handleApply(op.id)}
                  disabled={!!applied[op.id]}
                >
                  <Text style={[styles.applyBtnText, applied[op.id] && styles.applyBtnTextDone]}>
                    {applied[op.id] ? '✓ Başvuruldu' : 'Başvur'}
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
    header: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
    },
    title: { fontSize: 22, fontWeight: '800', color: theme.text },
    filters: {
      paddingHorizontal: 24,
      gap: 10,
      marginBottom: 24,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillActive: {
      backgroundColor: theme.gold,
      borderColor: theme.gold,
    },
    pillText: { fontSize: 13, fontWeight: '600', color: theme.textMuted },
    pillTextActive: { color: '#000' },
    pillBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: hexToRgba(theme.gold, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    pillBadgeActive: { backgroundColor: 'rgba(0,0,0,0.2)' },
    pillBadgeText: { fontSize: 10, fontWeight: '800', color: theme.gold },
    pillBadgeTextActive: { color: '#000' },
    list: { paddingHorizontal: 24, gap: 16 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: { fontSize: 22 },
    cardTopText: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 4 },
    cardSubtitle: { fontSize: 12, color: theme.textSecondary, lineHeight: 17 },
    badge: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
      marginBottom: 16,
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16 },
    metaText: { fontSize: 12, color: theme.textSecondary },
    applyBtn: {
      backgroundColor: theme.gold,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    applyBtnDone: {
      backgroundColor: hexToRgba(theme.success, 0.12),
      borderWidth: 1,
      borderColor: theme.success,
    },
    applyBtnText: { fontSize: 14, fontWeight: '700', color: '#000' },
    applyBtnTextDone: { color: theme.success },
  });
