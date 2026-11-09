import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { PostAuthor, fetchAuthorsMap } from '../lib/socialSaha';
import EmptyState from '../components/EmptyState';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;

interface Props {
  navigate: (screen: string, params?: any) => void;
  onBack?: () => void;
  userId: string;
  type: 'followers' | 'following';
  currentUserId?: string | null;
}

export default function UserFollowListScreen({ navigate, onBack, userId, type }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PostAuthor[]>([]);


  const loadList = async () => {
    setLoading(true);
    if (!userId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const column = type === 'followers' ? 'followed_id' : 'follower_id';
    const targetColumn = type === 'followers' ? 'follower_id' : 'followed_id';
    const { data, error } = await supabase
      .from('follows')
      .select(targetColumn)
      .eq(column, userId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (error && __DEV__) console.log('Takip listesi yüklenemedi:', error);
      setUsers([]);
      setLoading(false);
      return;
    }

    const ids = (data as any[]).map((r) => r[targetColumn]);
    const authorsMap = await fetchAuthorsMap(ids);
    setUsers(ids.map((id) => authorsMap.get(id)).filter((a): a is PostAuthor => !!a));
    setLoading(false);
  };

  useEffect(() => {
    loadList();
  }, [userId, type]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => (onBack ? onBack() : navigate('socialFeed'))}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>
          {type === 'followers' ? t('social_followersTitle') : t('social_followingTitle')}
        </Text>
        <View style={{ width: 42 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.user_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={type === 'followers' ? t('social_noFollowersYet') : t('social_noFollowingYet')}
              subtitle={t('social_followListEmptySubtitle')}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigate(item.is_team ? 'teamProfile' : 'profile', { userId: item.user_id })}
            >
              <View style={[styles.avatar, { borderColor: item.is_premium ? theme.gold : theme.border }]}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person-outline" size={22} color={theme.textSecondary} />
                )}
              </View>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{item.full_name || t('common_defaultUser')}</Text>
                {item.is_premium && <Ionicons name="star" size={12} color={theme.gold} />}
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
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
    title: { color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5 },
    list: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.card2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      overflow: 'hidden',
    },
    avatarImage: { width: 44, height: 44 },
    nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
    name: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text },
  });
