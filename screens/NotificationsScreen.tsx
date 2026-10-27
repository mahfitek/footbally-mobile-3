import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS, hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { TranslationKey } from '../lib/i18n';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

type IoniconName = keyof typeof Ionicons.glyphMap;

type NotificationItem = {
  id: string;
  msg: string;
  createdAt: string;
  unread: boolean;
};

type NotifCategory = {
  icon: IoniconName;
  colorKey: 'gold' | 'purple' | 'success' | 'error';
  actionLabel?: string;
  actionTarget?: string;
};

type T = (key: TranslationKey) => string;

// Bildirim metnindeki anahtar kelimeye göre ikon/renk/aksiyon çıkarır — şema
// değişikliği gerektirmeden (notifications tablosunda ayrı bir "type" kolonu yok).
// Not: eşleştirme İngilizce arayüzde de her zaman Türkçe bildirim metnine göre
// yapılır (backend henüz İngilizce bildirim üretmiyor); sadece aksiyon
// etiketleri seçilen dile göre gösterilir.
const categorize = (msg: string, t: T): NotifCategory => {
  const m = msg.toLowerCase();
  if (m.includes('scout')) return { icon: 'search-outline', colorKey: 'purple', actionLabel: t('notif_actionScout'), actionTarget: 'scout' };
  if (m.includes('maç') || m.includes('ilan')) return { icon: 'football-outline', colorKey: 'gold', actionLabel: t('notif_actionMatches'), actionTarget: 'activities' };
  if (m.includes('mesaj') || m.includes('sohbet')) return { icon: 'chatbubble-outline', colorKey: 'purple', actionLabel: t('notif_actionMessages'), actionTarget: 'messages' };
  if (m.includes('takım') || m.includes('davet')) return { icon: 'people-outline', colorKey: 'success', actionLabel: t('notif_actionTeam'), actionTarget: 'teamProfile' };
  if (m.includes('premium') || m.includes('yükselt')) return { icon: 'star-outline', colorKey: 'gold', actionLabel: t('notif_actionPremium'), actionTarget: 'premium' };
  if (m.includes('engel') || m.includes('uyarı') || m.includes('yasak')) return { icon: 'alert-circle-outline', colorKey: 'error' };
  return { icon: 'notifications-outline', colorKey: 'gold' };
};

const formatRelativeTime = (iso: string, t: T) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t('time_now');
  if (minutes < 60) return `${minutes} ${t('time_minutesAgoSuffix')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t('time_hoursAgoSuffix')}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return t('time_yesterday');
  return `${days} ${t('time_daysAgoSuffix')}`;
};

interface Props {
  navigate: (screen: string) => void;
}

export default function NotificationsScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) {
        if (__DEV__ && error) console.log('Bildirimler yüklenemedi:', error);
        setNotifications([]);
      } else {
        setNotifications(
          data.map((n: any) => ({
            id: String(n.id),
            msg: n.body ?? n.message ?? n.msg ?? '',
            createdAt: n.created_at,
            unread: !n.read,
          }))
        );
      }
    } catch (err) {
      if (__DEV__) console.log('Bildirimler yüklenirken beklenmeyen hata:', err);
      setNotifications([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error && __DEV__) console.log('Bildirim okundu olarak işaretlenemedi:', error);
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (error && __DEV__) console.log('Bildirim silinemedi:', error);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.backBtn} />
          <Text style={styles.title}>{t('notif_title')}</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <SkeletonCard height={76} />
          <SkeletonCard height={76} />
          <SkeletonCard height={76} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('home')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('notif_title')}</Text>
        {unreadCount > 0 && (
          <View style={styles.headerUnreadBadge}>
            <Text style={styles.headerUnreadText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >
        {notifications.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title={t('notif_empty')}
            subtitle={t('notif_emptySub')}
          />
        ) : (
          <>
            <View style={styles.list}>
              {notifications.map((notif) => {
                const cat = categorize(notif.msg, t);
                const catColor = theme[cat.colorKey];
                return (
                  <Swipeable
                    key={notif.id}
                    overshootLeft={false}
                    overshootRight={false}
                    renderLeftActions={(_progress, dragX) => (
                      <SwipeAction dragX={dragX} side="left" color={theme.success} icon="checkmark-done" label={t('notif_markRead')} />
                    )}
                    renderRightActions={(_progress, dragX) => (
                      <SwipeAction dragX={dragX} side="right" color={theme.error} icon="trash" label={t('notif_delete')} />
                    )}
                    onSwipeableOpen={(direction) => {
                      if (direction === 'left') markAsRead(notif.id);
                      else deleteNotification(notif.id);
                    }}
                  >
                    <View style={[styles.item, notif.unread && styles.itemUnread]}>
                      <HapticTouchable style={styles.itemMain} onPress={() => markAsRead(notif.id)}>
                        <View style={[styles.avatar, { backgroundColor: hexToRgba(catColor, 0.16) }]}>
                          <Ionicons name={cat.icon} size={17} color={catColor} />
                        </View>
                        <View style={styles.text}>
                          <Text style={styles.msg}>{notif.msg}</Text>
                          <Text style={styles.time}>{formatRelativeTime(notif.createdAt, t)}</Text>
                        </View>
                        {notif.unread && <View style={styles.unreadDot} />}
                      </HapticTouchable>
                      {cat.actionLabel && cat.actionTarget && (
                        <HapticTouchable
                          style={[styles.actionPill, { borderColor: catColor }]}
                          onPress={() => navigate(cat.actionTarget!)}
                        >
                          <Text style={[styles.actionPillText, { color: catColor === theme.error ? theme.error : theme.goldDark }]}>{cat.actionLabel}</Text>
                        </HapticTouchable>
                      )}
                    </View>
                  </Swipeable>
                );
              })}
            </View>
            <Text style={styles.swipeHint}>{t('notif_swipeHint')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SwipeAction({
  dragX,
  side,
  color,
  icon,
  label,
}: {
  dragX: Animated.AnimatedInterpolation<number>;
  side: 'left' | 'right';
  color: string;
  icon: IoniconName;
  label: string;
}) {
  const scale = dragX.interpolate({
    inputRange: side === 'left' ? [0, 80] : [-80, 0],
    outputRange: side === 'left' ? [0.5, 1] : [1, 0.5],
    extrapolate: 'clamp',
  });
  return (
    <View style={[swipeActionStyles.wrap, { backgroundColor: color, justifyContent: side === 'left' ? 'flex-start' : 'flex-end' }]}>
      <Animated.View style={[swipeActionStyles.inner, { transform: [{ scale }] }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
        <Text style={swipeActionStyles.text}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const swipeActionStyles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 18, marginBottom: 10, paddingHorizontal: 20 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
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
    title: { fontFamily: FontFamily.display, fontSize: 20, color: theme.text, letterSpacing: 0.5 },
    headerUnreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: RADIUS - 2,
      backgroundColor: theme.goldDark,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    headerUnreadText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: theme.bg },
    list: { paddingHorizontal: 24, gap: 10 },
    swipeHint: {
      textAlign: 'center',
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 14,
    },
    item: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    // Okunmamış satır: ince yeşil çerçeve ve çok hafif zemin tonu.
    itemUnread: { borderColor: theme.gold, backgroundColor: hexToRgba(theme.gold, 0.05) },
    itemMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    actionPill: {
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: PILL_RADIUS,
      borderWidth: 1,
    },
    actionPillText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    msg: { fontFamily: FontFamily.body, fontSize: 14, color: theme.text, lineHeight: 20 },
    time: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, marginTop: 4 },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.gold,
      marginTop: 6,
    },
  });
