import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

type ChatView = {
  id: string | number;
  name: string;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
};

type ConnectionView = {
  id: string;
  name: string;
  role: string;
  online: boolean;
  icon: IoniconName;
};

const CONNECTIONS: ConnectionView[] = [
  { id: 'c1', name: 'Mehmet Yılmaz', role: 'Galatasaray Scout', online: true, icon: 'business-outline' },
  { id: 'c2', name: 'Hans Mueller', role: 'Bundesliga Scout', online: false, icon: 'globe-outline' },
  { id: 'c3', name: 'Ahmet Demir', role: 'Trabzonspor Akademi', online: true, icon: 'flash-outline' },
];

const formatRelativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'şimdi';
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Dün';
  return `${days} gün`;
};

interface Props {
  navigate: (screen: string, params?: any) => void;
}

export default function MessagesScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [tab, setTab] = useState<'messages' | 'connections'>('messages');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<ChatView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [newMessageModal, setNewMessageModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<
    { user_id: string; full_name: string; position: string | null; city: string | null }[]
  >([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  useEffect(() => {
    if (!newMessageModal) return;
    const query = userSearch.trim();
    let cancelled = false;
    setSearchingUsers(true);

    const timer = setTimeout(async () => {
      let request = supabase
        .from('profiles')
        .select('user_id, full_name, position, city')
        .limit(10);
      if (query) {
        request = request.ilike('full_name', `%${query}%`);
      }
      const { data, error } = await request;
      if (cancelled) return;
      if (error) {
        if (__DEV__) console.log('Kullanıcılar aranamadı:', error);
        setUserResults([]);
      } else {
        setUserResults(data ?? []);
      }
      setSearchingUsers(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userSearch, newMessageModal]);

  const openNewMessage = () => {
    setUserSearch('');
    setUserResults([]);
    setNewMessageModal(true);
  };

  const handleSelectUser = (u: { user_id: string; full_name: string }) => {
    setNewMessageModal(false);
    navigate('chat', { id: u.user_id, name: u.full_name });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const loadMessages = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      setChats([]);
      setUnreadCount(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!data || data.length === 0) {
      setChats([]);
      setUnreadCount(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const groups = new Map<string, any[]>();
    for (const m of data) {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const list = groups.get(otherId) ?? [];
      list.push(m);
      groups.set(otherId, list);
    }

    const otherIds = Array.from(groups.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', otherIds);
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));

    const conversations: ChatView[] = otherIds.map((otherId) => {
      const msgs = groups.get(otherId)!;
      const last = [...msgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const unread = msgs.filter((m) => !m.read && m.receiver_id === user.id).length;
      return {
        id: otherId,
        name: nameMap.get(otherId) ?? 'Kullanıcı',
        preview: last.content,
        time: formatRelativeTime(last.created_at),
        unread,
        online: false,
      };
    });

    setChats(conversations);
    setUnreadCount(data.filter((m: any) => !m.read && m.receiver_id === user.id).length);
    setLoading(false);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>MESAJLAR</Text>
        </View>
        <View style={{ paddingHorizontal: 24, gap: 12 }}>
          <SkeletonCard height={80} />
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
          <Text style={styles.title}>MESAJLAR</Text>
          {unreadCount > 0 && (
            <View style={styles.headerUnreadBadge}>
              <Text style={styles.headerUnreadText}>{unreadCount}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <HapticTouchable style={[styles.newMessageBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={openNewMessage}>
            <Ionicons name="create-outline" size={13} color={theme.gold} />
            <Text style={styles.newMessageBtnText}>Yeni Mesaj</Text>
          </HapticTouchable>
        </View>

        <View style={styles.tabRow}>
          <HapticTouchable
            style={[styles.tabBtn, tab === 'messages' && styles.tabBtnActive]}
            onPress={() => setTab('messages')}
          >
            <Text style={[styles.tabText, tab === 'messages' && styles.tabTextActive]}>Mesajlar</Text>
          </HapticTouchable>
          <HapticTouchable
            style={[styles.tabBtn, tab === 'connections' && styles.tabBtnActive]}
            onPress={() => setTab('connections')}
          >
            <Text style={[styles.tabText, tab === 'connections' && styles.tabTextActive]}>Bağlantılar</Text>
          </HapticTouchable>
        </View>

        {tab === 'messages' && (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={15} color={theme.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Sohbet ara..."
                placeholderTextColor={theme.textSecondary}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {chats.length === 0 ? (
              <EmptyState
                icon="chatbubble-outline"
                title="Henüz mesaj yok"
                subtitle="Scout veya takımlarla iletişime geç"
                actionLabel="Scout Ara"
                onAction={() => navigate('scout')}
              />
            ) : (
              <View style={styles.chatList}>
                {chats.map((c) => (
                  <HapticTouchable
                    key={c.id}
                    style={styles.chatItem}
                    onPress={() => navigate('chat', { id: String(c.id), name: c.name })}
                  >
                    <View style={styles.chatAvatarWrap}>
                      <View style={styles.chatAvatar}>
                        <Ionicons name="person-outline" size={20} color={theme.gold} />
                      </View>
                      {c.online && <View style={styles.chatOnlineDot} />}
                    </View>
                    <View style={styles.chatText}>
                      <View style={styles.chatTopRow}>
                        <Text style={styles.chatName}>{c.name}</Text>
                        <Text style={styles.chatTime}>{c.time}</Text>
                      </View>
                      <View style={styles.chatBottomRow}>
                        <Text
                          style={[styles.chatPreview, c.unread > 0 && styles.chatPreviewUnread]}
                          numberOfLines={1}
                        >
                          {c.preview}
                        </Text>
                        {c.unread > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{c.unread}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </HapticTouchable>
                ))}
              </View>
            )}
          </>
        )}

        {tab === 'connections' && (
          <View style={styles.chatList}>
            {CONNECTIONS.map((c) => (
              <View key={c.id} style={styles.connectionItem}>
                <View style={styles.chatAvatarWrap}>
                  <View style={styles.chatAvatar}>
                    <Ionicons name={c.icon} size={20} color={theme.gold} />
                  </View>
                  {c.online && <View style={styles.chatOnlineDot} />}
                </View>
                <View style={styles.chatText}>
                  <Text style={styles.chatName}>{c.name}</Text>
                  <Text style={styles.connectionRole}>{c.role}</Text>
                </View>
                <HapticTouchable
                  style={styles.messageBtn}
                  onPress={() => navigate('chat', { id: c.id, name: c.name })}
                >
                  <Text style={styles.messageBtnText}>Mesaj</Text>
                </HapticTouchable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={newMessageModal}
        animationType="slide"
        transparent
        onRequestClose={() => setNewMessageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>YENİ MESAJ</Text>
              <HapticTouchable onPress={() => setNewMessageModal(false)}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </HapticTouchable>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={15} color={theme.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="İsimle ara..."
                placeholderTextColor={theme.textSecondary}
                value={userSearch}
                onChangeText={setUserSearch}
                autoFocus
              />
            </View>

            {searchingUsers ? (
              <ActivityIndicator color={theme.gold} style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={userResults}
                keyExtractor={(item) => item.user_id}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.modalEmptyText}>Kullanıcı bulunamadı</Text>
                }
                renderItem={({ item }) => (
                  <HapticTouchable
                    style={styles.userResultRow}
                    onPress={() => handleSelectUser(item)}
                  >
                    <View style={styles.chatAvatar}>
                      <Ionicons name="person-outline" size={20} color={theme.gold} />
                    </View>
                    <View style={styles.chatText}>
                      <Text style={styles.chatName}>{item.full_name || 'Kullanıcı'}</Text>
                      <Text style={styles.connectionRole}>
                        {[item.position, item.city].filter(Boolean).join(' · ') || '-'}
                      </Text>
                    </View>
                  </HapticTouchable>
                )}
              />
            )}
          </SafeAreaView>
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
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
    },
    title: { fontFamily: FontFamily.display, fontSize: 22, color: theme.text, letterSpacing: 0.5 },
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
    newMessageBtn: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    newMessageBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      maxHeight: '85%',
      minHeight: '60%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 16,
    },
    modalTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, letterSpacing: 0.5 },
    modalEmptyText: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 24,
      fontFamily: FontFamily.mono,
    },
    userResultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: 24,
      marginBottom: 20,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: RADIUS - 2,
      alignItems: 'center',
    },
    tabBtnActive: { backgroundColor: theme.gold },
    tabText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.textSecondary },
    tabTextActive: { color: Paper.ink },
    connectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    connectionRole: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    messageBtn: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    messageBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.gold },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 24,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      height: 48,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 24,
    },
    searchInput: { flex: 1, fontFamily: FontFamily.mono, fontSize: 14, color: theme.text },
    chatList: { paddingHorizontal: 24, gap: 4 },
    chatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    chatAvatarWrap: { position: 'relative' },
    chatAvatar: {
      width: 48,
      height: 48,
      borderRadius: RADIUS,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    chatOnlineDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: theme.success,
      borderWidth: 2,
      borderColor: theme.bg,
    },
    chatText: { flex: 1 },
    chatTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    chatName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
    chatTime: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary },
    chatBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    chatPreview: { flex: 1, fontFamily: FontFamily.body, fontSize: 13, color: theme.textSecondary },
    chatPreviewUnread: { color: theme.textMuted, fontFamily: FontFamily.bodySemiBold },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: RADIUS - 2,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadBadgeText: { fontFamily: FontFamily.monoMedium, fontSize: 11, color: Paper.ink },
  });
