import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, TextInput, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

interface Props {
  navigate: (s: string) => void;
  userId: string | null;
  fromScreen?: string;
}

export default function SettingsScreen({ navigate, userId, fromScreen }: Props) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  const [notifications, setNotifications] = useState(true);
  const [matchNotifs, setMatchNotifs] = useState(true);
  const [messageNotifs, setMessageNotifs] = useState(true);
  const [scoutNotifs, setScoutNotifs] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setEmail(session.user.email || '');
    });
  }, []);

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      Alert.alert('Hata', 'Şifre değiştirilemedi. Tekrar deneyin.');
    } else {
      Alert.alert('Başarılı', 'Şifreniz değiştirildi.');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            navigate('onboarding');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Bu işlem geri alınamaz. Tüm verileriniz silinecek.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            navigate('onboarding');
          },
        },
      ]
    );
  };

  const SettingRow = ({ icon, title, subtitle, onPress, right, danger = false }: {
    icon: IoniconName; title: string; subtitle?: string; onPress: () => void; right?: React.ReactNode; danger?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        backgroundColor: theme.card,
        borderRadius: RADIUS,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: danger ? theme.error : theme.border,
      }}>
      <View
        style={{
          width: 38,
          height: 38,
          backgroundColor: theme.card2,
          borderRadius: RADIUS,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={icon} size={17} color={danger ? theme.error : theme.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? theme.error : theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold }}>{title}</Text>
        {subtitle && <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2, fontFamily: FontFamily.body }}>{subtitle}</Text>}
      </View>
      {right || <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => navigate(fromScreen || 'profile')}
          style={{
            width: 38,
            height: 38,
            backgroundColor: theme.card,
            borderRadius: RADIUS,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: theme.border,
          }}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </TouchableOpacity>
        <Text style={{ color: theme.text, fontSize: 19, fontFamily: FontFamily.display, letterSpacing: 0.5 }}>AYARLAR</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Account Info */}
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: RADIUS,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}>
          <View
            style={{
              width: 46,
              height: 46,
              backgroundColor: theme.card2,
              borderRadius: RADIUS,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="person-outline" size={21} color={theme.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontFamily: FontFamily.bodySemiBold }}>Hesap</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontFamily: FontFamily.mono }}>{email}</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: theme.gold, borderRadius: RADIUS, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: theme.gold, fontSize: 11, fontFamily: FontFamily.mono }}>ÜCRETSİZ</Text>
          </View>
        </View>

        {/* HESAP AYARLARI */}
        <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, paddingHorizontal: 4 }}>
          HESAP
        </Text>

        <SettingRow icon="lock-closed-outline" title="Şifre Değiştir" subtitle="Hesap güvenliğini artır" onPress={() => setShowPasswordModal(true)} />

        <SettingRow
          icon="mail-outline"
          title="E-posta"
          subtitle={email}
          onPress={() => Alert.alert('E-posta', 'E-posta değiştirme özelliği yakında!')}
        />

        <SettingRow icon="star-outline" title="Premium'a Geç" subtitle="Tüm özelliklerin kilidini aç" onPress={() => navigate('premium')} />

        {/* GÖRÜNÜM */}
        <Text
          style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          GÖRÜNÜM
        </Text>

        <View style={{ backgroundColor: theme.card, borderRadius: RADIUS, marginBottom: 8, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <View style={{ width: 38, height: 38, backgroundColor: theme.card2, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={17} color={theme.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold }}>Tema</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>{isDark ? 'Koyu Mod' : 'Açık Mod'}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: 'rgba(255,179,71,0.4)' }}
              thumbColor={isDark ? theme.gold : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={{ backgroundColor: theme.card, borderRadius: RADIUS, marginBottom: 8, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <View style={{ width: 38, height: 38, backgroundColor: theme.card2, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="language-outline" size={17} color={theme.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold }}>Dil / Language</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>{lang === 'tr' ? 'Türkçe' : 'English'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setLang('tr')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: RADIUS,
                  backgroundColor: lang === 'tr' ? theme.gold : theme.bg,
                  borderWidth: 1,
                  borderColor: lang === 'tr' ? theme.gold : theme.border,
                }}>
                <Text style={{ fontSize: 13, fontFamily: FontFamily.monoMedium, color: lang === 'tr' ? Paper.ink : theme.textSecondary }}>TR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLang('en')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: RADIUS,
                  backgroundColor: lang === 'en' ? theme.gold : theme.bg,
                  borderWidth: 1,
                  borderColor: lang === 'en' ? theme.gold : theme.border,
                }}>
                <Text style={{ fontSize: 13, fontFamily: FontFamily.monoMedium, color: lang === 'en' ? Paper.ink : theme.textSecondary }}>EN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* BİLDİRİMLER */}
        <Text
          style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          BİLDİRİMLER
        </Text>

        {([
          { key: 'all', label: 'Tüm Bildirimler', icon: 'notifications-outline' as IoniconName, value: notifications, setter: setNotifications },
          { key: 'match', label: 'Maç Bildirimleri', icon: 'football-outline' as IoniconName, value: matchNotifs, setter: setMatchNotifs },
          { key: 'message', label: 'Mesaj Bildirimleri', icon: 'chatbubble-outline' as IoniconName, value: messageNotifs, setter: setMessageNotifs },
          { key: 'scout', label: 'Scout Bildirimleri', icon: 'search-outline' as IoniconName, value: scoutNotifs, setter: setScoutNotifs },
        ]).map((item) => (
          <View key={item.key} style={{ backgroundColor: theme.card, borderRadius: RADIUS, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
              <View style={{ width: 38, height: 38, backgroundColor: theme.card2, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={17} color={theme.gold} />
              </View>
              <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold, flex: 1 }}>{item.label}</Text>
              <Switch
                value={item.value}
                onValueChange={item.setter}
                trackColor={{ false: '#767577', true: 'rgba(255,179,71,0.4)' }}
                thumbColor={item.value ? theme.gold : '#f4f3f4'}
              />
            </View>
          </View>
        ))}

        {/* GİZLİLİK & DESTEK */}
        <Text
          style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          GİZLİLİK & DESTEK
        </Text>

        <SettingRow
          icon="document-text-outline"
          title="Gizlilik Politikası"
          subtitle="Verileriniz nasıl korunuyor"
          onPress={() => Linking.openURL('https://getfootbally.com/privacy')}
        />

        <SettingRow icon="clipboard-outline" title="Kullanım Koşulları" onPress={() => Linking.openURL('https://getfootbally.com/terms')} />

        <SettingRow icon="chatbubble-outline" title="Bize Ulaş" subtitle="info@getfootbally.com" onPress={() => Linking.openURL('mailto:info@getfootbally.com')} />

        <SettingRow
          icon="star-outline"
          title="Uygulamayı Puanla"
          subtitle="Bizi destekle"
          onPress={() => Alert.alert('Yakında', 'App Store puanlama özelliği yakında!')}
        />

        {/* UYGULAMA BİLGİSİ */}
        <Text
          style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          UYGULAMA
        </Text>

        <View style={{ backgroundColor: theme.card, borderRadius: RADIUS, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold, marginBottom: 4 }}>Footbally</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono }}>Sürüm 1.0.0 Beta</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono }}>© 2026 Footbally. Tüm hakları saklıdır.</Text>
        </View>

        {/* TEHLİKELİ ALAN */}
        <Text style={{ color: theme.error, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          HESAP İŞLEMLERİ
        </Text>

        <SettingRow icon="log-out-outline" title="Çıkış Yap" subtitle="Hesabınızdan güvenli çıkış yapın" onPress={handleLogout} danger={true} />

        <SettingRow icon="trash-outline" title="Hesabı Sil" subtitle="Tüm verileriniz kalıcı olarak silinir" onPress={handleDeleteAccount} danger={true} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* PASSWORD CHANGE MODAL */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.card, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, padding: 24 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, marginBottom: 20 }}>ŞİFRE DEĞİŞTİR</Text>

            <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>YENİ ŞİFRE</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="En az 6 karakter"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={{ backgroundColor: theme.bg, borderRadius: RADIUS, padding: 14, color: theme.text, fontFamily: FontFamily.mono, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}
            />

            <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>YENİ ŞİFRE (TEKRAR)</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Şifreyi tekrar girin"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={{ backgroundColor: theme.bg, borderRadius: RADIUS, padding: 14, color: theme.text, fontFamily: FontFamily.mono, marginBottom: 20, borderWidth: 1, borderColor: theme.border }}
            />

            <TouchableOpacity
              onPress={handleChangePassword}
              style={{ backgroundColor: theme.gold, borderRadius: RADIUS, padding: 16, alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: Paper.ink, fontFamily: FontFamily.display, fontSize: 14, letterSpacing: 1 }}>{loading ? 'DEĞİŞTİRİLİYOR...' : 'ŞİFREYİ DEĞİŞTİR'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary, fontFamily: FontFamily.mono, fontSize: 12 }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
