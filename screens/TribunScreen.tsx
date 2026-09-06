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
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { moderateMessage } from '../lib/security';
import { resolveSenderIdentities, SenderIdentity } from '../lib/chatIdentity';
import LoadingScreen from '../components/LoadingScreen';
import Toast from '../components/Toast';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;
const MAX_LENGTH = 500;
const HISTORY_LIMIT = 100;

type MediaKind = 'image' | 'video';

type MessageRow = {
  id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: MediaKind | null;
  created_at: string;
};

type PendingMedia = { uri: string; type: MediaKind };

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

interface Props {
  navigate: (screen: string) => void;
  userType?: 'player' | 'team';
}

export default function TribunScreen({ navigate, userType = 'player' }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [myIdentity, setMyIdentity] = useState<SenderIdentity | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [identities, setIdentities] = useState<Map<string, SenderIdentity>>(new Map());
  const [text, setText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const identitiesRef = useRef(identities);
  identitiesRef.current = identities;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('tribun')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tribun_messages' },
        async (payload) => {
          const m = payload.new as MessageRow;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));

          if (!identitiesRef.current.has(m.sender_id)) {
            const resolved = await resolveSenderIdentities([m.sender_id]);
            if (resolved.size > 0) {
              setIdentities((prev) => new Map([...prev, ...resolved]));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data, error } = await supabase
      .from('tribun_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);

    if (error) {
      if (__DEV__) console.log('Sahadan yüklenemedi:', error);
      setMessages([]);
      setLoading(false);
      return;
    }

    const ordered = [...(data ?? [])].reverse();
    setMessages(ordered);

    const senderIds = Array.from(new Set([user.id, ...ordered.map((m) => m.sender_id)]));
    const resolved = await resolveSenderIdentities(senderIds);
    setIdentities(resolved);
    setMyIdentity(resolved.get(user.id) ?? { name: 'Sen', kind: 'player' });
    setLoading(false);
  };

  const handleAttachPress = () => {
    Alert.alert(t('sahadan_mediaAddTitle'), t('sahadan_mediaAddBody'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('sahadan_gallery'), onPress: () => pickMedia('library') },
      { text: t('sahadan_camera'), onPress: () => pickMedia('camera') },
    ]);
  };

  const pickMedia = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      Alert.alert(
        t('teamProfile_permissionTitle'),
        source === 'camera'
          ? t('sahadan_cameraPermissionBody')
          : t('sahadan_galleryPermissionBody'),
        [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('teamProfile_openSettings'), onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const pickerOptions = {
      mediaTypes: ['images', 'videos'] as ImagePicker.MediaType[],
      quality: 0.7,
      videoMaxDuration: 60,
    };
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    setPendingMedia({ uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' });
  };

  const handleSend = async () => {
    const content = text.trim();
    if ((!content && !pendingMedia) || !userId || sending) return;

    if (content) {
      const moderation = moderateMessage(content);
      if (!moderation.allowed) {
        setToast({ message: t(moderation.reasonKey), type: 'error' });
        return;
      }
    }

    setSending(true);

    try {
      let mediaUrl: string | null = null;
      let mediaType: MediaKind | null = null;

      if (pendingMedia) {
        const ext = pendingMedia.type === 'video' ? 'mp4' : 'jpg';
        const path = `${userId}/tribun/${Date.now()}.${ext}`;
        const buffer = await fetch(pendingMedia.uri).then((r) => r.arrayBuffer());

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, buffer, {
            contentType: pendingMedia.type === 'video' ? 'video/mp4' : 'image/jpeg',
            upsert: true,
          });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
        mediaType = pendingMedia.type;
      }

      const { data, error } = await supabase
        .from('tribun_messages')
        .insert({ sender_id: userId, content: content || null, media_url: mediaUrl, media_type: mediaType })
        .select()
        .single();
      if (error) throw error;

      setText('');
      setPendingMedia(null);
      if (data) {
        setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
      }
    } catch (err) {
      if (__DEV__) console.log('Mesaj gönderilemedi:', err);
      setToast({ message: t('sahadan_sendFailed'), type: 'error' });
    }
    setSending(false);
  };

  if (loading) {
    return <LoadingScreen message={t('sahadan_loading')} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <HapticTouchable
            style={styles.backBtn}
            onPress={() => navigate(userType === 'team' ? 'teamHome' : 'messages')}
          >
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </HapticTouchable>
          <View style={styles.headerIconWrap}>
            <Ionicons name="megaphone-outline" size={17} color={theme.gold} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>{t('sahadan_title').toUpperCase()}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{t('sahadan_subtitle')}</Text>
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
                <Ionicons name="megaphone-outline" size={22} color={theme.gold} />
              </View>
              <Text style={styles.emptyText}>{t('sahadan_empty')}</Text>
            </View>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === userId;
              const identity = mine ? myIdentity : identities.get(m.sender_id);
              return (
                <View
                  key={m.id}
                  style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapOther]}
                >
                  {!mine && (
                    <View style={styles.senderRow}>
                      <View
                        style={[
                          styles.tagChip,
                          identity?.kind === 'team' ? styles.tagChipTeam : styles.tagChipPlayer,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagChipText,
                            identity?.kind === 'team' ? styles.tagChipTextTeam : styles.tagChipTextPlayer,
                          ]}
                        >
                          {identity?.kind === 'team' ? t('sahadan_tagTeam') : t('sahadan_tagPlayer')}
                        </Text>
                      </View>
                      <Text style={styles.senderName} numberOfLines={1}>
                        {identity?.name ?? t('common_defaultUser')}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleOther,
                      !!m.media_url && styles.bubbleWithMedia,
                    ]}
                  >
                    {m.media_url && m.media_type === 'image' && (
                      <Image
                        source={{ uri: m.media_url }}
                        style={[styles.mediaImage, !!m.content && { marginBottom: 6 }]}
                        resizeMode="cover"
                      />
                    )}
                    {m.media_url && m.media_type === 'video' && (
                      <HapticTouchable
                        style={[styles.mediaVideo, !!m.content && { marginBottom: 6 }]}
                        onPress={() => Linking.openURL(m.media_url!)}
                      >
                        <Ionicons name="play-circle" size={34} color={mine ? Paper.ink : theme.gold} />
                        <Text style={[styles.mediaVideoLabel, mine && styles.bubbleTextMine]}>{t('sahadan_videoOpen')}</Text>
                      </HapticTouchable>
                    )}
                    {!!m.content && (
                      <Text
                        style={[
                          styles.bubbleText,
                          mine && styles.bubbleTextMine,
                          !!m.media_url && styles.bubbleTextWithMedia,
                        ]}
                      >
                        {m.content}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.bubbleTime}>{formatTime(m.created_at)}</Text>
                </View>
              );
            })
          )}
        </ScrollView>

        {pendingMedia && (
          <View style={styles.pendingBar}>
            {pendingMedia.type === 'image' ? (
              <Image source={{ uri: pendingMedia.uri }} style={styles.pendingThumb} resizeMode="cover" />
            ) : (
              <View style={styles.pendingThumb}>
                <Ionicons name="play-circle" size={20} color={theme.gold} />
              </View>
            )}
            <Text style={styles.pendingLabel}>
              {pendingMedia.type === 'video' ? t('sahadan_videoAdded') : t('sahadan_photoAdded')}
            </Text>
            <HapticTouchable style={styles.pendingRemoveBtn} onPress={() => setPendingMedia(null)}>
              <Ionicons name="close" size={16} color={theme.textSecondary} />
            </HapticTouchable>
          </View>
        )}

        <View style={styles.inputBar}>
          <HapticTouchable style={styles.attachBtn} onPress={handleAttachPress} disabled={sending}>
            <Ionicons name="image-outline" size={19} color={theme.gold} />
          </HapticTouchable>
          <TextInput
            style={styles.input}
            placeholder={t('sahadan_placeholder')}
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_LENGTH))}
            multiline
          />
          <HapticTouchable
            style={[styles.sendBtn, (!text.trim() && !pendingMedia || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={(!text.trim() && !pendingMedia) || sending}
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
    headerIconWrap: {
      width: 38,
      height: 38,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
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
    senderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
      marginHorizontal: 4,
    },
    tagChip: {
      borderWidth: 1,
      borderRadius: RADIUS - 2,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    tagChipTeam: { borderColor: theme.gold, backgroundColor: 'transparent' },
    tagChipPlayer: { borderColor: theme.border, backgroundColor: 'transparent' },
    tagChipText: { fontFamily: FontFamily.monoMedium, fontSize: 9, letterSpacing: 0.5 },
    tagChipTextTeam: { color: theme.gold },
    tagChipTextPlayer: { color: theme.textSecondary },
    senderName: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.textMuted, flexShrink: 1 },
    bubble: {
      borderRadius: RADIUS,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    bubbleWithMedia: { padding: 6 },
    bubbleMine: { backgroundColor: theme.gold, borderBottomRightRadius: 2 },
    bubbleOther: {
      backgroundColor: theme.card,
      borderBottomLeftRadius: 2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bubbleText: { fontSize: 14, fontFamily: FontFamily.body, color: theme.text, lineHeight: 19 },
    bubbleTextMine: { color: Paper.ink },
    bubbleTextWithMedia: { paddingHorizontal: 10, paddingBottom: 4 },
    bubbleTime: { fontSize: 10, fontFamily: FontFamily.mono, color: theme.textSecondary, marginTop: 4, marginHorizontal: 4 },
    mediaImage: {
      width: 210,
      height: 210,
      borderRadius: RADIUS - 2,
      backgroundColor: theme.card2,
    },
    mediaVideo: {
      width: 210,
      height: 140,
      borderRadius: RADIUS - 2,
      backgroundColor: theme.card2,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    mediaVideoLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textSecondary },
    pendingBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 24,
      marginTop: 10,
      padding: 10,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pendingThumb: {
      width: 40,
      height: 40,
      borderRadius: RADIUS - 2,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pendingLabel: { flex: 1, fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },
    pendingRemoveBtn: {
      width: 28,
      height: 28,
      borderRadius: RADIUS - 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card2,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    attachBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
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
