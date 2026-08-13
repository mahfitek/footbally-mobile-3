import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { sendLocalNotification } from '../lib/notifications';
import { notifyUser } from '../lib/notify';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

type MatchView = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  city: string;
  required_players: number;
  type: string;
  category: string;
  creator_id: string;
  participantsCount: number;
  applied: boolean;
  myApplicationId: string | null;
  myResult: 'win' | 'loss' | 'draw' | null;
  myGoals: number;
};

type Participant = { user_id: string; full_name: string; avatar_url: string | null };

type TabKey = 'upcoming' | 'past' | 'applied' | 'mine';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'Yaklaşan' },
  { key: 'past', label: 'Geçmiş' },
  { key: 'applied', label: 'Başvurulan' },
  { key: 'mine', label: 'Benim Maçlarım' },
];

const RESULT_OPTIONS: { key: 'win' | 'loss' | 'draw'; label: string; color: 'success' | 'error' | 'textSecondary' }[] = [
  { key: 'win', label: 'Galibiyet', color: 'success' },
  { key: 'draw', label: 'Beraberlik', color: 'textSecondary' },
  { key: 'loss', label: 'Mağlubiyet', color: 'error' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Props {
  navigate: (screen: string) => void;
}

export default function MatchScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [myCity, setMyCity] = useState('');
  const [matches, setMatches] = useState<MatchView[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [selected, setSelected] = useState<MatchView | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [resultTarget, setResultTarget] = useState<MatchView | null>(null);
  const [resultChoice, setResultChoice] = useState<'win' | 'loss' | 'draw'>('win');
  const [goalsChoice, setGoalsChoice] = useState(0);
  const [savingResult, setSavingResult] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setUserId(user?.id ?? null);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, city')
          .eq('user_id', user.id)
          .maybeSingle();
        setMyName(profile?.full_name ?? '');
        setMyCity(profile?.city ?? '');
      }

      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        if (__DEV__) console.log('Maçlar yüklenemedi:', error);
        if (!error.code) setToast({ message: 'Maçlar yüklenemedi', type: 'error' });
        setMatches([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const rows = data ?? [];
      const ids = rows.map((m: any) => m.id);
      let appRows: any[] = [];
      if (ids.length > 0) {
        const { data: apps } = await supabase
          .from('match_applications')
          .select('id, match_id, user_id, result, goals')
          .in('match_id', ids);
        appRows = apps ?? [];
      }

      setMatches(
        rows.map((m: any) => {
          const myApp = user ? appRows.find((a) => a.match_id === m.id && a.user_id === user.id) : null;
          return {
            id: m.id,
            title: m.title,
            date: m.date,
            time: m.time,
            location: m.location,
            city: m.city,
            required_players: m.required_players ?? 0,
            type: m.type,
            category: m.category ?? 'Eğlence',
            creator_id: m.creator_id,
            participantsCount: appRows.filter((a) => a.match_id === m.id).length,
            applied: !!myApp,
            myApplicationId: myApp?.id ?? null,
            myResult: myApp?.result ?? null,
            myGoals: myApp?.goals ?? 0,
          };
        })
      );
    } catch (err) {
      if (__DEV__) console.log('Maçlar yüklenirken beklenmeyen hata:', err);
      setMatches([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMatches();
  };

  const loadParticipants = async (matchId: string) => {
    setLoadingParticipants(true);
    const { data: apps } = await supabase
      .from('match_applications')
      .select('user_id')
      .eq('match_id', matchId);
    const userIds = (apps ?? []).map((a: any) => a.user_id).filter(Boolean);
    if (userIds.length === 0) {
      setParticipants([]);
      setLoadingParticipants(false);
      return;
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .in('user_id', userIds);
    setParticipants((profiles ?? []) as Participant[]);
    setLoadingParticipants(false);
  };

  const openMatch = (match: MatchView) => {
    setSelected(match);
    loadParticipants(match.id);
  };

  const handleJoin = async (match: MatchView) => {
    if (!userId || match.applied || match.creator_id === userId) return;
    setJoining(true);
    try {
      const { data: inserted, error } = await supabase
        .from('match_applications')
        .insert({ match_id: match.id, user_id: userId, status: 'applied' })
        .select()
        .single();

      if (error) {
        if (__DEV__) console.log('Maça katılım kaydedilemedi:', error);
        setToast({ message: 'Katılım kaydedilemedi', type: 'error' });
      } else {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === match.id
              ? { ...m, applied: true, participantsCount: m.participantsCount + 1, myApplicationId: inserted?.id ?? null }
              : m
          )
        );
        setSelected((prev) =>
          prev && prev.id === match.id
            ? { ...prev, applied: true, participantsCount: prev.participantsCount + 1, myApplicationId: inserted?.id ?? null }
            : prev
        );
        setToast({ message: 'Maça başvurunuz alındı', type: 'success' });
        sendLocalNotification('Maça Katıldın! ⚽', `${match.title} maçına başvurun alındı.`);
        notifyUser(userId, '✅', `${match.title} maçına katılımın onaylandı.`, 'match');
        if (match.creator_id && match.creator_id !== userId) {
          notifyUser(
            match.creator_id,
            '👤',
            `${myName || 'Bir oyuncu'} "${match.title}" maçına katıldı.`,
            'match',
            'Yeni Katılımcı'
          );
        }
      }
    } catch (err) {
      if (__DEV__) console.log('Maça katılırken beklenmeyen hata:', err);
      setToast({ message: 'Katılım kaydedilemedi', type: 'error' });
    }
    setJoining(false);
  };

  const handleLeave = async (match: MatchView) => {
    if (!match.myApplicationId) return;
    setJoining(true);
    try {
      const { error } = await supabase.from('match_applications').delete().eq('id', match.myApplicationId);
      if (error) {
        if (__DEV__) console.log('Maçtan ayrılınamadı:', error);
        setToast({ message: 'Maçtan ayrılınamadı', type: 'error' });
      } else {
        setMatches((prev) =>
          prev.map((m) =>
            m.id === match.id
              ? { ...m, applied: false, participantsCount: Math.max(0, m.participantsCount - 1), myApplicationId: null }
              : m
          )
        );
        setSelected((prev) =>
          prev && prev.id === match.id
            ? { ...prev, applied: false, participantsCount: Math.max(0, prev.participantsCount - 1), myApplicationId: null }
            : prev
        );
        setToast({ message: 'Maçtan ayrıldın', type: 'success' });
      }
    } catch (err) {
      if (__DEV__) console.log('Maçtan ayrılırken beklenmeyen hata:', err);
      setToast({ message: 'Maçtan ayrılınamadı', type: 'error' });
    }
    setJoining(false);
  };

  const handleShare = async (match: MatchView) => {
    try {
      await Share.share({
        message: `${match.title} maçına göz at! ⚽\n📅 ${match.date} · ${match.time}\n📍 ${match.location}, ${match.city}\n\nFootbally'de katıl.`,
        title: match.title,
      });
    } catch {
      // user dismissed the share sheet; nothing to do
    }
  };

  const openInMaps = (match: MatchView) => {
    const query = encodeURIComponent(`${match.location}, ${match.city}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const openResultEntry = (match: MatchView) => {
    setResultTarget(match);
    setResultChoice(match.myResult ?? 'win');
    setGoalsChoice(match.myGoals ?? 0);
  };

  const saveResult = async () => {
    if (!resultTarget?.myApplicationId) return;
    setSavingResult(true);
    const { error } = await supabase
      .from('match_applications')
      .update({ result: resultChoice, goals: goalsChoice })
      .eq('id', resultTarget.myApplicationId);
    if (error) {
      if (__DEV__) console.log('Maç sonucu kaydedilemedi:', error);
      setToast({ message: 'Sonuç kaydedilemedi', type: 'error' });
    } else {
      setMatches((prev) =>
        prev.map((m) => (m.id === resultTarget.id ? { ...m, myResult: resultChoice, myGoals: goalsChoice } : m))
      );
      setToast({ message: 'Maç sonucu kaydedildi', type: 'success' });
      setResultTarget(null);
    }
    setSavingResult(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.backBtn} />
            <Text style={styles.title}>Maçlar</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          <SkeletonCard height={130} />
          <SkeletonCard height={130} />
          <SkeletonCard height={130} />
        </View>
      </SafeAreaView>
    );
  }

  const today = todayStr();
  let filtered = matches.filter((m) => {
    if (activeTab === 'applied') return m.applied;
    if (activeTab === 'mine') return m.applied || m.creator_id === userId;
    if (activeTab === 'upcoming') return m.date >= today;
    return m.date < today;
  });
  if (nearbyOnly && myCity) {
    filtered = filtered.filter((m) => m.city.toLocaleLowerCase('tr-TR').includes(myCity.toLocaleLowerCase('tr-TR')));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('home')}>
            <Text style={styles.backIcon}>←</Text>
          </HapticTouchable>
          <Text style={styles.title}>Maçlar</Text>
        </View>
        <HapticTouchable style={styles.createBtn} onPress={() => navigate('createMatch')}>
          <Text style={styles.createBtnText}>+ Maç Oluştur</Text>
        </HapticTouchable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <HapticTouchable
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </HapticTouchable>
          ))}
        </View>
      </ScrollView>

      {myCity ? (
        <HapticTouchable
          style={[styles.nearbyChip, nearbyOnly && styles.nearbyChipActive]}
          onPress={() => setNearbyOnly((prev) => !prev)}
        >
          <Text style={[styles.nearbyChipText, nearbyOnly && styles.nearbyChipTextActive]}>
            📍 Yakınımda ({myCity})
          </Text>
        </HapticTouchable>
      ) : null}

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
        {filtered.length === 0 ? (
          activeTab === 'upcoming' ? (
            <EmptyState
              icon="⚽"
              title="Henüz maç yok"
              subtitle="İlk maçı sen oluştur!"
              actionLabel="Maç Oluştur"
              onAction={() => navigate('createMatch')}
            />
          ) : activeTab === 'past' ? (
            <EmptyState
              icon="⚽"
              title="Geçmiş maç yok"
              subtitle="Oynadığın maçlar burada listelenecek"
            />
          ) : activeTab === 'mine' ? (
            <EmptyState
              icon="⚽"
              title="Henüz maçın yok"
              subtitle="Bir maç oluştur ya da birine katıl"
              actionLabel="Maç Oluştur"
              onAction={() => navigate('createMatch')}
            />
          ) : (
            <EmptyState
              icon="⚽"
              title="Henüz bir maça başvurmadın"
              subtitle="Yaklaşan maçlara göz atarak başvurabilirsin"
            />
          )
        ) : (
          <View style={styles.list}>
            {filtered.map((m) => {
              const isUpcoming = m.date >= today;
              const statusColor = m.applied ? theme.success : isUpcoming ? theme.gold : theme.textSecondary;
              const statusLabel = m.applied ? 'Başvurulan' : isUpcoming ? 'Yaklaşan' : 'Geçmiş';
              const needsResult = m.applied && !isUpcoming && !m.myResult;
              return (
                <HapticTouchable key={m.id} style={styles.card} onPress={() => openMatch(m)}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardLeft}>
                      <View style={styles.badgeIcon}>
                        <Text style={styles.badgeIconText}>⚽</Text>
                      </View>
                      <View style={styles.cardTopText}>
                        <Text style={styles.cardTitle}>{m.title}</Text>
                        <Text style={styles.cardMeta}>
                          {m.date} · {m.time} · {m.location}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[styles.statusBadge, { backgroundColor: hexToRgba(statusColor, 0.15) }]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.typeTag}>{m.type}</Text>
                    <Text style={styles.typeTag}>{m.category}</Text>
                    <Text style={styles.participants}>
                      👥 {m.participantsCount}/{m.required_players}
                    </Text>
                  </View>
                  {needsResult && (
                    <HapticTouchable style={styles.resultPromptBtn} onPress={() => openResultEntry(m)}>
                      <Text style={styles.resultPromptText}>📝 Maç Sonucunu Gir</Text>
                    </HapticTouchable>
                  )}
                </HapticTouchable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView style={styles.modalCard} contentContainerStyle={{ paddingBottom: 12 }}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>{selected.title}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tarih</Text>
                  <Text style={styles.detailValue}>{selected.date} · {selected.time}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Konum</Text>
                  <Text style={styles.detailValue}>{selected.location}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Şehir</Text>
                  <Text style={styles.detailValue}>{selected.city}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Format</Text>
                  <Text style={styles.detailValue}>{selected.type}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Maç Tipi</Text>
                  <Text style={styles.detailValue}>{selected.category}</Text>
                </View>
                <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.detailLabel}>Katılımcı</Text>
                  <Text style={styles.detailValue}>
                    {selected.participantsCount}/{selected.required_players}
                  </Text>
                </View>

                <HapticTouchable style={styles.mapBtn} onPress={() => openInMaps(selected)}>
                  <Text style={styles.mapBtnText}>🗺️ Haritada Aç</Text>
                </HapticTouchable>

                <Text style={styles.participantsHeader}>Katılımcılar</Text>
                {loadingParticipants ? (
                  <ActivityIndicator color={theme.gold} style={{ marginVertical: 12 }} />
                ) : participants.length === 0 ? (
                  <Text style={styles.noParticipantsText}>Henüz katılımcı yok</Text>
                ) : (
                  <View style={styles.participantsList}>
                    {participants.map((p) => (
                      <View key={p.user_id} style={styles.participantRow}>
                        <View style={styles.participantAvatar}>
                          {p.avatar_url ? (
                            <Image source={{ uri: p.avatar_url }} style={styles.participantAvatarImg} />
                          ) : (
                            <Text style={{ fontSize: 16 }}>👤</Text>
                          )}
                        </View>
                        <Text style={styles.participantName}>{p.full_name || 'Oyuncu'}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {selected.creator_id === userId ? (
                  <View style={styles.ownerNotice}>
                    <Text style={styles.ownerNoticeText}>Bu maçı sen oluşturdun</Text>
                  </View>
                ) : selected.applied ? (
                  <HapticTouchable
                    style={[styles.joinBtn, styles.leaveBtn]}
                    onPress={() => handleLeave(selected)}
                    disabled={joining}
                  >
                    {joining ? <ActivityIndicator color={theme.error} /> : (
                      <Text style={styles.leaveBtnText}>Ayrıl</Text>
                    )}
                  </HapticTouchable>
                ) : (
                  <HapticTouchable
                    style={[
                      styles.joinBtn,
                      selected.participantsCount >= selected.required_players && styles.joinBtnDisabled,
                    ]}
                    onPress={() => handleJoin(selected)}
                    disabled={joining || selected.participantsCount >= selected.required_players}
                  >
                    {joining ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.joinBtnText}>
                        {selected.participantsCount >= selected.required_players ? 'Maç Doldu' : 'Katıl'}
                      </Text>
                    )}
                  </HapticTouchable>
                )}

                <HapticTouchable style={styles.shareBtn} onPress={() => handleShare(selected)}>
                  <Text style={styles.shareBtnText}>↗ Maçı Paylaş</Text>
                </HapticTouchable>

                <HapticTouchable style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Text style={styles.closeBtnText}>Kapat</Text>
                </HapticTouchable>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={!!resultTarget}
        animationType="slide"
        transparent
        onRequestClose={() => setResultTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{resultTarget?.title} · Sonuç</Text>

            <Text style={styles.detailLabel}>SONUÇ</Text>
            <View style={styles.resultOptionsRow}>
              {RESULT_OPTIONS.map((opt) => (
                <HapticTouchable
                  key={opt.key}
                  style={[
                    styles.resultOptionBtn,
                    resultChoice === opt.key && { backgroundColor: theme[opt.color], borderColor: theme[opt.color] },
                  ]}
                  onPress={() => setResultChoice(opt.key)}
                >
                  <Text
                    style={[
                      styles.resultOptionText,
                      resultChoice === opt.key && { color: opt.key === 'draw' ? theme.text : '#000' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </HapticTouchable>
              ))}
            </View>

            <Text style={[styles.detailLabel, { marginTop: 16 }]}>ATTIĞIN GOL</Text>
            <View style={styles.goalsStepper}>
              <HapticTouchable style={styles.goalsBtn} onPress={() => setGoalsChoice((g) => Math.max(0, g - 1))}>
                <Text style={styles.goalsBtnText}>−</Text>
              </HapticTouchable>
              <Text style={styles.goalsValue}>{goalsChoice}</Text>
              <HapticTouchable style={styles.goalsBtn} onPress={() => setGoalsChoice((g) => Math.min(20, g + 1))}>
                <Text style={styles.goalsBtnText}>+</Text>
              </HapticTouchable>
            </View>

            <HapticTouchable style={[styles.joinBtn, { marginTop: 20 }]} onPress={saveResult} disabled={savingResult}>
              {savingResult ? <ActivityIndicator color="#000" /> : <Text style={styles.joinBtnText}>Kaydet</Text>}
            </HapticTouchable>
            <HapticTouchable style={styles.closeBtn} onPress={() => setResultTarget(null)}>
              <Text style={styles.closeBtnText}>Vazgeç</Text>
            </HapticTouchable>
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 16,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    backBtn: {
      width: 40,
      height: 40,
      backgroundColor: theme.card,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 20, color: theme.text },
    title: { fontSize: 22, fontWeight: '800', color: theme.text },
    createBtn: {
      backgroundColor: theme.gold,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    createBtnText: { fontSize: 13, fontWeight: '700', color: '#000' },
    tabsScroll: { paddingHorizontal: 24, marginBottom: 12 },
    tabs: {
      flexDirection: 'row',
      backgroundColor: theme.card2,
      borderRadius: 16,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 2,
    },
    tabBtn: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    tabBtnActive: { backgroundColor: theme.gold },
    tabText: { fontSize: 13, fontWeight: '600', color: theme.textSecondary },
    tabTextActive: { color: '#000' },
    nearbyChip: {
      alignSelf: 'flex-start',
      marginHorizontal: 24,
      marginBottom: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    nearbyChipActive: { backgroundColor: theme.gold, borderColor: theme.gold },
    nearbyChipText: { fontSize: 12, fontWeight: '700', color: theme.textSecondary },
    nearbyChipTextActive: { color: '#000' },
    list: { paddingHorizontal: 24, gap: 14 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 14,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    badgeIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeIconText: { fontSize: 20 },
    cardTopText: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
    cardMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 3 },
    statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    typeTag: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.text,
      backgroundColor: theme.card2,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    participants: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },
    resultPromptBtn: {
      marginTop: 12,
      backgroundColor: hexToRgba(theme.gold, 0.12),
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    resultPromptText: { fontSize: 12, fontWeight: '700', color: theme.gold },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      maxHeight: '85%',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 16 },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    detailLabel: { fontSize: 12, color: theme.textSecondary },
    detailValue: { fontSize: 13, color: theme.text, fontWeight: '600' },
    mapBtn: {
      marginTop: 14,
      backgroundColor: theme.card2,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapBtnText: { fontSize: 13, fontWeight: '700', color: theme.text },
    participantsHeader: { fontSize: 13, fontWeight: '700', color: theme.text, marginTop: 18, marginBottom: 10 },
    noParticipantsText: { fontSize: 12, color: theme.textSecondary },
    participantsList: { gap: 8 },
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    participantAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    participantAvatarImg: { width: 32, height: 32, borderRadius: 16 },
    participantName: { fontSize: 13, color: theme.text, fontWeight: '600' },
    ownerNotice: {
      marginTop: 18,
      backgroundColor: hexToRgba(theme.gold, 0.1),
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ownerNoticeText: { fontSize: 13, fontWeight: '700', color: theme.gold },
    joinBtn: {
      marginTop: 18,
      height: 54,
      borderRadius: 18,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    joinBtnDisabled: { opacity: 0.5 },
    joinBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
    leaveBtn: { backgroundColor: hexToRgba(theme.error, 0.12), borderWidth: 1, borderColor: theme.error },
    leaveBtnText: { fontSize: 15, fontWeight: '700', color: theme.error },
    shareBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
    shareBtnText: { fontSize: 13, fontWeight: '700', color: theme.gold },
    closeBtn: { alignItems: 'center', paddingVertical: 10 },
    closeBtnText: { fontSize: 13, color: theme.textSecondary, fontWeight: '600' },
    resultOptionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    resultOptionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: 'center',
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    resultOptionText: { fontSize: 13, fontWeight: '700', color: theme.text },
    goalsStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 8 },
    goalsBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    goalsBtnText: { fontSize: 20, fontWeight: '700', color: theme.gold },
    goalsValue: { fontSize: 22, fontWeight: '800', color: theme.text, width: 40, textAlign: 'center' },
  });
