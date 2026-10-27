import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Navbar'ın alt safe-area dışındaki yüksekliği; Sahadan giriş çubuğu bunu boşluk olarak kullanır.
export const NAV_BAR_HEIGHT = 64;

export type TabName =
  | 'home'
  | 'activities'
  | 'footbally'
  | 'messages'
  | 'profile'
  | 'tribun'
  | 'findPlayer'
  | 'findOpponent'
  | 'teamSquad'
  | 'teamProfile'
  | 'teamHome';

interface Props {
  active: TabName | null;
  onPress: (tab: TabName) => void;
  userType?: 'player' | 'team' | 'venue';
}

// Sahadan sekmesi, Mesajlar'daki Sahadan bölümünün ile aynı ekrana ('tribun') gider;
// ayrı bir sosyal akış ekranı açmaz.
// Merkez logo, sol ve sağ yarılar eşit genişlikte olduğu için tam ortada durur;
// 5 sekmede 3 sol + merkez + 2 sağ düzeni kullanılır (bkz. render'daki sideGroup'lar).
const PLAYER_ITEMS: { tab: TabName; icon: IoniconName; label: string }[] = [
  { tab: 'home', icon: 'home-outline', label: 'Ana Sayfa' },
  { tab: 'activities', icon: 'flag-outline', label: 'Aktiviteler' },
  { tab: 'tribun', icon: 'megaphone-outline', label: 'Sahadan' },
  { tab: 'messages', icon: 'chatbubble-outline', label: 'Mesajlar' },
  { tab: 'profile', icon: 'person-outline', label: 'Profil' },
];

const TEAM_ITEMS: { tab: TabName; icon: IoniconName; label: string }[] = [
  { tab: 'teamHome', icon: 'home-outline', label: 'Ana Sayfa' },
  { tab: 'findPlayer', icon: 'search-outline', label: 'Oyuncu Bul' },
  { tab: 'tribun', icon: 'megaphone-outline', label: 'Sahadan' },
  { tab: 'teamSquad', icon: 'list-outline', label: 'Kadro' },
  { tab: 'teamProfile', icon: 'business-outline', label: 'Takım' },
];

const PLAYER_TABS: TabName[] = ['home', 'activities', 'tribun', 'footbally', 'messages', 'profile'];
const TEAM_TABS: TabName[] = ['teamHome', 'findPlayer', 'tribun', 'findOpponent', 'teamSquad', 'teamProfile'];

export default function BottomNav({ active, onPress, userType = 'player' }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const isTeam = userType === 'team';
  const PLAYER_LABELS: Record<string, string> = {
    home: t('home'),
    activities: t('activities'),
    tribun: t('nav_sahadan'),
    messages: t('messages'),
    profile: t('profile'),
  };
  const TEAM_LABELS: Record<string, string> = {
    teamHome: t('nav_teamHome'),
    findPlayer: t('nav_findPlayer'),
    tribun: t('nav_sahadan'),
    teamSquad: t('nav_teamSquad'),
    teamProfile: t('nav_teamProfile'),
  };
  const items = (isTeam ? TEAM_ITEMS : PLAYER_ITEMS).map((item) => ({
    ...item,
    label: (isTeam ? TEAM_LABELS[item.tab] : PLAYER_LABELS[item.tab]) ?? item.label,
  }));
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

  const renderItem = (item: { tab: TabName; icon: IoniconName; label: string }) => (
    <TouchableOpacity key={item.tab} style={styles.item} activeOpacity={0.7} onPress={() => handlePress(item.tab)}>
      <Animated.View style={[styles.itemContent, { transform: [{ scale: scales[item.tab] }] }]}>
        <View style={styles.dotSlot}>
          {active === item.tab && <View style={styles.activeDot} />}
        </View>
        <View style={styles.iconWrap}>
          <Ionicons
            name={item.icon}
            size={active === item.tab ? 24 : 21}
            color={active === item.tab ? theme.gold : theme.textSecondary}
          />
          {!isTeam && item.tab === 'messages' && unreadMessages > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.label, active === item.tab && styles.labelActive]}>{item.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { height: NAV_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom + 4 }]}>
      <View style={styles.sideGroup}>
        {items.slice(0, 3).map((item) => renderItem(item))}
      </View>

      <View style={styles.centerSlot}>
        <TouchableOpacity style={styles.centerBtn} activeOpacity={0.7} onPress={() => handlePress(centerTab)}>
          <Animated.View style={{ transform: [{ scale: scales[centerTab] }] }}>
            {isTeam ? (
              <Ionicons name="shield-outline" size={32} color={theme.gold} />
            ) : (
              <Image
                source={require('../assets/logo-icon.png')}
                style={{ width: 68, height: 68, resizeMode: 'contain' }}
              />
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>

      <View style={styles.sideGroup}>
        {items.slice(3).map((item) => renderItem(item))}
      </View>
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
      borderTopColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 16,
      paddingHorizontal: 8,
    },
    // Sol ve sağ yarılar eşit genişlikte (flex: 1); ortadaki sabit 76px slot
    // ekranın tam ortasına oturur. Yarılar içindeki sekmeler kendi aralarında paylaşılır.
    sideGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    centerSlot: {
      width: 76,
      alignItems: 'center',
      justifyContent: 'center',
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
    iconWrap: { position: 'relative' },
    badge: {
      position: 'absolute',
      top: -4, right: -10,
      minWidth: 16, height: 16,
      borderRadius: CARD_RADIUS - 3,
      paddingHorizontal: 3,
      backgroundColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontFamily: FontFamily.monoMedium, fontSize: 9, color: '#fff' },
    label: {
      fontFamily: FontFamily.body,
      fontSize: 11,
      color: theme.textMuted,
    },
    // Seçili sekme: zümrüt vurgu; küçük metin olduğu için koyu ton (4.5:1 üzeri).
    labelActive: {
      fontFamily: FontFamily.bodySemiBold,
      color: theme.goldDark,
    },
    centerBtn: {
      width: 76,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
