// Ayarlar > Engellenen Kullanıcılar: oturum açanın engellediği kişiler (en yeni önce).
// Engel kaldırılınca satır anında kalkar; liste paylaşılan engel önbelleğiyle ve sunucuyla senkron tutulur.
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { discoveryRpcClient } from '../lib/discoveryClient';
import { unblockUser } from '../lib/blocking';
import { useBlockedIds } from '../lib/useBlockedIds';
import {
  blockedRowRoute,
  fetchMyBlockedUsers,
  visibleBlockedRows,
  type BlockedUserRow,
} from '../lib/blockedUsers';
import Toast from '../components/Toast';
import EmptyState from '../components/EmptyState';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;

interface Props {
  navigate: (screen: string, params?: any) => void;
}

const formatDate = (iso: string, lang: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function BlockedUsersScreen({ navigate }: Props) {
  const { theme } = useTheme();
  const { t, lang } = useLanguage();
  const styles = createStyles(theme);
  const { blockedIds } = useBlockedIds();
  const [rows, setRows] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Her engel değişikliğinde (bu ekranda ya da başka bir ekranda) liste sunucudan yeniden okunur.
  useEffect(() => {
    let active = true;
    void (async () => {
      const outcome = await fetchMyBlockedUsers(discoveryRpcClient);
      if (!active) return;
      if (outcome.ok) {
        setRows(outcome.rows);
        setFailed(false);
      } else {
        setFailed(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [blockedIds, reloadKey]);

  const confirmUnblock = async (userId: string) => {
    setBusyId(userId);
    const outcome = await unblockUser(supabase, userId);
    setBusyId(null);
    if (outcome.status === 'done') setToast({ message: t('block_unblockDone'), type: 'success' });
    else setToast({ message: t('block_unblockFailed'), type: 'error' });
  };

  const askUnblock = (userId: string) => {
    Alert.alert(t('block_unblockPrimary'), t('block_unblockConfirm'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('block_unblockPrimary'), onPress: () => void confirmUnblock(userId) },
    ]);
  };

  const shown = visibleBlockedRows(rows, blockedIds);

  const retry = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={() => navigate('settings')}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('blockedUsers_title')}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
      ) : failed && shown.length === 0 ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t('blockedUsers_loadFailed')}</Text>
          <HapticTouchable style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryText}>{t('blockedUsers_retry')}</Text>
          </HapticTouchable>
        </View>
      ) : shown.length === 0 ? (
        <EmptyState icon="ban-outline" title={t('blockedUsers_empty')} subtitle="" />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {shown.map((row) => {
            const busy = busyId === row.user_id;
            return (
              <View key={row.user_id} style={styles.card}>
                <HapticTouchable
                  style={styles.rowTop}
                  onPress={() => {
                    const route = blockedRowRoute(row);
                    navigate(route.screen, route.params);
                  }}
                >
                  <View style={styles.avatar}>
                    {row.avatar_url ? (
                      <Image source={{ uri: row.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person-outline" size={22} color={theme.textSecondary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {row.full_name ?? t('common_defaultUser')}
                    </Text>
                    {row.team_name ? (
                      <Text style={styles.meta} numberOfLines={1}>{row.team_name}</Text>
                    ) : null}
                    <Text style={styles.meta}>
                      {t('blockedUsers_blockedOn').replace('{date}', formatDate(row.blocked_at, lang))}
                    </Text>
                  </View>
                </HapticTouchable>
                <HapticTouchable
                  style={[styles.unblockBtn, busy && { opacity: 0.6 }]}
                  onPress={() => askUnblock(row.user_id)}
                  disabled={busy}
                  accessibilityLabel={t('block_unblockPrimary')}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={Paper.ink} />
                  ) : (
                    <Text style={styles.unblockText}>{t('block_unblockPrimary')}</Text>
                  )}
                </HapticTouchable>
              </View>
            );
          })}
        </ScrollView>
      )}

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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: FontFamily.display, fontSize: 16, color: theme.text, letterSpacing: 0.5 },
    list: { paddingHorizontal: 20, paddingBottom: 80, gap: 12 },
    card: {
      padding: 14,
      gap: 12,
      borderRadius: RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: 46, height: 46 },
    name: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.text },
    meta: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, marginTop: 2 },
    unblockBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: RADIUS,
      backgroundColor: theme.gold,
    },
    unblockText: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: Paper.ink },
    errorBox: { alignItems: 'center', gap: 12, marginTop: 48, paddingHorizontal: 32 },
    errorText: { fontFamily: FontFamily.body, fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
    retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: RADIUS, borderWidth: 1, borderColor: theme.gold },
    retryText: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.gold },
  });
