import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

type NotificationItem = {
  id: string;
  icon: string;
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
            icon: n.icon ?? '🔔',
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
          <Text style={styles.title}>Bildirimler</Text>
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
          <Text style={styles.backIcon}>←</Text>
        </HapticTouchable>
        <Text style={styles.title}>Bildirimler</Text>
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
            icon="🔔"
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
                  <Text style={styles.avatarIcon}>{notif.icon}</Text>
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
      width: 44,
      height: 44,
      backgroundColor: theme.card,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 18, color: theme.text },
    title: { fontSize: 20, fontWeight: '800', color: theme.text },
    headerUnreadBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    headerUnreadText: { fontSize: 11, fontWeight: '800', color: '#000' },
    list: { paddingHorizontal: 24, gap: 12 },
    item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemUnread: { borderColor: hexToRgba(theme.gold, 0.3) },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.2),
    },
    avatarIcon: { fontSize: 20 },
    text: { flex: 1 },
    msg: { fontSize: 13, color: theme.textMuted, lineHeight: 18, fontWeight: '600' },
    time: { fontSize: 11, color: theme.textSecondary, marginTop: 4 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.gold,
      marginTop: 5,
    },
  });
