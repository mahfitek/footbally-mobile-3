import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { FontFamily } from '../constants/fonts';

// Çevrimdışı durumu üst kenarda gösterir. Bağlantı durumu henüz bilinmiyorsa (null) hiçbir şey göstermez;
// yalnızca kesin olarak bağlantı yokken görünür. Ekranların veri istekleri kendi hata durumlarını gösterir.
export default function OfflineBanner() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false);
    });
    return unsubscribe;
  }, []);

  if (!offline) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.wrap, { top: insets.top, backgroundColor: theme.card2, borderColor: theme.border }]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={theme.error} />
      <Text style={[styles.text, { color: theme.text }]}>{t('offline_banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  text: { flex: 1, fontFamily: FontFamily.bodySemiBold, fontSize: 13 },
});
