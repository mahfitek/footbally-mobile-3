import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, TextInput, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { hexToRgba } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';

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
      Alert.alert('✅ Başarılı', 'Şifreniz değiştirildi.');
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
      '⚠️ Hesabı Sil',
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

  const SettingRow = ({ icon, title, subtitle, onPress, right, danger = false }: any) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        backgroundColor: theme.card,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: danger ? hexToRgba(theme.error, 0.2) : theme.border,
      }}>
      <View
        style={{
          width: 40,
          height: 40,
          backgroundColor: danger ? hexToRgba(theme.error, 0.1) : hexToRgba(theme.gold, 0.1),
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? theme.error : theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold }}>{title}</Text>
        {subtitle && <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2, fontFamily: FontFamily.body }}>{subtitle}</Text>}
      </View>
      {right || <Text style={{ color: theme.textSecondary }}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 }}>
        <TouchableOpacity
          onPress={() => navigate(fromScreen || 'profile')}
          style={{
            width: 40,
            height: 40,
            backgroundColor: theme.card,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: theme.border,
          }}>
          <Text style={{ color: theme.text, fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.text, fontSize: 20, fontFamily: FontFamily.display, letterSpacing: 0.5 }}>Ayarlar</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* Account Info */}
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 20,
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
              width: 50,
              height: 50,
              backgroundColor: 'rgba(255,179,71,0.1)',
              borderRadius: 25,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 24 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontFamily: FontFamily.bodySemiBold }}>Hesap</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontFamily: FontFamily.body }}>{email}</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,179,71,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: theme.gold, fontSize: 11, fontFamily: FontFamily.mono }}>Ücretsiz</Text>
          </View>
        </View>

        {/* HESAP AYARLARI */}
        <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, paddingHorizontal: 4 }}>
          HESAP
        </Text>

        <SettingRow icon="🔒" title="Şifre Değiştir" subtitle="Hesap güvenliğini artır" onPress={() => setShowPasswordModal(true)} />

        <SettingRow
          icon="📧"
          title="E-posta"
          subtitle={email}
          onPress={() => Alert.alert('E-posta', 'E-posta değiştirme özelliği yakında!')}
        />

        <SettingRow icon="⭐" title="Premium'a Geç" subtitle="Tüm özelliklerin kilidini aç" onPress={() => navigate('premium')} />

        {/* GÖRÜNÜM */}
        <Text
          style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          GÖRÜNÜM
        </Text>

        <View style={{ backgroundColor: theme.card, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <View style={{ width: 40, height: 40, backgroundColor: 'rgba(255,179,71,0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{isDark ? '🌙' : '☀️'}</Text>
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

        <View style={{ backgroundColor: theme.card, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <View style={{ width: 40, height: 40, backgroundColor: 'rgba(255,179,71,0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>🌐</Text>
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
                  borderRadius: 10,
                  backgroundColor: lang === 'tr' ? theme.gold : theme.bg,
                  borderWidth: 1,
                  borderColor: lang === 'tr' ? theme.gold : theme.border,
                }}>
                <Text style={{ fontSize: 13, fontFamily: FontFamily.bodySemiBold, color: lang === 'tr' ? '#000' : theme.textSecondary }}>TR 🇹🇷</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLang('en')}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: lang === 'en' ? theme.gold : theme.bg,
                  borderWidth: 1,
                  borderColor: lang === 'en' ? theme.gold : theme.border,
                }}>
                <Text style={{ fontSize: 13, fontFamily: FontFamily.bodySemiBold, color: lang === 'en' ? '#000' : theme.textSecondary }}>EN 🇬🇧</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* BİLDİRİMLER */}
        <Text
          style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          BİLDİRİMLER
        </Text>

        {[
          { key: 'all', label: 'Tüm Bildirimler', icon: '🔔', value: notifications, setter: setNotifications },
          { key: 'match', label: 'Maç Bildirimleri', icon: '⚽', value: matchNotifs, setter: setMatchNotifs },
          { key: 'message', label: 'Mesaj Bildirimleri', icon: '💬', value: messageNotifs, setter: setMessageNotifs },
          { key: 'scout', label: 'Scout Bildirimleri', icon: '🔍', value: scoutNotifs, setter: setScoutNotifs },
        ].map((item) => (
          <View key={item.key} style={{ backgroundColor: theme.card, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
              <View style={{ width: 40, height: 40, backgroundColor: 'rgba(255,179,71,0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>{item.icon}</Text>
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
          icon="📄"
          title="Gizlilik Politikası"
          subtitle="Verileriniz nasıl korunuyor"
          onPress={() => Linking.openURL('https://getfootbally.com/privacy')}
        />

        <SettingRow icon="📋" title="Kullanım Koşulları" onPress={() => Linking.openURL('https://getfootbally.com/terms')} />

        <SettingRow icon="💬" title="Bize Ulaş" subtitle="info@getfootbally.com" onPress={() => Linking.openURL('mailto:info@getfootbally.com')} />

        <SettingRow
          icon="⭐"
          title="Uygulamayı Puanla"
          subtitle="Bizi destekle"
          onPress={() => Alert.alert('Yakında', 'App Store puanlama özelliği yakında!')}
        />

        {/* UYGULAMA BİLGİSİ */}
        <Text
          style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          UYGULAMA
        </Text>

        <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold, marginBottom: 4 }}>Footbally</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>Sürüm 1.0.0 Beta</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>© 2025 Footbally. Tüm hakları saklıdır.</Text>
        </View>

        {/* TEHLİKELİ ALAN */}
        <Text style={{ color: theme.error, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          HESAP İŞLEMLERİ
        </Text>

        <SettingRow icon="🚪" title="Çıkış Yap" subtitle="Hesabınızdan güvenli çıkış yapın" onPress={handleLogout} danger={true} />

        <SettingRow icon="🗑️" title="Hesabı Sil" subtitle="Tüm verileriniz kalıcı olarak silinir" onPress={handleDeleteAccount} danger={true} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* PASSWORD CHANGE MODAL */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, marginBottom: 20 }}>Şifre Değiştir</Text>

            <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>YENİ ŞİFRE</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="En az 6 karakter"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={{ backgroundColor: theme.bg, borderRadius: 14, padding: 14, color: theme.text, fontFamily: FontFamily.body, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}
            />

            <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>YENİ ŞİFRE (TEKRAR)</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Şifreyi tekrar girin"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={{ backgroundColor: theme.bg, borderRadius: 14, padding: 14, color: theme.text, fontFamily: FontFamily.body, marginBottom: 20, borderWidth: 1, borderColor: theme.border }}
            />

            <TouchableOpacity
              onPress={handleChangePassword}
              style={{ backgroundColor: theme.gold, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: '#000', fontFamily: FontFamily.bodySemiBold, fontSize: 15 }}>{loading ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={{ padding: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary, fontFamily: FontFamily.body }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
