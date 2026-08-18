import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

type NotificationItem = {
  id: string;
  msg: string;
  time: string;
  unread: boolean;
};

const formatRelativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes} dakika önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dün';
  return `${days} gün önce`;
};

interface Props {
  navigate: (screen: string) => void;
}

export default function NotificationsScreen({ navigate }: Props) {
  const { theme } = useTheme();
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
            msg: n.message ?? n.msg ?? '',
            time: formatRelativeTime(n.created_at),
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.backBtn} />
          <Text style={styles.title}>BİLDİRİMLER</Text>
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
        <Text style={styles.title}>BİLDİRİMLER</Text>
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
            title="Henüz bildirim yok"
            subtitle="Bildirimler burada görünecek"
          />
        ) : (
          <View style={styles.list}>
            {notifications.map((notif) => (
              <HapticTouchable
                key={notif.id}
                style={[styles.item, notif.unread && styles.itemUnread]}
                onPress={() => markAsRead(notif.id)}
              >
                <View style={styles.avatar}>
                  <Ionicons name="notifications-outline" size={17} color={theme.gold} />
                </View>
                <View style={styles.text}>
                  <Text style={styles.msg}>{notif.msg}</Text>
                  <Text style={styles.time}>{notif.time}</Text>
                </View>
                {notif.unread && <View style={styles.unreadDot} />}
              </HapticTouchable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    headerUnreadText: { fontFamily: FontFamily.monoMedium, fontSize: 11, color: Paper.ink },
    list: { paddingHorizontal: 24, gap: 10 },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemUnread: { borderColor: theme.gold },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1 },
    msg: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, lineHeight: 18 },
    time: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginTop: 4 },
    unreadDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.gold,
      marginTop: 6,
    },
  });
