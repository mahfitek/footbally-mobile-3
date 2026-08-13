import { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { hexToRgba, Theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { fetchAccountBanRow, evaluateAccountAccess, clearExpiredBan } from '../lib/accountAccess';
import HapticTouchable from '../components/HapticTouchable';

const ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Email veya şifre hatalı',
};

const translateError = (message: string) => ERROR_MESSAGES[message] ?? message;

interface Props {
  onLogin: (userType: 'player' | 'team') => void;
  onRegister: (userType: 'player' | 'team') => void;
}

export default function LoginScreen({ onLogin, onRegister }: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [userType, setUserType] = useState<'player' | 'team'>('player');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen email adresinizi girin');
      return;
    }
    if (!password) {
      Alert.alert('Hata', 'Lütfen şifrenizi girin');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      Alert.alert('Giriş Hatası', translateError(error.message));
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const banRow = await fetchAccountBanRow(userId);
      const access = evaluateAccountAccess(banRow);
      if (!access.allowed) {
        await supabase.auth.signOut();
        setLoading(false);
        Alert.alert('Giriş Engellendi', access.message);
        return;
      }
      if (access.expiredBan && banRow) {
        void clearExpiredBan(userId, banRow.table);
      }
    }

    setLoading(false);
    onLogin(userType);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroEmoji}>⚽</Text>
          <View style={styles.stadiumLights} />
        </View>

        {/* Logo */}
        <View style={[styles.logoWrap, { backgroundColor: 'transparent' }]}>
          <Image
            source={require('../assets/logo-text.png')}
            style={{ width: 260, height: 70, resizeMode: 'contain', backgroundColor: 'transparent' }}
          />
          <Text style={styles.logoSub}>KARİYERİNİ BAŞLAT</Text>
        </View>

        {/* Form */}
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

          <HapticTouchable
            style={[styles.btnGold, loading && styles.btnGoldDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.btnGoldText}>Giriş Yap</Text>
            )}
          </HapticTouchable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social */}
          <View style={styles.socialRow}>
            <HapticTouchable style={styles.socialBtn} onPress={() => onLogin(userType)}>
              <Text style={styles.socialBtnText}>🌐  Google</Text>
            </HapticTouchable>
            <HapticTouchable style={styles.socialBtn} onPress={() => onLogin(userType)}>
              <Text style={styles.socialBtnText}>🍎  Apple</Text>
            </HapticTouchable>
          </View>

          {/* Register */}
          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Hesabın yok mu? </Text>
            <HapticTouchable onPress={() => onRegister(userType)} disabled={loading}>
              <Text style={styles.registerLink}>Hesap Oluştur</Text>
            </HapticTouchable>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      flexGrow: 1,
    },
    hero: {
      height: 220,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    heroGlow: {
      position: 'absolute',
      bottom: 0,
      width: 200,
      height: 80,
      borderRadius: 100,
      backgroundColor: hexToRgba(theme.gold, 0.06),
    },
    stadiumLights: {
      position: 'absolute',
      top: 20,
      width: '80%',
      height: 1,
      backgroundColor: hexToRgba(theme.gold, 0.1),
    },
    heroEmoji: {
      fontSize: 80,
    },
    logoWrap: {
      alignItems: 'center',
      marginBottom: 32,
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
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.border,
    },
    dividerText: {
      fontSize: 12,
      color: theme.textSecondary,
    },
    socialRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 24,
    },
    socialBtn: {
      flex: 1,
      height: 52,
      backgroundColor: theme.card2,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    socialBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    registerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    registerText: {
      fontSize: 14,
      color: theme.textSecondary,
    },
    registerLink: {
      fontSize: 14,
      color: theme.gold,
      fontWeight: '700',
    },
  });
