import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper, PREMIUM_HEART_COLOR, PREMIUM_NAME_GRADIENT } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import {
  SocialPost,
  PostAuthor,
  PostCommentRow,
  fetchAuthorsMap,
  formatRelativeTime,
} from '../lib/socialSaha';
import YouTubePlayer from '../components/YouTubePlayer';
import GradientText from '../components/GradientText';
import EmptyState from '../components/EmptyState';
import SkeletonCard from '../components/SkeletonCard';
import HapticTouchable from '../components/HapticTouchable';
import Toast from '../components/Toast';

const RADIUS = CARD_RADIUS;
const PAGE_SIZE = 12;

interface Props {
  navigate: (screen: string, params?: any) => void;
  userId?: string | null;
}

type ToastState = { message: string; type: 'error' | 'success' } | null;

export default function SocialFeedScreen({ navigate, userId }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);

  const [currentUserId, setCurrentUserId] = useState<string | null>(userId ?? null);
  const [viewerIsPremium, setViewerIsPremium] = useState(false);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);

  const [commentsPost, setCommentsPost] = useState<SocialPost | null>(null);
  const [likesPost, setLikesPost] = useState<SocialPost | null>(null);

  const pageRef = useRef(0);
  const followingIdsRef = useRef<string[] | null>(null);

  useEffect(() => {
    (async () => {
      if (userId) {
        setCurrentUserId(userId);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id ?? null);
    })();
  }, [userId]);

  useEffect(() => {
    if (!currentUserId) return;
    loadFeed(true);
    fetchAuthorsMap([currentUserId]).then((map) => setViewerIsPremium(!!map.get(currentUserId)?.is_premium));
  }, [currentUserId]);

  const loadFeed = async (reset: boolean) => {
    if (!currentUserId) return;
    if (reset) {
      pageRef.current = 0;
      setLoading(posts.length === 0);
    } else {
      setLoadingMore(true);
    }

    try {
      if (reset || followingIdsRef.current === null) {
        const { data: followRows } = await supabase
          .from('follows')
          .select('followed_id')
          .eq('follower_id', currentUserId);
        followingIdsRef.current = (followRows ?? []).map((r: any) => r.followed_id);
      }
      const followingIds = followingIdsRef.current ?? [];

      const page = reset ? 0 : pageRef.current;
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (followingIds.length > 0) {
        query = query.in('user_id', [...followingIds, currentUserId]);
      }

      const { data, error } = await query;
      if (error) {
        if (__DEV__) console.log('Akış yüklenemedi:', error);
        if (reset) setPosts([]);
        setHasMore(false);
        if (error.code) {
          // Real Postgrest error (e.g. table missing until the migration is
          // applied) — surface it instead of failing silently.
          setToast({ message: t('social_loadFailed'), type: 'error' });
        }
        return;
      }

      const rows = (data ?? []) as any[];
      const authorIds = rows.map((r) => r.user_id);
      const [authorsMap, likedSet] = await Promise.all([
        fetchAuthorsMap(authorIds),
        fetchLikedSet(rows.map((r) => r.id)),
      ]);

      const mapped: SocialPost[] = rows.map((r) => ({
        ...r,
        author: authorsMap.get(r.user_id),
        liked_by_me: likedSet.has(r.id),
      }));

      setPosts((prev) => (reset ? mapped : [...prev, ...mapped]));
      setHasMore(rows.length === PAGE_SIZE);
      pageRef.current = page + 1;
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const fetchLikedSet = async (postIds: string[]): Promise<Set<string>> => {
    if (!currentUserId || postIds.length === 0) return new Set();
    const { data } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in('post_id', postIds);
    return new Set((data ?? []).map((r: any) => r.post_id));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    followingIdsRef.current = null;
    loadFeed(true);
  };

  const handleEndReached = () => {
    if (loadingMore || !hasMore || loading) return;
    loadFeed(false);
  };

  const toggleLike = async (post: SocialPost) => {
    if (!currentUserId) return;
    const wasLiked = !!post.liked_by_me;

    // Optimistic update first — UI reacts instantly, DB call happens after.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: !wasLiked, likes_count: Math.max(0, p.likes_count + (wasLiked ? -1 : 1)) }
          : p
      )
    );

    const revert = () => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, liked_by_me: wasLiked, likes_count: Math.max(0, p.likes_count + (wasLiked ? 1 : -1)) }
            : p
        )
      );
    };

    if (wasLiked) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUserId);
      if (error) revert();
    } else {
      const { error } = await supabase
        .from('post_likes')
        .insert({ post_id: post.id, user_id: currentUserId });
      if (error) revert();
    }
  };

  const onCommentsChanged = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count + delta) } : p))
    );
    setCommentsPost((prev) => (prev && prev.id === postId ? { ...prev, comments_count: Math.max(0, prev.comments_count + delta) } : prev));
  };

  const goToAuthorProfile = (post: SocialPost) => {
    navigate(post.author?.is_team ? 'teamProfile' : 'profile', { userId: post.user_id });
  };

  const goToUserProfile = (uid: string, isTeam: boolean) => {
    navigate(isTeam ? 'teamProfile' : 'profile', { userId: uid });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('social_feedTitle')}</Text>
        <HapticTouchable style={styles.createBtn} onPress={() => navigate('createPost')}>
          <Ionicons name="add" size={22} color={Paper.ink} />
        </HapticTouchable>
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonCard height={280} style={{ marginBottom: 16 }} />
          <SkeletonCard height={280} style={{ marginBottom: 16 }} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.gold} />}
          onEndReachedThreshold={0.4}
          onEndReached={handleEndReached}
          ListEmptyComponent={
            <EmptyState
              icon="film-outline"
              title={t('social_emptyTitle')}
              subtitle={t('social_emptySubtitle')}
              actionLabel={t('social_createPost')}
              onAction={() => navigate('createPost')}
            />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              theme={theme}
              t={t}
              viewerIsPremium={viewerIsPremium}
              onToggleLike={() => toggleLike(item)}
              onOpenComments={() => setCommentsPost(item)}
              onOpenLikes={() => setLikesPost(item)}
              onPressAuthor={() => goToAuthorProfile(item)}
            />
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.gold} style={{ marginVertical: 16 }} /> : undefined}
        />
      )}

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type ?? 'info'} onHide={() => setToast(null)} />

      <CommentsModal
        post={commentsPost}
        visible={!!commentsPost}
        onClose={() => setCommentsPost(null)}
        currentUserId={currentUserId}
        theme={theme}
        t={t}
        onCommentsChanged={onCommentsChanged}
        onPressAuthor={(uid, isTeam) => {
          setCommentsPost(null);
          goToUserProfile(uid, isTeam);
        }}
      />

      <LikesModal
        post={likesPost}
        visible={!!likesPost}
        onClose={() => setLikesPost(null)}
        theme={theme}
        t={t}
        onPressAuthor={(uid, isTeam) => {
          setLikesPost(null);
          goToUserProfile(uid, isTeam);
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Post card
// ---------------------------------------------------------------------------

function AuthorAvatar({ author, size = 40, theme }: { author?: PostAuthor; size?: number; theme: Theme }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.card2,
        borderWidth: 1,
        borderColor: author?.is_premium ? theme.gold : theme.border,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {author?.avatar_url ? (
        <Image source={{ uri: author.avatar_url }} style={{ width: size, height: size }} />
      ) : (
        <Ionicons name="person-outline" size={size * 0.5} color={theme.textSecondary} />
      )}
    </View>
  );
}

function UploadedVideoPlayer({ uri, height }: { uri: string; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      style={{ width: '100%', height, borderRadius: CARD_RADIUS, overflow: 'hidden', backgroundColor: '#000' }}
      player={player}
      nativeControls
      contentFit="cover"
    />
  );
}

interface PostCardProps {
  post: SocialPost;
  theme: Theme;
  t: (key: any) => string;
  viewerIsPremium: boolean;
  onToggleLike: () => void;
  onOpenComments: () => void;
  onOpenLikes: () => void;
  onPressAuthor: () => void;
}

function PostCard({ post, theme, t, viewerIsPremium, onToggleLike, onOpenComments, onOpenLikes, onPressAuthor }: PostCardProps) {
  const styles = createStyles(theme);
  const authorName = post.author?.full_name || t('common_defaultUser');

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} activeOpacity={0.7} onPress={onPressAuthor}>
        <AuthorAvatar author={post.author} theme={theme} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={styles.authorNameRow}>
            <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
            {post.author?.is_premium && <Ionicons name="star" size={12} color={theme.gold} />}
          </View>
          {post.post_type === 'match_video' && (post.venue_name || post.match_date) ? (
            <Text style={styles.metaLine} numberOfLines={1}>
              {[post.venue_name, post.match_date].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <Text style={styles.timeText}>{formatRelativeTime(post.created_at, t)}</Text>
      </TouchableOpacity>

      <View style={styles.mediaWrap}>
        {post.post_type === 'match_video' && post.youtube_video_id ? (
          <YouTubePlayer videoId={post.youtube_video_id} startSeconds={post.highlight_start_sec ?? 0} />
        ) : post.post_type === 'video' && post.media_url ? (
          <UploadedVideoPlayer uri={post.media_url} height={220} />
        ) : post.post_type === 'photo' && post.media_url ? (
          <Image source={{ uri: post.media_url }} style={styles.photo} resizeMode="cover" />
        ) : null}
      </View>

      {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      <View style={styles.actionsRow}>
        <HapticTouchable style={styles.actionItem} onPress={onToggleLike}>
          <Ionicons
            name={post.liked_by_me ? 'heart' : 'heart-outline'}
            size={20}
            color={post.liked_by_me ? (viewerIsPremium ? theme.gold : theme.error) : theme.textSecondary}
          />
        </HapticTouchable>
        <TouchableOpacity onPress={onOpenLikes} disabled={post.likes_count === 0}>
          <Text style={styles.countText}>{post.likes_count} {t('social_likesLabel')}</Text>
        </TouchableOpacity>

        <HapticTouchable style={[styles.actionItem, { marginLeft: 18 }]} onPress={onOpenComments}>
          <Ionicons name="chatbubble-outline" size={18} color={theme.textSecondary} />
        </HapticTouchable>
        <TouchableOpacity onPress={onOpenComments}>
          <Text style={styles.countText}>{post.comments_count} {t('social_commentsLabel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Comments modal
// ---------------------------------------------------------------------------

interface CommentsModalProps {
  post: SocialPost | null;
  visible: boolean;
  onClose: () => void;
  currentUserId: string | null;
  theme: Theme;
  t: (key: any) => string;
  onCommentsChanged: (postId: string, delta: number) => void;
  onPressAuthor: (userId: string, isTeam: boolean) => void;
}

function CommentsModal({ post, visible, onClose, currentUserId, theme, t, onCommentsChanged, onPressAuthor }: CommentsModalProps) {
  const styles = createStyles(theme);
  const [comments, setComments] = useState<PostCommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible && post) loadComments(post.id);
    if (!visible) {
      setComments([]);
      setBody('');
    }
  }, [visible, post?.id]);

  const loadComments = async (postId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      if (error && __DEV__) console.log('Yorumlar yüklenemedi:', error);
      setComments([]);
      setLoading(false);
      return;
    }

    const authorsMap = await fetchAuthorsMap((data as any[]).map((r) => r.user_id));
    setComments((data as any[]).map((r) => ({ ...r, author: authorsMap.get(r.user_id) })));
    setLoading(false);
  };

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !post || !currentUserId || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: post.id, user_id: currentUserId, body: trimmed })
      .select()
      .single();
    setSending(false);
    if (error || !data) {
      if (__DEV__) console.log('Yorum gönderilemedi:', error);
      return;
    }

    const authorsMap = await fetchAuthorsMap([currentUserId]);
    setComments((prev) => [...prev, { ...(data as any), author: authorsMap.get(currentUserId) }]);
    setBody('');
    onCommentsChanged(post.id, 1);
  };

  const handleDelete = (comment: PostCommentRow) => {
    if (!post) return;
    Alert.alert(t('social_deleteCommentTitle'), t('social_deleteCommentBody'), [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: t('social_deleteAction'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('post_comments').delete().eq('id', comment.id);
          if (error) {
            if (__DEV__) console.log('Yorum silinemedi:', error);
            return;
          }
          setComments((prev) => prev.filter((c) => c.id !== comment.id));
          onCommentsChanged(post.id, -1);
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('social_commentsTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.gold} style={{ marginVertical: 24 }} />
          ) : comments.length === 0 ? (
            <View style={{ paddingVertical: 24 }}>
              <Text style={styles.emptyText}>{t('social_emptyCommentsYet')}</Text>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const canDelete =
                  !!currentUserId && (item.user_id === currentUserId || post?.user_id === currentUserId);
                return (
                  <View style={styles.commentRow}>
                    <TouchableOpacity onPress={() => onPressAuthor(item.user_id, !!item.author?.is_team)}>
                      <AuthorAvatar author={item.author} size={32} theme={theme} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.authorNameRow}>
                        <TouchableOpacity onPress={() => onPressAuthor(item.user_id, !!item.author?.is_team)}>
                          <Text style={[styles.commentAuthor, item.author?.is_premium && { color: theme.gold }]}>
                            {item.author?.full_name || t('common_defaultUser')}
                          </Text>
                        </TouchableOpacity>
                        {item.author?.is_premium && <Ionicons name="star" size={11} color={theme.gold} />}
                      </View>
                      <Text style={styles.commentBody}>{item.body}</Text>
                      <Text style={styles.timeText}>{formatRelativeTime(item.created_at, t)}</Text>
                    </View>
                    {canDelete && (
                      <TouchableOpacity style={styles.commentDeleteBtn} onPress={() => handleDelete(item)}>
                        <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder={t('social_commentPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={body}
              onChangeText={setBody}
              multiline
            />
            <HapticTouchable style={styles.commentSendBtn} onPress={handleSend} disabled={sending || !body.trim()}>
              {sending ? <ActivityIndicator size="small" color={Paper.ink} /> : <Ionicons name="send" size={16} color={Paper.ink} />}
            </HapticTouchable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Likes modal ("kimler beğendi")
// ---------------------------------------------------------------------------

interface LikesModalProps {
  post: SocialPost | null;
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  t: (key: any) => string;
  onPressAuthor: (userId: string, isTeam: boolean) => void;
}

function LikesModal({ post, visible, onClose, theme, t, onPressAuthor }: LikesModalProps) {
  const styles = createStyles(theme);
  const [likers, setLikers] = useState<PostAuthor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && post) loadLikers(post.id);
    if (!visible) setLikers([]);
  }, [visible, post?.id]);

  const loadLikers = async (postId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('post_likes')
      .select('user_id, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      setLikers([]);
      setLoading(false);
      return;
    }

    const authorsMap = await fetchAuthorsMap((data as any[]).map((r) => r.user_id));
    setLikers(
      (data as any[])
        .map((r) => authorsMap.get(r.user_id))
        .filter((a): a is PostAuthor => !!a)
    );
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('social_whoLikedTitle')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={theme.gold} style={{ marginVertical: 24 }} />
          ) : likers.length === 0 ? (
            <View style={{ paddingVertical: 24 }}>
              <Text style={styles.emptyText}>{t('social_emptyLikesYet')}</Text>
            </View>
          ) : (
            <FlatList
              data={likers}
              keyExtractor={(a) => a.user_id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.likerRow} onPress={() => onPressAuthor(item.user_id, item.is_team)}>
                  <AuthorAvatar author={item} size={36} theme={theme} />
                  <View style={[styles.authorNameRow, { flex: 1 }]}>
                    {item.is_premium ? (
                      <GradientText colors={PREMIUM_NAME_GRADIENT} style={styles.commentAuthor}>
                        {item.full_name || t('common_defaultUser')}
                      </GradientText>
                    ) : (
                      <Text style={styles.commentAuthor}>{item.full_name || t('common_defaultUser')}</Text>
                    )}
                    {item.is_premium && <Ionicons name="star" size={12} color={PREMIUM_HEART_COLOR} />}
                  </View>
                  <Ionicons name="heart" size={16} color={item.is_premium ? PREMIUM_HEART_COLOR : theme.error} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 12,
    },
    title: { fontFamily: FontFamily.display, fontSize: 24, color: theme.text, letterSpacing: 0.5 },
    createBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
    card: {
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 16,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    authorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    authorName: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
    metaLine: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.gold, marginTop: 2 },
    timeText: { fontFamily: FontFamily.mono, fontSize: 10, color: theme.textSecondary },
    mediaWrap: { marginBottom: 10 },
    photo: { width: '100%', height: 260, borderRadius: RADIUS, backgroundColor: theme.card2 },
    caption: { fontFamily: FontFamily.body, fontSize: 13, color: theme.text, marginBottom: 10, lineHeight: 19 },
    actionsRow: { flexDirection: 'row', alignItems: 'center' },
    actionItem: { marginRight: 6 },
    countText: { fontFamily: FontFamily.mono, fontSize: 12, color: theme.textSecondary },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.bg2,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '80%',
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    sheetTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, letterSpacing: 0.5 },
    emptyText: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textSecondary, textAlign: 'center' },
    commentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
    commentAuthor: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text },
    commentBody: { fontFamily: FontFamily.body, fontSize: 13, color: theme.text, marginTop: 2, lineHeight: 18 },
    commentDeleteBtn: { padding: 6, marginLeft: 4 },
    commentInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
    },
    commentInput: {
      flex: 1,
      maxHeight: 100,
      backgroundColor: theme.card2,
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: theme.text,
      fontFamily: FontFamily.body,
      fontSize: 13,
      borderWidth: 1,
      borderColor: theme.border,
    },
    commentSendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    likerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  });
