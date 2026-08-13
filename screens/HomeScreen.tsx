import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Animated,
  RefreshControl,
  Easing,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { hexToRgba, Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { gridItemsData } from '../api/mockData';
import { supabase } from '../lib/supabase';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

type MatchItem = {
  id: string;
  icon: string;
  name: string;
  date: string;
  time: string;
  location: string;
  tag: string;
  tagColor: string;
};

type NotificationItem = {
  id: string;
  icon: string;
  msg: string;
  time: string;
  unread: boolean;
};

type Task = {
  id: string;
  title: string;
  desc: string;
  points: number;
  done: boolean;
  screen: string;
  icon: string;
};

const DAILY_TIPS = [
  "💡 Profilini tamamla, scout'ların seni bulma ihtimalini %3 artır",
  '⚽ Bugün bir maça katıl ve performansını kaydet',
  '🎯 AI analizin için bir maç fotoğrafı yükle',
  '🏆 Scout ağında 12 scout aktif, profilini güncel tut',
  '📈 Bu hafta 3 yeni fırsat eklendi, kaçırma!',
];

const PLATFORM_ACTIVITY = [
  { icon: '🏟️', text: 'Galatasaray Akademi 2 yeni oyuncu aradı', time: '5 dk' },
  { icon: '👤', text: "İstanbul'da 8 yeni oyuncu kayıt oldu", time: '1 sa' },
  { icon: '⚽', text: "Kadıköy'de yeni maç oluşturuldu", time: '2 sa' },
  { icon: '🎯', text: 'Bundesliga scout 3 profil inceledi', time: '3 sa' },
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Günaydın';
  if (hour >= 12 && hour < 18) return 'İyi Öğlenler';
  return 'İyi Akşamlar';
};

const getScoreLevel = (score: number, theme: Theme) => {
  if (score >= 100) return { label: '🏆 Mükemmel', color: theme.gold };
  if (score >= 81) return { label: '🔵 Elit', color: theme.goldLight };
  if (score >= 61) return { label: '🟡 İyi Seviye', color: theme.gold };
  if (score >= 31) return { label: '🟠 Gelişiyor', color: '#f59e0b' };
  return { label: '🔴 Başlangıç', color: theme.error };
};

const formatRelativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dün';
  return `${days} gün önce`;
};

interface Props {
  navigate: (screen: string) => void;
  userId?: string | null;
}

