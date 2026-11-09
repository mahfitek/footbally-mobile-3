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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { translateAuthError } from '../lib/authErrors';
import HapticTouchable from '../components/HapticTouchable';

const RADIUS = CARD_RADIUS;


interface Props {
  onLogin: () => void;
  onBack: () => void;
}

export default function RegisterScreen({ onLogin, onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Kayıtta yalnızca temel hesap bilgisi alınır. Futbol bilgileri (mevki, ayak, şehir vb.) profil ekranında tamamlanır.
  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert(t('login_errorTitle'), t('register_fillAllFields'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('login_errorTitle'), t('register_passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('login_errorTitle'), t('register_passwordTooShort'));
      return;
    }
    if (!privacyAccepted) {
      Alert.alert(t('login_errorTitle'), t('register_acceptPrivacy'));
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          kvkk_accepted_at: new Date().toISOString(),
        },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert(t('register_error'), translateAuthError(error.message, t));
      return;
    }

    if (!data.session) {
      Alert.alert(t('register_verifyEmailTitle'), t('register_verifyEmailBody'));
      onBack();
      return;
    }

    onLogin();
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
              <Text style={styles.cardLabel}>{t('register_newPlayerReg')}</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('register_fullName')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('register_fullNamePlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="words"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('login_emailLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="scout@footbally.app"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('login_passwordLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('register_passwordAgain')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
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
                    {t('register_privacyPolicy')}
                  </Text>
                  {t('login_and')}
                  <Text
                    style={styles.privacyLink}
                    onPress={() => Linking.openURL('https://getfootbally.com/terms')}
                  >
                    {t('register_kvkk')}
                  </Text>
                  {t('register_privacyAccept')}
                </Text>
              </HapticTouchable>

              <HapticTouchable
                style={[styles.btnGold, loading && styles.btnGoldDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={theme.bg} />
                ) : (
                  <Text style={styles.btnGoldText}>{t('register_submit')}</Text>
                )}
              </HapticTouchable>
            </View>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>{t('register_haveAccount')}</Text>
            <HapticTouchable onPress={onBack} disabled={loading}>
              <Text style={styles.loginLink}>{t('login_signIn')}</Text>
            </HapticTouchable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

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
      backgroundColor: theme.card2,
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
      borderRadius: 8,
      resizeMode: 'contain',
    },
    cardBrand: {
      fontFamily: FontFamily.display,
      fontSize: 20,
      letterSpacing: 2,
      color: theme.text,
    },
    cardLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 11,
      letterSpacing: 1,
      color: theme.goldDark,
      paddingBottom: 14,
      marginBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontFamily: FontFamily.mono,
      fontSize: 10,
      color: theme.textMuted,
      letterSpacing: 1,
      marginBottom: 8,
    },
    input: {
      height: 48,
      backgroundColor: theme.bg,
      borderRadius: RADIUS,
      paddingHorizontal: 14,
      color: theme.text,
      fontFamily: FontFamily.mono,
      fontSize: 14,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: 'center',
    },
    selectValue: {
      fontFamily: FontFamily.mono,
      fontSize: 14,
      color: theme.text,
    },
    selectPlaceholder: {
      fontFamily: FontFamily.mono,
      fontSize: 14,
      color: theme.textMuted,
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
      borderColor: theme.border,
      backgroundColor: theme.bg,
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
      color: theme.bg,
      lineHeight: 14,
    },
    privacyText: {
      flex: 1,
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: theme.textMuted,
      lineHeight: 18,
    },
    privacyLink: {
      color: theme.goldDark,
    },
    btnGold: {
      height: 52,
      backgroundColor: theme.gold,
      borderRadius: PILL_RADIUS,
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
      color: theme.bg,
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
      color: theme.goldDark,
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
    optionTextActive: { color: theme.goldDark },
    optionCheck: { fontSize: 16, color: theme.goldDark, fontWeight: '700' },
  });
