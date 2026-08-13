import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { notifyUser } from '../lib/notify';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

const filters = ['Tümü', 'Forvet', 'Orta Saha', 'Defans', 'Kaleci'];

type PlayerView = {
  id: string;
  emoji: string;
  name: string;
  position: string;
  age: number | string;
  city: string;
  score: number;
};

type ScoutViewer = {
  id: string;
  name: string;
  role: string;
  avatar: string;
  online: boolean;
};

const SCOUT_VIEWERS: ScoutViewer[] = [
  { id: 'v1', name: 'Mehmet Yılmaz', role: 'Galatasaray Scout', avatar: '🏟️', online: true },
  { id: 'v2', name: 'Hans Mueller', role: 'Bundesliga Scout', avatar: '🌍', online: false },
  { id: 'v3', name: 'Ahmet Demir', role: 'Trabzonspor Akademi', avatar: '⚡', online: true },
];

const MIN_AGE = 14;
const MAX_AGE = 45;

interface Props {
  navigate: (screen: string, params?: any) => void;
}

export default function ScoutScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tümü');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [onlineScoutsOnly, setOnlineScoutsOnly] = useState(false);
  const [ageRange, setAgeRange] = useState<[number, number]>([MIN_AGE, MAX_AGE]);
  const [players, setPlayers] = useState<PlayerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerName, setViewerName] = useState('');

  useEffect(() => {
    loadPlayers();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setViewerId(session.user.id);
      supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => setViewerName(data?.full_name ?? ''));
    });
  }, []);

  const recordProfileView = (player: PlayerView) => {
    if (player.id === viewerId) return;
    supabase.from('profile_views').insert({ viewer_id: viewerId, viewed_user_id: player.id, viewer_name: viewerName || 'Bir scout' });
    notifyUser(player.id, '👁️', `${viewerName || 'Bir scout'} profilini inceledi`, 'profile', 'Profilin İncelendi');
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPlayers();
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, position, age, city, score')
        .order('score', { ascending: false });

      if (error) {
        if (__DEV__) console.log('Oyuncular yüklenemedi:', error);
        setPlayers([]);
      } else {
        setPlayers(
          (data ?? []).map((p: any) => ({
            id: p.user_id,
            emoji: '👤',
            name: p.full_name ?? 'İsimsiz Oyuncu',
            position: p.position ?? '-',
            age: p.age ?? '-',
            city: p.city ?? '-',
            score: p.score ?? 0,
          }))
        );
      }
    } catch (err) {
      if (__DEV__) console.log('Oyuncular yüklenirken beklenmeyen hata:', err);
      setPlayers([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.backBtn} />
          <Text style={styles.title}>Scout Paneli</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
          <SkeletonCard height={84} />
        </View>
      </SafeAreaView>
    );
  }

  const query = search.trim().toLowerCase();
  const filteredPlayers = players.filter((p) => {
    if (activeFilter !== 'Tümü' && p.position !== activeFilter) return false;
    if (typeof p.age === 'number' && (p.age < ageRange[0] || p.age > ageRange[1])) return false;
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.position.toLowerCase().includes(query) ||
      p.city.toLowerCase().includes(query)
    );
  });

  const visibleScoutViewers = SCOUT_VIEWERS.filter((s) => !onlineScoutsOnly || s.online);

  const handleNearbyMatchesPress = () => {
    setNearbyOnly((prev) => !prev);
    setToast({ message: 'Konum tabanlı maç eşleştirmesi yakında aktif olacak', type: 'success' });
  };

  const adjustAge = (index: 0 | 1, delta: number) => {
    setAgeRange((prev) => {
      const next: [number, number] = [...prev];
      const updated = Math.min(MAX_AGE, Math.max(MIN_AGE, prev[index] + delta));
      next[index] = updated;
      if (next[0] > next[1]) {
        if (index === 0) next[1] = next[0];
        else next[0] = next[1];
      }
      return next;
    });
  };

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
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('home')}>
            <Text style={styles.backIcon}>←</Text>
          </HapticTouchable>
          <Text style={styles.title}>Scout Paneli</Text>
        </View>

        {/* Beni İnceleyen Scoutlar */}
        <View style={styles.viewersHeader}>
          <Text style={styles.viewersHeaderText}>
            👁️ {SCOUT_VIEWERS.length} scout bu hafta profilini inceledi
          </Text>
          <HapticTouchable onPress={() => setOnlineScoutsOnly((prev) => !prev)}>
            <View style={[styles.onlineToggle, onlineScoutsOnly && styles.onlineToggleActive]}>
              <Text style={[styles.onlineToggleText, onlineScoutsOnly && styles.onlineToggleTextActive]}>
                Online Scoutlar
              </Text>
            </View>
          </HapticTouchable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.viewersRow}
        >
          {visibleScoutViewers.map((s) => (
            <View key={s.id} style={styles.viewerCard}>
              <View style={styles.viewerAvatarWrap}>
                <View style={styles.viewerAvatar}>
                  <Text style={{ fontSize: 20 }}>{s.avatar}</Text>
                </View>
                {s.online && <View style={styles.viewerOnlineDot} />}
              </View>
              <Text style={styles.viewerName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.viewerRole} numberOfLines={1}>{s.role}</Text>
              <HapticTouchable
                style={styles.viewerMsgBtn}
                onPress={() => navigate('chat', { id: s.id, name: s.name })}
              >
                <Text style={styles.viewerMsgBtnText}>Mesaj Gönder</Text>
              </HapticTouchable>
            </View>
          ))}
        </ScrollView>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Oyuncu ara: İsim, pozisyon, şehir..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <HapticTouchable
            style={[styles.pill, nearbyOnly && styles.pillActive]}
            onPress={handleNearbyMatchesPress}
          >
            <Text style={[styles.pillText, nearbyOnly && styles.pillTextActive]}>
              📍 Yakınımdaki Maçlar
            </Text>
          </HapticTouchable>
          {filters.map((f) => (
            <HapticTouchable
              key={f}
              style={[styles.pill, activeFilter === f && styles.pillActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.pillText, activeFilter === f && styles.pillTextActive]}>
                {f}
              </Text>
            </HapticTouchable>
          ))}
        </ScrollView>

        <View style={styles.ageRangeCard}>
          <Text style={styles.ageRangeLabel}>YAŞ ARALIĞI</Text>
          <View style={styles.ageRangeRow}>
            <View style={styles.ageStepper}>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(0, -1)}>
                <Text style={styles.ageStepBtnText}>−</Text>
              </HapticTouchable>
              <Text style={styles.ageStepValue}>{ageRange[0]}</Text>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(0, 1)}>
                <Text style={styles.ageStepBtnText}>+</Text>
              </HapticTouchable>
            </View>
            <Text style={styles.ageRangeDash}>—</Text>
            <View style={styles.ageStepper}>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(1, -1)}>
                <Text style={styles.ageStepBtnText}>−</Text>
              </HapticTouchable>
              <Text style={styles.ageStepValue}>{ageRange[1]}</Text>
              <HapticTouchable style={styles.ageStepBtn} onPress={() => adjustAge(1, 1)}>
                <Text style={styles.ageStepBtnText}>+</Text>
              </HapticTouchable>
            </View>
          </View>
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiIcon}>🤖</Text>
            <Text style={styles.aiLabel}>AI ÖNERİSİ</Text>
          </View>
          <Text style={styles.aiText}>Henüz yeterli veri yok</Text>
        </View>

        {filteredPlayers.length === 0 ? (
          <EmptyState icon="🔍" title="Oyuncu bulunamadı" subtitle="Farklı filtreler deneyin" />
        ) : (
          <View style={styles.list}>
            {filteredPlayers.map((p) => (
              <HapticTouchable key={p.id} style={styles.playerCard} onPress={() => recordProfileView(p)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarEmoji}>{p.emoji}</Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{p.name}</Text>
                  <Text style={styles.playerMeta}>
                    {p.position} · {p.age} yaş · {p.city}
                  </Text>
                  <HapticTouchable
                    style={styles.contactBtn}
                    onPress={() => navigate('chat', { id: p.id, name: p.name })}
                  >
                    <Text style={styles.contactBtnText}>İletişim Kur</Text>
                  </HapticTouchable>
                </View>
                <Text style={styles.playerScore}>{p.score}</Text>
              </HapticTouchable>
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
    title: { fontFamily: FontFamily.display, fontSize: 22, color: theme.text, letterSpacing: 0.5 },
    viewersHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      marginBottom: 12,
    },
    viewersHeaderText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text, flex: 1 },
    onlineToggle: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    onlineToggleActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    onlineToggleText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: theme.textSecondary },
    onlineToggleTextActive: { color: '#000' },
    viewersRow: { paddingHorizontal: 24, gap: 12, marginBottom: 24 },
    viewerCard: {
      width: 140,
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    viewerAvatarWrap: { position: 'relative', marginBottom: 8 },
    viewerAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    viewerOnlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 11,
      height: 11,
      borderRadius: 6,
      backgroundColor: theme.success,
      borderWidth: 2,
      borderColor: theme.card,
    },
    viewerName: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.text, textAlign: 'center' },
    viewerRole: { fontFamily: FontFamily.body, fontSize: 10, color: theme.textSecondary, textAlign: 'center', marginTop: 2, marginBottom: 10 },
    viewerMsgBtn: {
      backgroundColor: hexToRgba(theme.gold, 0.12),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    viewerMsgBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 10, color: theme.gold },
    ageRangeCard: {
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ageRangeLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary, letterSpacing: 1, marginBottom: 12 },
    ageRangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    ageRangeDash: { color: theme.textSecondary, fontSize: 14 },
    ageStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    ageStepBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    ageStepBtnText: { fontSize: 16, fontWeight: '700', color: theme.gold },
    ageStepValue: { fontFamily: FontFamily.monoMedium, fontSize: 15, color: theme.text, width: 28, textAlign: 'center' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 24,
      backgroundColor: theme.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 18,
    },
    searchIcon: { fontSize: 15, marginRight: 10 },
    searchInput: { flex: 1, fontFamily: FontFamily.body, fontSize: 14, color: theme.text },
    filters: { paddingHorizontal: 24, gap: 10, marginBottom: 20 },
    pill: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 20,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    pillText: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.textMuted },
    pillTextActive: { color: '#000' },
    aiCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1.5,
      borderColor: theme.gold,
    },
    aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    aiIcon: { fontSize: 16 },
    aiLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.gold, letterSpacing: 1.5 },
    aiText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text, lineHeight: 22 },
    list: { paddingHorizontal: 24, gap: 14 },
    playerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatarEmoji: { fontSize: 24 },
    playerInfo: { flex: 1 },
    playerName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, marginBottom: 2 },
    playerMeta: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textSecondary, marginBottom: 10 },
    contactBtn: {
      alignSelf: 'flex-start',
      backgroundColor: hexToRgba(theme.gold, 0.12),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    contactBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.gold },
    playerScore: { fontFamily: FontFamily.monoMedium, fontSize: 22, color: theme.gold },
  });
