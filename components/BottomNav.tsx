import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
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

// Sekme anahtarı = ekran adı. App.tsx aktif sekmeyi `screen` değerinden okur, bu yüzden eşleşmeleri korunmalı.
export type TabName =
  | 'home'
  | 'match'
  | 'search'
  | 'messages'
  | 'profile'
  | 'teamHome'
  | 'findOpponent'
  | 'findPlayer'
  | 'teamProfile';

interface Props {
  active: TabName | null;
  onPress: (tab: TabName) => void;
  userType?: 'player' | 'team' | 'venue';
}

interface Item {
  tab: TabName;
  icon: IoniconName;
  labelKey: 'home' | 'nav_matches' | 'nav_discover' | 'messages' | 'profile' | 'nav_team';
}

// Beş sekme, iki kullanıcı tipi için de aynı düzen: Ana Sayfa, Maçlar, Keşfet, Mesajlar, Profil.
// Sekmeden çıkan ekranlara başka yollardan erişilir: Performans ve Fırsatlar (Ana Sayfa ızgarası),
// Sahadan (Mesajlar içinden), Oyuncu/Takım ekranları (ilgili ana sayfalardan).
const PLAYER_ITEMS: Item[] = [
  { tab: 'home', icon: 'home-outline', labelKey: 'home' },
  { tab: 'match', icon: 'football-outline', labelKey: 'nav_matches' },
  { tab: 'search', icon: 'compass-outline', labelKey: 'nav_discover' },
  { tab: 'messages', icon: 'chatbubble-outline', labelKey: 'messages' },
  { tab: 'profile', icon: 'person-outline', labelKey: 'profile' },
];

const TEAM_ITEMS: Item[] = [
  { tab: 'teamHome', icon: 'home-outline', labelKey: 'home' },
  { tab: 'findOpponent', icon: 'football-outline', labelKey: 'nav_matches' },
  { tab: 'findPlayer', icon: 'compass-outline', labelKey: 'nav_discover' },
  { tab: 'messages', icon: 'chatbubble-outline', labelKey: 'messages' },
  { tab: 'teamProfile', icon: 'shield-outline', labelKey: 'nav_team' },
];

const ALL_TABS: TabName[] = [
  'home', 'match', 'search', 'messages', 'profile', 'teamHome', 'findOpponent', 'findPlayer', 'teamProfile',
];

// Her sekmenin basma animasyonu için tek bir değer; ilk render'da bir kez oluşturulur.
function createScaleValues(): Record<TabName, Animated.Value> {
  return Object.fromEntries(ALL_TABS.map((tab) => [tab, new Animated.Value(1)])) as Record<TabName, Animated.Value>;
}

export default function BottomNav({ active, onPress, userType = 'player' }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const items = userType === 'team' ? TEAM_ITEMS : PLAYER_ITEMS;
  const [scales] = useState(createScaleValues);

  const loadUnreadMessages = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      // messages tablosunda alıcı kolonu yok; karşı tarafın gönderdiği okunmamış mesajlar sayılır.
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_user_id', user.id)
        .eq('read', false);
      setUnreadMessages(count ?? 0);
    } catch {
      // Rozet bilgisi yardımcıdır; okunamazsa sekme yine çalışır.
    }
  };

  // Sekme değişince okunmamış sayısı yenilenir; yükleme asenkrondur, setState effect'in senkron gövdesinde değildir.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUnreadMessages();
  }, [active]);

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
    <View style={[styles.container, { height: NAV_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom + 4 }]}>
      {items.map((item) => {
        const isActive = active === item.tab;
        const label = t(item.labelKey);
        return (
          <TouchableOpacity
            key={item.tab}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => handlePress(item.tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <Animated.View style={[styles.itemContent, { transform: [{ scale: scales[item.tab] }] }]}>
              <View style={styles.dotSlot}>
                {isActive && <View style={styles.activeDot} />}
              </View>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={item.icon}
                  size={isActive ? 24 : 21}
                  color={isActive ? theme.gold : theme.textSecondary}
                />
                {item.tab === 'messages' && unreadMessages > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadMessages > 9 ? '9+' : unreadMessages}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>{label}</Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}
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
      backgroundColor: theme.tabBar,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
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
    iconWrap: { position: 'relative' },
    badge: {
      position: 'absolute',
      top: -4,
      right: -10,
      minWidth: 16,
      height: 16,
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
  });
