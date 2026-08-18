import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';

const RADIUS = CARD_RADIUS;
import { supabase } from '../lib/supabase';
import { notifyUser } from '../lib/notify';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';

type MessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface Props {
  navigate: (screen: string) => void;
  otherUserId: string;
  otherUserName: string;
}

export default function ChatScreen({ navigate, otherUserId, otherUserName }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [myName, setMyName] = useState('');
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [otherProfile, setOtherProfile] = useState<{
    full_name: string | null;
    position: string | null;
    avatar_url: string | null;
  } | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadMessages();
    loadOtherProfile();
  }, []);

  const loadOtherProfile = async () => {
    if (!otherUserId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, position, avatar_url')
      .eq('user_id', otherUserId)
      .single();
    if (error) {
      if (__DEV__) console.log('Kullanıcı profili yüklenemedi:', error);
      return;
    }
    setOtherProfile(data);
  };

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`messages-${userId}-${otherUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const m = payload.new as MessageRow;
          const inThread =
            (m.sender_id === userId && m.receiver_id === otherUserId) ||
            (m.sender_id === otherUserId && m.receiver_id === userId);
          if (!inThread) return;

          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          if (m.receiver_id === userId) {
            supabase.from('messages').update({ read: true }).eq('id', m.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, otherUserId]);

  const loadMessages = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setMyName(data?.full_name ?? ''));

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true });

    if (error) {
      if (__DEV__) console.log('Mesajlar yüklenemedi:', error);
      setMessages([]);
    } else {
      setMessages(data ?? []);
      const unreadIds = (data ?? [])
        .filter((m: any) => !m.read && m.receiver_id === user.id)
        .map((m: any) => m.id);
      if (unreadIds.length > 0) {
        supabase.from('messages').update({ read: true }).in('id', unreadIds);
      }
    }
    setLoading(false);
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !userId) return;
    setText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: userId, receiver_id: otherUserId, content })
      .select()
      .single();

    if (error) {
      if (__DEV__) console.log('Mesaj gönderilemedi:', error);
      setToast({ message: 'Mesaj gönderilemedi', type: 'error' });
      setText(content);
    } else if (data) {
      setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
      notifyUser(otherUserId, 'chatbubble-outline', `${myName || 'Bir kullanıcı'} sana mesaj gönderdi`, 'chat', 'Yeni Mesaj');
    }
  };

  if (loading) {
    return <LoadingScreen message="Sohbet yükleniyor..." />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <HapticTouchable style={styles.backBtn} onPress={() => navigate('messages')}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <View style={styles.avatar}>
            {otherProfile?.avatar_url ? (
              <Image source={{ uri: otherProfile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-outline" size={17} color={theme.gold} />
            )}
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {otherProfile?.full_name || otherUserName || 'Kullanıcı'}
            </Text>
            {otherProfile?.position && (
              <Text style={styles.subtitle} numberOfLines={1}>{otherProfile.position}</Text>
            )}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="chatbubble-outline" size={22} color={theme.gold} />
              </View>
              <Text style={styles.emptyText}>Henüz mesaj yok, ilk mesajı sen gönder</Text>
            </View>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === userId;
              return (
                <View
                  key={m.id}
                  style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}
                >
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {m.content}
                    </Text>
                  </View>
                  <Text style={styles.bubbleTime}>{formatTime(m.created_at)}</Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz..."
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
          />
          <HapticTouchable
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={16} color={Paper.ink} />
          </HapticTouchable>
        </View>
      </KeyboardAvoidingView>

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
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
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
    avatar: {
      width: 38,
      height: 38,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatarImage: { width: 38, height: 38, borderRadius: RADIUS },
    titleWrap: { flex: 1 },
    title: { fontSize: 15, fontFamily: FontFamily.display, letterSpacing: 0.5, color: theme.text },
    subtitle: { fontSize: 11, color: theme.gold, fontFamily: FontFamily.mono, marginTop: 1 },
    messagesContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, flexGrow: 1 },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 60,
    },
    emptyIconWrap: {
      width: 48,
      height: 48,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyText: { fontSize: 13, color: theme.textSecondary, fontFamily: FontFamily.mono, textAlign: 'center' },
    bubbleWrap: { marginBottom: 14, maxWidth: '78%' },
    bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    bubbleWrapOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubble: {
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    bubbleMine: { backgroundColor: theme.gold, borderBottomRightRadius: 2 },
    bubbleOther: {
      backgroundColor: theme.card,
      borderBottomLeftRadius: 2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bubbleText: { fontSize: 14, fontFamily: FontFamily.body, color: theme.text, lineHeight: 19 },
    bubbleTextMine: { color: Paper.ink },
    bubbleTime: { fontSize: 10, fontFamily: FontFamily.mono, color: theme.textSecondary, marginTop: 4, marginHorizontal: 4 },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 110,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
      fontFamily: FontFamily.mono,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: { opacity: 0.4 },
  });
