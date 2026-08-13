import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import HapticTouchable from '../components/HapticTouchable';

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

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          position,
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.header}>
            <HapticTouchable style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backIcon}>←</Text>
            </HapticTouchable>
          </View>

          <View style={styles.logoWrap}>
            <Text style={styles.logo}>FOOTBALLY</Text>
            <Text style={styles.logoSub}>HESAP OLUŞTUR</Text>
          </View>

          <View style={styles.form}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <HapticTouchable
                onPress={() => setUserType('player')}
                style={{
                  flex: 1, padding: 16, borderRadius: 16, alignItems: 'center',
                  backgroundColor: userType === 'player' ? theme.gold : theme.card,
                  borderWidth: 1.5,
                  borderColor: userType === 'player' ? theme.gold : theme.border,
                }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>⚽</Text>
                <Text style={{ color: userType === 'player' ? '#000' : theme.text, fontWeight: '700', fontSize: 14 }}>Oyuncuyum</Text>
                <Text style={{ color: userType === 'player' ? '#000' : theme.textSecondary, fontSize: 11, marginTop: 2 }}>Kariyer yönetimi</Text>
              </HapticTouchable>

              <HapticTouchable
                onPress={() => setUserType('team')}
                style={{
                  flex: 1, padding: 16, borderRadius: 16, alignItems: 'center',
                  backgroundColor: userType === 'team' ? theme.gold : theme.card,
                  borderWidth: 1.5,
                  borderColor: userType === 'team' ? theme.gold : theme.border,
                }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>🏟️</Text>
                <Text style={{ color: userType === 'team' ? '#000' : theme.text, fontWeight: '700', fontSize: 14 }}>Takımım Var</Text>
                <Text style={{ color: userType === 'team' ? '#000' : theme.textSecondary, fontSize: 11, marginTop: 2 }}>Oyuncu & rakip bul</Text>
              </HapticTouchable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>AD SOYAD</Text>
              <TextInput
                style={styles.input}
                placeholder="Adınız Soyadınız"
                placeholderTextColor={theme.textSecondary}
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
                placeholderTextColor={theme.textSecondary}
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
                placeholderTextColor={theme.textSecondary}
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
                placeholderTextColor={theme.textSecondary}
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
              style={[styles.btnGold, loading && styles.btnGoldDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnGoldText}>Kayıt Ol</Text>
              )}
            </HapticTouchable>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Zaten hesabın var mı? </Text>
              <HapticTouchable onPress={onBack} disabled={loading}>
                <Text style={styles.loginLink}>Giriş Yap</Text>
              </HapticTouchable>
            </View>
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
    header: {
      paddingHorizontal: 24,
      paddingTop: 8,
    },
    backBtn: {
      width: 44,
      height: 44,
      backgroundColor: theme.card,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backIcon: { fontSize: 18, color: theme.text },
    logoWrap: {
      alignItems: 'center',
      marginTop: 16,
      marginBottom: 32,
    },
    logo: {
      fontSize: 28,
      fontWeight: '900',
      color: theme.gold,
      letterSpacing: 6,
    },
    logoSub: {
      fontSize: 11,
      color: theme.textSecondary,
      letterSpacing: 4,
      marginTop: 4,
    },
    form: {
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      height: 52,
      backgroundColor: theme.card2,
      borderRadius: 16,
      paddingHorizontal: 16,
      color: theme.text,
      fontSize: 15,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
    },
    selectValue: {
      fontSize: 15,
      color: theme.text,
    },
    selectPlaceholder: {
      fontSize: 15,
      color: theme.textSecondary,
    },
    btnGold: {
      height: 56,
      backgroundColor: theme.gold,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 20,
    },
    btnGoldDisabled: {
      opacity: 0.6,
    },
    btnGoldText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#000',
      letterSpacing: 1,
    },
    loginRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loginText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    loginLink: {
      fontSize: 14,
      color: theme.gold,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 36,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 16 },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    optionText: { fontSize: 15, color: theme.textMuted, fontWeight: '600' },
    optionTextActive: { color: theme.gold },
    optionCheck: { fontSize: 16, color: theme.gold, fontWeight: '700' },
  });