export default function HomeScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [score, setScore] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const unreadCount = notifications.filter((n) => n.unread).length;
  const isPremiumActive = isPremium && (!premiumUntil || new Date(premiumUntil) > new Date());
  const dailyTip = DAILY_TIPS[Math.floor(Date.now() / 86400000) % DAILY_TIPS.length];
  const scoreLevel = getScoreLevel(score, theme);
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const scoreCountAnim = useRef(new Animated.Value(0)).current;
  const gridAnims = useRef(gridItemsData.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(scoreAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.stagger(
      50,
      gridAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  useEffect(() => {
    if (loading) return;
    const listenerId = scoreCountAnim.addListener(({ value }) => setDisplayScore(Math.round(value)));
    Animated.timing(scoreCountAnim, {
      toValue: score,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => scoreCountAnim.removeListener(listenerId);
  }, [loading, score]);

  useEffect(() => {
    loadProfile();
    loadUpcomingMatches();
    loadNotifications();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const uid = userId ?? user?.id ?? null;
    if (uid) {
      const premiumUntilValue = user?.user_metadata?.premium_until ?? null;
      const premiumActive = !!user?.user_metadata?.premium && (!premiumUntilValue || new Date(premiumUntilValue) > new Date());
      setIsPremium(!!user?.user_metadata?.premium);
      setPremiumUntil(premiumUntilValue);

      const { data } = await supabase
        .from('profiles')
        .select('full_name, score, position, age, height, weight, city, district, foot, avatar_url')
        .eq('user_id', uid)
        .single();

      if (data) {
        setName(data.full_name ?? '');
        setScore(data.score ?? 0);
        calculateTasks(data, premiumActive);
      }
    }
    setLoading(false);
  };

  const calculateTasks = (p: any, premiumActive: boolean) => {
    setTasks([
      { id: 'name', title: 'İsmini ekle', desc: 'Profilinde adın görünsün', points: 10, done: !!p.full_name, screen: 'profile', icon: '👤' },
      { id: 'position', title: 'Pozisyon seç', desc: 'Oynadığın mevkii belirt', points: 10, done: !!p.position, screen: 'profile', icon: '⚽' },
      { id: 'age', title: 'Yaşını ekle', desc: "Scout'lar yaş bilgine bakıyor", points: 5, done: !!p.age, screen: 'profile', icon: '🎂' },
      { id: 'height', title: 'Boy bilgini gir', desc: 'Fiziksel özelliklerini tamamla', points: 5, done: !!p.height, screen: 'profile', icon: '📏' },
      { id: 'weight', title: 'Kilo bilgini gir', desc: 'Fiziksel özelliklerini tamamla', points: 5, done: !!p.weight, screen: 'profile', icon: '⚖️' },
      { id: 'city', title: 'Şehir ekle', desc: 'Yakınındaki fırsatları gör', points: 5, done: !!p.city, screen: 'profile', icon: '📍' },
      { id: 'district', title: 'İlçe ekle', desc: 'Daha doğru eşleşme için', points: 3, done: !!p.district, screen: 'profile', icon: '🗺️' },
      { id: 'foot', title: 'Baskın ayak seç', desc: 'Sol mu sağ mı?', points: 3, done: !!p.foot, screen: 'profile', icon: '👟' },
      { id: 'match', title: 'İlk maça katıl', desc: 'Performansını kayıt altına al', points: 15, done: false, screen: 'match', icon: '🏟️' },
      { id: 'apply', title: 'Bir fırsata başvur', desc: 'Kariyerinde ilk adımı at', points: 10, done: false, screen: 'activities', icon: '🎯' },
      { id: 'photo', title: 'Profil fotoğrafı ekle', desc: "Scout'lar fotoğraflı profili tercih eder", points: 10, done: !!p.avatar_url, screen: 'profile', icon: '📸' },
      { id: 'premium', title: "Premium'a geç", desc: 'Tüm özelliklerin kilidini aç', points: 19, done: premiumActive, screen: 'premium', icon: '⭐' },
    ]);
  };

  const loadUpcomingMatches = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('matches')
        .select('id, title, date, time, location')
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(2);

      if (error || !data) {
        if (__DEV__ && error) console.log('Maçlar yüklenemedi:', error);
        setMatches([]);
        return;
      }

      setMatches(
        data.map((m: any) => ({
          id: m.id,
          icon: '⚽',
          name: m.title,
          date: m.date,
          time: m.time,
          location: m.location,
          tag: 'Yaklaşan',
          tagColor: theme.gold,
        }))
      );
    } catch (err) {
      if (__DEV__) console.log('Maçlar yüklenirken beklenmeyen hata:', err);
      setMatches([]);
    }
  };

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data) {
        if (__DEV__ && error) console.log('Bildirimler yüklenemedi:', error);
        setNotifications([]);
        return;
      }

      setNotifications(
        data.map((n: any) => ({
          id: String(n.id),
          icon: n.icon ?? '🔔',
          msg: n.message ?? n.msg ?? '',
          time: formatRelativeTime(n.created_at),
          unread: !n.read,
        }))
      );
    } catch (err) {
      if (__DEV__) console.log('Bildirimler yüklenirken beklenmeyen hata:', err);
      setNotifications([]);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadUpcomingMatches(), loadNotifications()]).finally(() => setRefreshing(false));
  };

  const firstName = name.trim() ? name.trim().split(' ')[0] : '';
  const completedPoints = tasks.filter((t) => t.done).reduce((sum, t) => sum + t.points, 0);
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0);
  const pendingTasks = tasks.filter((t) => !t.done).slice(0, 3);
  const taskProgress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 24, gap: 12 }}>
          <SkeletonCard height={100} />
          <SkeletonCard height={80} />
          <SkeletonCard height={80} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >

        <View style={{ backgroundColor: 'transparent' }}>
          <Image
            source={require('../assets/logo-text.png')}
            style={{
              width: 300,
              height: 80,
              resizeMode: 'contain',
              alignSelf: 'center',
              marginTop: 16,
              marginBottom: 4,
              backgroundColor: 'transparent',
            }}
          />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>{getGreeting().toUpperCase()}</Text>
              {isPremiumActive && (
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>✦ Premium</Text>
                </View>
              )}
            </View>
            <Text style={styles.greetingName}>
              {firstName ? (
                <>
                  {t('hello')} <Text style={styles.gold}>{firstName}</Text> 👋
                </>
              ) : (
                <>{t('hello')} 👋</>
              )}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <HapticTouchable style={styles.notifBtn} onPress={() => navigate('search')}>
              <Text style={styles.notifIcon}>🔍</Text>
            </HapticTouchable>
            <HapticTouchable style={styles.notifBtn} onPress={() => navigate('notifications')}>
              <Text style={styles.notifIcon}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.notifDot}>
                  <Text style={styles.notifDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </HapticTouchable>
          </View>
        </View>

        {/* Daily Tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipText}>{dailyTip}</Text>
        </View>

        {/* Score Card */}
        <Animated.View
          style={{
            opacity: scoreAnim,
            transform: [
              {
                translateY: scoreAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [24, 0],
                }),
              },
            ],
          }}
        >
          <HapticTouchable style={styles.scoreCard}>
            <View style={styles.scoreInfo}>
              <Text style={styles.scoreLabel}>GENEL SKOR</Text>
              <Text style={[styles.scoreValue, { color: scoreLevel.color }]}>{displayScore}</Text>
              <View style={[styles.scoreLevelPill, { backgroundColor: hexToRgba(scoreLevel.color, 0.15) }]}>
                <Text style={[styles.scoreLevelText, { color: scoreLevel.color }]}>{scoreLevel.label}</Text>
              </View>
            </View>
            <View style={[styles.scoreRing, { borderColor: scoreLevel.color }]}>
              <Text style={[styles.scoreRingText, { color: scoreLevel.color }]}>{displayScore}%</Text>
            </View>
          </HapticTouchable>
        </Animated.View>

        {/* Score completion tasks */}
        {tasks.length > 0 && (
          <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: theme.text, fontSize: 17, fontFamily: FontFamily.bodySemiBold }}>🎯 Skoru Tamamla</Text>
              <Text style={{ color: theme.gold, fontSize: 13, fontFamily: FontFamily.monoMedium }}>{completedPoints}/{totalPoints} puan</Text>
            </View>

            <View style={{ height: 6, backgroundColor: theme.border, borderRadius: 3, marginBottom: 16 }}>
              <View style={{ height: 6, backgroundColor: theme.gold, borderRadius: 3, width: `${taskProgress}%` }} />
            </View>

            {pendingTasks.length === 0 ? (
              <View
                style={{
                  backgroundColor: hexToRgba(theme.gold, 0.08),
                  borderRadius: 16,
                  padding: 16,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: hexToRgba(theme.gold, 0.2),
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 22, marginBottom: 4 }}>🏆</Text>
                <Text style={{ color: theme.gold, fontFamily: FontFamily.bodySemiBold }}>Tüm görevler tamamlandı!</Text>
              </View>
            ) : (
              pendingTasks.map((task) => (
                <HapticTouchable
                  key={task.id}
                  onPress={() => navigate(task.screen)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: theme.card,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: hexToRgba(theme.gold, 0.1),
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{task.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold, marginBottom: 2 }}>{task.title}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>{task.desc}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: theme.gold, fontSize: 12, fontFamily: FontFamily.monoMedium }}>+{task.points}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 10, fontFamily: FontFamily.body }}>puan</Text>
                  </View>
                </HapticTouchable>
              ))
            )}

            <HapticTouchable
              onPress={() => setShowAllTasks(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: theme.border,
                borderStyle: 'dashed',
              }}
            >
              <Text style={{ color: theme.gold, fontSize: 13, fontFamily: FontFamily.bodySemiBold }}>Tüm Görevleri Gör</Text>
              <Text style={{ color: theme.gold }}>→</Text>
            </HapticTouchable>
          </View>
        )}

        {/* Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('quickAccess')}</Text>
        </View>
        <View style={styles.grid}>
          {gridItemsData.map((item, i) => (
            <Animated.View
              key={i}
              style={{
                width: '47%',
                opacity: gridAnims[i],
                transform: [
                  {
                    translateY: gridAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <HapticTouchable style={styles.gridCard} onPress={() => navigate(item.screen)}>
                <View style={styles.gridIconWrap}>
                  <Text style={styles.gridIcon}>{item.icon}</Text>
                </View>
                <Text style={styles.gridTitle}>{item.title}</Text>
                <Text style={styles.gridSub}>{item.sub} →</Text>
              </HapticTouchable>
            </Animated.View>
          ))}
        </View>

        {/* Activity Feed */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Platform Aktivitesi</Text>
        </View>
        <View style={styles.activityList}>
          {PLATFORM_ACTIVITY.map((a, i) => (
            <View key={i} style={styles.activityItem}>
              <View style={styles.activityIconWrap}>
                <Text style={styles.activityIcon}>{a.icon}</Text>
              </View>
              <Text style={styles.activityText}>{a.text}</Text>
              <Text style={styles.activityTime}>{a.time}</Text>
            </View>
          ))}
        </View>

        {/* Matches */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('upcomingMatches')}</Text>
          <HapticTouchable onPress={() => navigate('match')}>
            <Text style={styles.sectionLink}>Tümü →</Text>
          </HapticTouchable>
        </View>
        {matches.length === 0 && (
          <EmptyState
            icon="⚽"
            title="Henüz maç yok"
            subtitle="Yaklaşan maçlar burada görünecek"
          />
        )}
        {matches.map((match) => (
          <HapticTouchable
            key={match.id}
            style={styles.matchItem}
            onPress={() => navigate('match')}
          >
            <View style={styles.matchLeft}>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeIcon}>{match.icon}</Text>
              </View>
              <View>
                <Text style={styles.matchName}>{match.name}</Text>
                <Text style={styles.matchDate}>
                  {match.date} · {match.time} · {match.location}
                </Text>
              </View>
            </View>
            <View style={[styles.matchTag, { backgroundColor: match.tagColor + '20' }]}>
              <Text style={[styles.matchTagText, { color: match.tagColor }]}>{match.tag}</Text>
            </View>
          </HapticTouchable>
        ))}

        {/* Notifications */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('recentNotifications')}</Text>
          <HapticTouchable onPress={() => navigate('notifications')}>
            <Text style={styles.sectionLink}>Tümü →</Text>
          </HapticTouchable>
        </View>
        {notifications.length === 0 && (
          <EmptyState
            icon="🔔"
            title="Henüz bildirim yok"
            subtitle="Bildirimler burada görünecek"
          />
        )}
        {notifications.map((notif) => (
          <View key={notif.id} style={styles.notifItem}>
            <View style={styles.notifAvatar}>
              <Text style={styles.notifAvatarIcon}>{notif.icon}</Text>
            </View>
            <View style={styles.notifText}>
              <Text style={styles.notifMsg}>{notif.msg}</Text>
              <Text style={styles.notifTime}>{notif.time}</Text>
            </View>
            {notif.unread && <View style={styles.unreadDot} />}
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />
      <Modal visible={showAllTasks} animationType="slide" onRequestClose={() => setShowAllTasks(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
            <HapticTouchable onPress={() => setShowAllTasks(false)}>
              <Text style={{ color: theme.gold, fontSize: 16 }}>← Geri</Text>
            </HapticTouchable>
            <Text style={{ color: theme.text, fontSize: 20, fontFamily: FontFamily.display, letterSpacing: 0.5 }}>Görevler</Text>
            <Text style={{ color: theme.gold, fontFamily: FontFamily.monoMedium }}>{completedPoints}/{totalPoints}</Text>
          </View>

          <View style={{ margin: 16, backgroundColor: theme.card2, borderRadius: 20, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: theme.text, fontFamily: FontFamily.bodySemiBold }}>Genel İlerleme</Text>
              <Text style={{ color: theme.gold, fontFamily: FontFamily.monoMedium }}>{Math.round(taskProgress)}%</Text>
            </View>
            <View style={{ height: 8, backgroundColor: theme.border, borderRadius: 4 }}>
              <View style={{ height: 8, backgroundColor: theme.gold, borderRadius: 4, width: `${taskProgress}%` }} />
            </View>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {tasks.map((task) => (
              <HapticTouchable
                key={task.id}
                onPress={() => {
                  setShowAllTasks(false);
                  if (!task.done) navigate(task.screen);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: theme.card,
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: task.done ? hexToRgba(theme.success, 0.3) : theme.border,
                  opacity: task.done ? 0.8 : 1,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: task.done ? hexToRgba(theme.success, 0.1) : hexToRgba(theme.gold, 0.1),
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{task.done ? '✅' : task.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: task.done ? theme.success : theme.text,
                      fontSize: 14,
                      fontFamily: FontFamily.bodySemiBold,
                      marginBottom: 2,
                      textDecorationLine: task.done ? 'line-through' : 'none',
                    }}
                  >
                    {task.title}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>{task.desc}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: task.done ? theme.success : theme.gold, fontSize: 13, fontFamily: FontFamily.monoMedium }}>
                    {task.done ? '✓' : `+${task.points}`}
                  </Text>
                </View>
              </HapticTouchable>
            ))}

            {tasks.length > 0 && completedPoints === totalPoints && (
              <View
                style={{
                  backgroundColor: hexToRgba(theme.gold, 0.1),
                  borderRadius: 20,
                  padding: 20,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: hexToRgba(theme.gold, 0.3),
                }}
              >
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🏆</Text>
                <Text style={{ color: theme.gold, fontSize: 22, fontFamily: FontFamily.display, marginBottom: 4, letterSpacing: 0.5 }}>Tebrikler!</Text>
                <Text style={{ color: theme.textSecondary, textAlign: 'center', fontFamily: FontFamily.body }}>
                  Tüm görevleri tamamladın. Profilin mükemmel!
                </Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 24,
      paddingTop: 16,
    },
    greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    greeting: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 2 },
    greetingName: { fontFamily: FontFamily.display, fontSize: 30, color: theme.text, marginTop: 2 },
    gold: { color: theme.gold },
    premiumBadge: {
      backgroundColor: hexToRgba(theme.gold, 0.15),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    premiumBadgeText: { fontFamily: FontFamily.mono, fontSize: 9, color: theme.gold, letterSpacing: 0.5 },
    tipCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: hexToRgba(theme.gold, 0.08),
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.2),
    },
    tipText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.textMuted, lineHeight: 19 },
    scoreLevelPill: {
      alignSelf: 'flex-start',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginTop: 6,
    },
    scoreLevelText: { fontFamily: FontFamily.mono, fontSize: 11 },
    notifBtn: {
      width: 44, height: 44,
      backgroundColor: theme.card,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    notifIcon: { fontSize: 18 },
    notifDot: {
      position: 'absolute',
      top: 6, right: 6,
      minWidth: 16, height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifDotText: { fontFamily: FontFamily.monoMedium, fontSize: 9, color: '#fff' },
    scoreCard: {
      margin: 24,
      marginTop: 0,
      backgroundColor: theme.card2,
      borderRadius: 24,
      padding: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: hexToRgba(theme.gold, 0.15),
      shadowColor: theme.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 4,
    },
    scoreInfo: { flex: 1 },
    scoreLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 2 },
    scoreValue: { fontFamily: FontFamily.mono, fontSize: 52, color: theme.gold, lineHeight: 60 },
    scoreSub: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textSecondary, marginTop: 4 },
    scoreUp: { fontFamily: FontFamily.bodySemiBold, color: theme.success },
    scoreRing: {
      width: 80, height: 80,
      borderRadius: 40,
      borderWidth: 6,
      borderColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreRingText: { fontFamily: FontFamily.monoMedium, fontSize: 16, color: theme.gold },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 14,
    },
    sectionTitle: { fontFamily: FontFamily.display, fontSize: 19, color: theme.text, letterSpacing: 0.5 },
    sectionLink: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.gold },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 24,
      gap: 12,
      marginBottom: 28,
    },
    gridCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    gridIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: hexToRgba(theme.gold, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    gridIcon: { fontSize: 20 },
    gridTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text, marginBottom: 4 },
    gridSub: { fontFamily: FontFamily.body, fontSize: 11, color: theme.textSecondary },
    activityList: { paddingHorizontal: 24, marginBottom: 28, gap: 10 },
    activityItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activityIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityIcon: { fontSize: 16 },
    activityText: { fontFamily: FontFamily.bodySemiBold, flex: 1, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
    activityTime: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary },
    matchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      marginHorizontal: 24,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    matchLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    matchBadge: {
      width: 44, height: 44,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    matchBadgeIcon: { fontSize: 22 },
    matchName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
    matchDate: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    matchTag: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    matchTagText: { fontFamily: FontFamily.mono, fontSize: 11 },
    notifItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    notifAvatar: {
      width: 40, height: 40,
      borderRadius: 20,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    notifAvatarIcon: { fontSize: 18 },
    notifText: { flex: 1 },
    notifMsg: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, lineHeight: 18 },
    notifTime: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, marginTop: 3 },
    unreadDot: {
      width: 7, height: 7,
      borderRadius: 4,
      backgroundColor: theme.gold,
      marginTop: 5,
    },
  });
