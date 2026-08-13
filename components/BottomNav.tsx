import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { hexToRgba, Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';

export type TabName =
  | 'home'
  | 'activities'
  | 'footbally'
  | 'messages'
  | 'profile'
  | 'findPlayer'
  | 'findOpponent'
  | 'teamSquad'
  | 'teamProfile'
  | 'teamHome';

interface Props {
  active: TabName;
  onPress: (tab: TabName) => void;
  userType?: 'player' | 'team';
}

const PLAYER_ITEMS: { tab: TabName; icon: string; label: string }[] = [
  { tab: 'home', icon: '🏠', label: 'Ana Sayfa' },
  { tab: 'activities', icon: '⚡', label: 'Aktiviteler' },
  { tab: 'messages', icon: '💬', label: 'Mesajlar' },
  { tab: 'profile', icon: '👤', label: 'Profil' },
];

const TEAM_ITEMS: { tab: TabName; icon: string; label: string }[] = [
  { tab: 'teamHome', icon: '🏠', label: 'Ana Sayfa' },
  { tab: 'findPlayer', icon: '🔍', label: 'Oyuncu Bul' },
  { tab: 'teamSquad', icon: '📋', label: 'Kadro' },
  { tab: 'teamProfile', icon: '🏟️', label: 'Takım' },
];

const PLAYER_TABS: TabName[] = ['home', 'activities', 'footbally', 'messages', 'profile'];
const TEAM_TABS: TabName[] = ['teamHome', 'findPlayer', 'findOpponent', 'teamSquad', 'teamProfile'];

export default function BottomNav({ active, onPress, userType = 'player' }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const isTeam = userType === 'team';
  const PLAYER_LABELS: Record<string, string> = {
    home: t('home'),
    activities: t('activities'),
    messages: t('messages'),
    profile: t('profile'),
  };
  const items = (isTeam ? TEAM_ITEMS : PLAYER_ITEMS).map((item) =>
    isTeam ? item : { ...item, label: PLAYER_LABELS[item.tab] ?? item.label }
  );
  const centerTab: TabName = isTeam ? 'findOpponent' : 'footbally';
  const allTabs = isTeam ? TEAM_TABS : PLAYER_TABS;
  const scales = useRef(
    allTabs.reduce((acc, tab) => {
      acc[tab] = new Animated.Value(1);
      return acc;
    }, {} as Record<TabName, Animated.Value>)
  ).current;

  useEffect(() => {
    if (isTeam) return;
    loadUnreadMessages();
  }, [active, isTeam]);

  const loadUnreadMessages = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('receiver_id', user.id)
      .eq('read', false);
    setUnreadMessages(count ?? 0);
  };

  const handlePress = (tab: TabName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const scale = scales[tab];
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
    onPress(tab);
  };

  return (
    <View style={styles.container}>
      {items.slice(0, 2).map((item) => (
        <TouchableOpacity key={item.tab} style={styles.item} activeOpacity={0.7} onPress={() => handlePress(item.tab)}>
          <Animated.View style={[styles.itemContent, { transform: [{ scale: scales[item.tab] }] }]}>
            <View style={styles.dotSlot}>
              {active === item.tab && <View style={styles.activeDot} />}
            </View>
            <View style={styles.iconWrap}>
              <Text style={[styles.icon, active === item.tab && styles.iconActive]}>{item.icon}</Text>
              {!isTeam && item.tab === 'messages' && unreadMessages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, active === item.tab && styles.labelActive]}>{item.label}</Text>
          </Animated.View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.centerBtn} activeOpacity={0.7} onPress={() => handlePress(centerTab)}>
        <Animated.View style={{ transform: [{ scale: scales[centerTab] }] }}>
          {isTeam ? (
            <Text style={styles.centerBtnIcon}>⚔️</Text>
          ) : (
            <Image
              source={require('../assets/logo-icon.png')}
              style={{ width: 36, height: 36, resizeMode: 'contain' }}
            />
          )}
        </Animated.View>
      </TouchableOpacity>

      {items.slice(2).map((item) => (
        <TouchableOpacity key={item.tab} style={styles.item} activeOpacity={0.7} onPress={() => handlePress(item.tab)}>
          <Animated.View style={[styles.itemContent, { transform: [{ scale: scales[item.tab] }] }]}>
            <View style={styles.dotSlot}>
              {active === item.tab && <View style={styles.activeDot} />}
            </View>
            <View style={styles.iconWrap}>
              <Text style={[styles.icon, active === item.tab && styles.iconActive]}>{item.icon}</Text>
              {!isTeam && item.tab === 'messages' && unreadMessages > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, active === item.tab && styles.labelActive]}>{item.label}</Text>
          </Animated.View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 80,
      backgroundColor: theme.tabBar,
      borderTopWidth: 1,
      borderTopColor: hexToRgba(theme.gold, 0.15),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingBottom: 16,
      paddingHorizontal: 8,
    },
    item: {
      flex: 1,
      alignItems: 'center',
    },
    itemContent: {
      alignItems: 'center',
      gap: 4,
    },
    dotSlot: {
      height: 6,
      justifyContent: 'center',
    },
    activeDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.gold,
    },
    icon: { fontSize: 22 },
    iconActive: { fontSize: 26 },
    iconWrap: { position: 'relative' },
    badge: {
      position: 'absolute',
      top: -4, right: -10,
      minWidth: 16, height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
    label: {
      fontSize: 10,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    labelActive: {
      color: theme.gold,
      fontWeight: '700',
    },
    centerBtn: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
      alignSelf: 'center',
      shadowColor: theme.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    centerBtnIcon: { fontSize: 26 },
  });
