import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { notifyEvent } from '../lib/notify';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';
import BottomSheet from '../components/BottomSheet';

const RADIUS = CARD_RADIUS;

type ChatView = {
  id: string | number;
  name: string;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
};

type PendingRequestView = {
  connectionId: string;
  userId: string;
  name: string;
  position: string | null;
};

type AcceptedConnectionView = {
  connectionId: string;
  userId: string;
  name: string;
  position: string | null;
};

const formatRelativeTime = (iso: string, t: (key: any) => string) => {
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
  navigate: (screen: string, params?: any) => void;
}

export default function MessagesScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [tab, setTab] = useState<'messages' | 'connections' | 'tribun'>('messages');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chats, setChats] = useState<ChatView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequestView[]>([]);
  const [acceptedConnections, setAcceptedConnections] = useState<AcceptedConnectionView[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);

  const [newMessageModal, setNewMessageModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<
    { user_id: string; full_name: string; position: string | null; city: string | null }[]
  >([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  useEffect(() => {
    loadMessages();
    loadConnections();
  }, []);

  useEffect(() => {
    if (!newMessageModal) return;
    const query = userSearch.trim();
    let cancelled = false;
    setSearchingUsers(true);

    const timer = setTimeout(async () => {
      let request = profiles
        .publicTable()
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
    loadConnections();
  };

  const loadMessages = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: convRows, error: convError } = await supabase
      .from('conversations')
      .select('id, participant_a, participant_b')
      .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`);

    if (convError || !convRows || convRows.length === 0) {
      setChats([]);
      setUnreadCount(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const otherIdByConv = new Map<string, string>();
    for (const c of convRows) {
      otherIdByConv.set(String(c.id), c.participant_a === user.id ? c.participant_b : c.participant_a);
    }
    const convIds = convRows.map((c: any) => c.id);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      setChats([]);
      setUnreadCount(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const groups = new Map<string, any[]>();
    for (const m of data) {
      const list = groups.get(String(m.conversation_id)) ?? [];
      list.push(m);
      groups.set(String(m.conversation_id), list);
    }

    const otherIds = Array.from(groups.keys()).map((convId) => otherIdByConv.get(convId)!);
    const { data: otherProfiles } = await profiles.publicProfiles(otherIds, 'user_id, full_name');
    const nameMap = new Map((otherProfiles ?? []).map((p: any) => [p.user_id, p.full_name]));

    const conversations: ChatView[] = Array.from(groups.keys()).map((convId) => {
      const otherId = otherIdByConv.get(convId)!;
      const msgs = groups.get(convId)!;
      const last = [...msgs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const unread = msgs.filter((m) => !m.read && m.sender_user_id !== user.id).length;
      return {
        id: otherId,
        name: nameMap.get(otherId) ?? t('common_defaultUser'),
        preview: last.body,
        time: formatRelativeTime(last.created_at, t),
        unread,
        online: false,
      };
    });

    setChats(conversations);
    setUnreadCount(data.filter((m: any) => !m.read && m.sender_user_id !== user.id).length);
    setLoading(false);
    setRefreshing(false);
  };

  const loadConnections = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setConnectionsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('connections')
      .select('id, requester_id, target_id, status')
      .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);

    if (error || !data) {
      if (error && __DEV__) console.log('Bağlantılar yüklenemedi:', error);
      setPendingRequests([]);
      setAcceptedConnections([]);
      setConnectionsLoading(false);
      return;
    }

    const pending = data.filter((c: any) => c.status === 'pending' && c.target_id === user.id);
    const accepted = data.filter((c: any) => c.status === 'accepted');

    const otherIds = Array.from(
      new Set([
        ...pending.map((c: any) => c.requester_id),
        ...accepted.map((c: any) => (c.requester_id === user.id ? c.target_id : c.requester_id)),
      ])
    );

    if (otherIds.length === 0) {
      setPendingRequests([]);
      setAcceptedConnections([]);
      setConnectionsLoading(false);
      return;
    }

    const { data: requesterProfiles } = await profiles.publicProfiles(otherIds, 'user_id, full_name, position');
    const profileMap = new Map((requesterProfiles ?? []).map((p: any) => [p.user_id, p]));

    setPendingRequests(
      pending.map((c: any) => ({
        connectionId: c.id,
        userId: c.requester_id,
        name: profileMap.get(c.requester_id)?.full_name ?? t('common_defaultUser'),
        position: profileMap.get(c.requester_id)?.position ?? null,
      }))
    );
    setAcceptedConnections(
      accepted.map((c: any) => {
        const otherId = c.requester_id === user.id ? c.target_id : c.requester_id;
        return {
          connectionId: c.id,
          userId: otherId,
          name: profileMap.get(otherId)?.full_name ?? t('common_defaultUser'),
          position: profileMap.get(otherId)?.position ?? null,
        };
      })
    );
    setConnectionsLoading(false);
  };

  const handleAcceptRequest = async (req: PendingRequestView) => {
    const { error } = await supabase
      .from('connections')
      .update({ status: 'accepted' })
      .eq('id', req.connectionId);
    if (error) {
      setToast({ message: t('messages_acceptFailed'), type: 'error' });
      return;
    }
    notifyEvent({ kind: 'connection_accepted', requesterUserId: req.userId });
    setToast({ message: t('messages_acceptedToast'), type: 'success' });
    loadConnections();
  };

  const handleRejectRequest = async (req: PendingRequestView) => {
    const { error } = await supabase.from('connections').delete().eq('id', req.connectionId);
    if (error) {
      setToast({ message: t('messages_rejectFailed'), type: 'error' });
      return;
    }
    setPendingRequests((prev) => prev.filter((p) => p.connectionId !== req.connectionId));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('messages_headerTitle')}</Text>
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
          <Text style={styles.title}>{t('messages_headerTitle')}</Text>
          {unreadCount > 0 && (
            <View style={styles.headerUnreadBadge}>
              <Text style={styles.headerUnreadText}>{unreadCount}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <HapticTouchable style={[styles.newMessageBtn, { flexDirection: 'row', alignItems: 'center', gap: 6 }]} onPress={openNewMessage}>
            <Ionicons name="create-outline" size={13} color={theme.gold} />
            <Text style={styles.newMessageBtnText}>{t('messages_newMessage')}</Text>
          </HapticTouchable>
        </View>

        <View style={styles.tabRow}>
          <HapticTouchable
            style={[styles.tabBtn, tab === 'messages' && styles.tabBtnActive]}
            onPress={() => setTab('messages')}
          >
            <Text style={[styles.tabText, tab === 'messages' && styles.tabTextActive]}>{t('messages')}</Text>
          </HapticTouchable>
          <HapticTouchable
            style={[styles.tabBtn, tab === 'connections' && styles.tabBtnActive]}
            onPress={() => setTab('connections')}
          >
            <Text style={[styles.tabText, tab === 'connections' && styles.tabTextActive]}>{t('messages_connectionsTab')}</Text>
          </HapticTouchable>
          <HapticTouchable
            style={[styles.tabBtn, tab === 'tribun' && styles.tabBtnActive]}
            onPress={() => setTab('tribun')}
          >
            <Text style={[styles.tabText, tab === 'tribun' && styles.tabTextActive]}>{t('sahadan_title')}</Text>
          </HapticTouchable>
        </View>

        {tab === 'tribun' && (
          <View style={styles.tribunCard}>
            <View style={styles.tribunIconWrap}>
              <Ionicons name="megaphone-outline" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.tribunTitle}>{t('sahadan_title').toUpperCase()}</Text>
            <Text style={styles.tribunSub}>{t('messages_tribunDesc')}</Text>
            <HapticTouchable style={styles.tribunBtn} onPress={() => navigate('tribun')}>
              <Ionicons name="chatbubbles-outline" size={14} color={Paper.ink} />
              <Text style={styles.tribunBtnText}>{t('messages_joinChat')}</Text>
            </HapticTouchable>
          </View>
        )}

        {tab === 'messages' && (
          <>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={15} color={theme.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('messages_searchPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {chats.length === 0 ? (
              <EmptyState
                icon="chatbubble-outline"
                title={t('messages_emptyChatsTitle')}
                subtitle={t('messages_emptyChatsSub')}
                actionLabel={t('messages_findScout')}
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
          <>
            {connectionsLoading ? (
              <View style={{ paddingHorizontal: 24, gap: 12 }}>
                <SkeletonCard height={64} />
                <SkeletonCard height={64} />
              </View>
            ) : (
              <>
                {pendingRequests.length > 0 && (
                  <View style={styles.pendingSection}>
                    <Text style={styles.sectionLabel}>{t('messages_pendingRequests')}</Text>
                    <View style={styles.chatList}>
                      {pendingRequests.map((r) => (
                        <View key={r.connectionId} style={styles.connectionItem}>
                          <View style={styles.chatAvatarWrap}>
                            <View style={styles.chatAvatar}>
                              <Ionicons name="person-outline" size={20} color={theme.gold} />
                            </View>
                          </View>
                          <View style={styles.chatText}>
                            <Text style={styles.chatName}>{r.name}</Text>
                            <Text style={styles.connectionRole}>{r.position ?? '-'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <HapticTouchable
                              style={styles.messageBtn}
                              onPress={() => handleAcceptRequest(r)}
                            >
                              <Text style={styles.messageBtnText}>{t('teamProfile_accept')}</Text>
                            </HapticTouchable>
                            <HapticTouchable
                              style={styles.rejectBtn}
                              onPress={() => handleRejectRequest(r)}
                            >
                              <Text style={styles.rejectBtnText}>{t('teamProfile_reject')}</Text>
                            </HapticTouchable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {acceptedConnections.length === 0 ? (
                  <EmptyState
                    icon="people-outline"
                    title={t('messages_emptyConnectionsTitle')}
                    subtitle={t('messages_emptyConnectionsSub')}
                    actionLabel={t('messages_findScout')}
                    onAction={() => navigate('scout')}
                  />
                ) : (
                  <View style={styles.chatList}>
                    {acceptedConnections.map((c) => (
                      <View key={c.connectionId} style={styles.connectionItem}>
                        <View style={styles.chatAvatarWrap}>
                          <View style={styles.chatAvatar}>
                            <Ionicons name="person-outline" size={20} color={theme.gold} />
                          </View>
                        </View>
                        <View style={styles.chatText}>
                          <Text style={styles.chatName}>{c.name}</Text>
                          <Text style={styles.connectionRole}>{c.position ?? '-'}</Text>
                        </View>
                        <HapticTouchable
                          style={styles.messageBtn}
                          onPress={() => navigate('chat', { id: c.userId, name: c.name })}
                        >
                          <Text style={styles.messageBtnText}>{t('teamProfile_message')}</Text>
                        </HapticTouchable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={newMessageModal}
        onClose={() => setNewMessageModal(false)}
        theme={theme}
        contentStyle={{ maxHeight: '85%', minHeight: '60%', paddingHorizontal: 0 }}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('messages_newMessageModalTitle')}</Text>
          <HapticTouchable onPress={() => setNewMessageModal(false)}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </HapticTouchable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={15} color={theme.textSecondary} style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('messages_searchByName')}
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
              <Text style={styles.modalEmptyText}>{t('messages_userNotFound')}</Text>
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
                  <Text style={styles.chatName}>{item.full_name || t('common_defaultUser')}</Text>
                  <Text style={styles.connectionRole}>
                    {[item.position, item.city].filter(Boolean).join(' · ') || '-'}
                  </Text>
                </View>
              </HapticTouchable>
            )}
          />
        )}
      </BottomSheet>

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
    tribunCard: {
      marginHorizontal: 24,
      marginBottom: 24,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 24,
      alignItems: 'center',
    },
    tribunIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.purple,
      borderWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    tribunTitle: {
      fontFamily: FontFamily.display,
      fontSize: 16,
      color: theme.text,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    tribunSub: {
      fontFamily: FontFamily.body,
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 18,
    },
    tribunBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    tribunBtnText: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: Paper.ink },
    pendingSection: { marginBottom: 20 },
    sectionLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 1,
      marginHorizontal: 24,
      marginBottom: 8,
    },
    rejectBtn: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    rejectBtnText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
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
      borderRadius: 24,
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
    chatName: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text },
    chatTime: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted },
    chatBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    chatPreview: { flex: 1, fontFamily: FontFamily.body, fontSize: 13, color: theme.textSecondary },
    chatPreviewUnread: { color: theme.text, fontFamily: FontFamily.bodySemiBold },
    // Okunmamış sayısı: sade koyu yeşil zemin + beyaz metin (kontrast 5.36:1).
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.goldDark,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    unreadBadgeText: { fontFamily: FontFamily.bodySemiBold, fontSize: 11, color: '#FFFFFF' },
  });
