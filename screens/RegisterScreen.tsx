import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;

const ERROR_MESSAGES: Record<string, string> = {
  'User already registered': 'Bu email zaten kayıtlı',
  'Password should be at least 6 characters': 'Şifre en az 6 karakter olmalı',
  'Unable to validate email address: invalid format': 'Geçersiz email adresi',
};

const translateError = (message: string) => ERROR_MESSAGES[message] ?? message;

const POSITIONS = ['Kaleci', 'Defans', 'Orta Saha', 'Forvet'];

interface Props {
  onLogin: (userType: 'player' | 'team') => void;
  onBack: () => void;
}

export default function RegisterScreen({ onLogin, onBack }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [userType, setUserType] = useState<'player' | 'team'>('player');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [position, setPosition] = useState('');
  const [positionModalVisible, setPositionModalVisible] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword || !position) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı');
      return;
    }
    if (!privacyAccepted) {
      Alert.alert('Hata', "Devam etmek için Gizlilik Politikası ve KVKK Aydınlatma Metni'ni kabul etmelisin");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          position,
          kvkk_accepted_at: new Date().toISOString(),
        },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Kayıt Hatası', translateError(error.message));
      return;
    }

    if (!data.session) {
      Alert.alert(
        'E-postanı Onayla',
        'Hesabını aktifleştirmek için e-posta adresine gönderilen bağlantıya tıkla, ardından giriş yap.'
      );
      onBack();
      return;
    }

    onLogin(userType);
  };

  const todayLabel = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.topStrip}>
            <HapticTouchable style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backIcon}>←</Text>
            </HapticTouchable>
            <Text style={styles.topStripText}>{todayLabel}</Text>
          </View>

          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <View style={styles.crestRow}>
                <Image source={require('../assets/logo-icon-square.png')} style={styles.crest} />
                <Text style={styles.cardBrand}>FOOTBALLY</Text>
              </View>
              <Text style={styles.cardLabel}>YENİ OYUNCU KAYDI · BAŞVURU</Text>

              <View style={styles.roleRow}>
                <HapticTouchable
                  onPress={() => setUserType('player')}
                  style={[styles.roleTab, userType === 'player' && styles.roleTabActive]}
                >
                  <Text style={[styles.roleTitle, userType === 'player' && styles.roleTitleActive]}>Oyuncuyum</Text>
                  <Text style={[styles.roleSub, userType === 'player' && styles.roleSubActive]}>Kariyer yönetimi</Text>
                </HapticTouchable>
                <HapticTouchable
                  onPress={() => setUserType('team')}
                  style={[styles.roleTab, userType === 'team' && styles.roleTabActive]}
                >
                  <Text style={[styles.roleTitle, userType === 'team' && styles.roleTitleActive]}>Takımım Var</Text>
                  <Text style={[styles.roleSub, userType === 'team' && styles.roleSubActive]}>Oyuncu &amp; rakip bul</Text>
                </HapticTouchable>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>AD SOYAD</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Adınız Soyadınız"
                  placeholderTextColor={Paper.muted}
                  autoCapitalize="words"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-POSTA</Text>
                <TextInput
                  style={styles.input}
                  placeholder="scout@footbally.app"
                  placeholderTextColor={Paper.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ŞİFRE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Paper.muted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ŞİFRE TEKRAR</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Paper.muted}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>POZİSYON</Text>
                <HapticTouchable style={styles.input} onPress={() => setPositionModalVisible(true)}>
                  <Text style={position ? styles.selectValue : styles.selectPlaceholder}>
                    {position || 'Pozisyon seçin'}
                  </Text>
                </HapticTouchable>
              </View>

              <HapticTouchable
                style={styles.privacyRow}
                onPress={() => setPrivacyAccepted((v) => !v)}
              >
                <View style={[styles.privacyBox, privacyAccepted && styles.privacyBoxActive]}>
                  {privacyAccepted && <Text style={styles.privacyCheck}>×</Text>}
                </View>
                <Text style={styles.privacyText}>
                  <Text
                    style={styles.privacyLink}
                    onPress={() => Linking.openURL('https://getfootbally.com/privacy')}
                  >
                    Gizlilik Politikası
                  </Text>
                  {' '}ve{' '}
                  <Text
                    style={styles.privacyLink}
                    onPress={() => Linking.openURL('https://getfootbally.com/terms')}
                  >
                    KVKK Aydınlatma Metni
                  </Text>
                  {"'ni okudum, kabul ediyorum"}
                </Text>
              </HapticTouchable>

              <HapticTouchable
                style={[styles.btnGold, loading && styles.btnGoldDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Paper.ink} />
                ) : (
                  <Text style={styles.btnGoldText}>Kayıt Ol</Text>
                )}
              </HapticTouchable>
            </View>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Zaten hesabın var mı? </Text>
            <HapticTouchable onPress={onBack} disabled={loading}>
              <Text style={styles.loginLink}>Giriş Yap</Text>
            </HapticTouchable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={positionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPositionModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setPositionModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pozisyon Seç</Text>
            {POSITIONS.map((p) => (
              <HapticTouchable
                key={p}
                style={styles.optionRow}
                onPress={() => {
                  setPosition(p);
                  setPositionModalVisible(false);
                }}
              >
                <Text style={[styles.optionText, p === position && styles.optionTextActive]}>
                  {p}
                </Text>
                {p === position && <Text style={styles.optionCheck}>✓</Text>}
              </HapticTouchable>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    container: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
    },
    topStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 22,
    },
    backBtn: {
      width: 36,
      height: 36,
      backgroundColor: theme.card,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 16, color: theme.text },
    topStripText: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 1,
    },
    cardWrap: {
      paddingHorizontal: 24,
    },
    card: {
      backgroundColor: Paper.bg,
      borderRadius: RADIUS,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.border,
    },
    crestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    crest: {
      width: 32,
      height: 32,
      borderRadius: RADIUS,
      resizeMode: 'contain',
    },
    cardBrand: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      letterSpacing: 2,
      color: Paper.ink,
    },
    cardLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      letterSpacing: 1,
      color: Paper.muted,
      paddingBottom: 14,
      marginBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: Paper.line,
    },
    roleRow: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    roleTab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: Paper.line,
    },
    roleTabActive: {
      backgroundColor: theme.gold,
      borderColor: theme.gold,
    },
    roleTitle: {
      fontFamily: FontFamily.display,
      fontSize: 14,
      letterSpacing: 1,
      color: Paper.ink,
    },
    roleTitleActive: {
      color: Paper.ink,
    },
    roleSub: {
      fontFamily: FontFamily.mono,
      fontSize: 10,
      color: Paper.muted,
      marginTop: 2,
    },
    roleSubActive: {
      color: Paper.ink,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 10,
      color: Paper.muted,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      height: 48,
      backgroundColor: '#FFFFFF',
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      color: Paper.ink,
      fontFamily: FontFamily.mono,
      fontSize: 14,
      borderWidth: 1,
      borderColor: Paper.line,
      justifyContent: 'center',
    },
    selectValue: {
      fontFamily: FontFamily.mono,
      fontSize: 14,
      color: Paper.ink,
    },
    selectPlaceholder: {
      fontFamily: FontFamily.mono,
      fontSize: 14,
      color: Paper.muted,
    },
    privacyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 18,
    },
    privacyBox: {
      width: 18,
      height: 18,
      borderRadius: RADIUS - 3,
      borderWidth: 1,
      borderColor: Paper.line,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    privacyBoxActive: {
      backgroundColor: theme.gold,
      borderColor: theme.gold,
    },
    privacyCheck: {
      fontSize: 13,
      color: Paper.ink,
      lineHeight: 14,
    },
    privacyText: {
      flex: 1,
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: Paper.muted,
      lineHeight: 18,
    },
    privacyLink: {
      color: theme.goldDark,
    },
    btnGold: {
      height: 52,
      backgroundColor: theme.gold,
      borderRadius: RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    btnGoldDisabled: {
      opacity: 0.6,
    },
    btnGoldText: {
      fontFamily: FontFamily.display,
      fontSize: 15,
      color: Paper.ink,
      letterSpacing: 1,
    },
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 22,
      marginBottom: 30,
    },
    loginText: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: theme.textSecondary,
    },
    loginLink: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: theme.gold,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      padding: 24,
      paddingBottom: 36,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, marginBottom: 16, letterSpacing: 0.5 },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    optionText: { fontFamily: FontFamily.mono, fontSize: 14, color: theme.textMuted },
    optionTextActive: { color: theme.gold },
    optionCheck: { fontSize: 16, color: theme.gold, fontWeight: '700' },
  });
