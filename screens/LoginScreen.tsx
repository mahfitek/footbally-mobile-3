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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, PILL_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { TranslationKey } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { fetchAccountBanRow, evaluateAccountAccess, clearExpiredBan } from '../lib/accountAccess';
import HapticTouchable from '../components/HapticTouchable';
import FadeInView from '../components/FadeInView';

const RADIUS = CARD_RADIUS;

const translateError = (message: string, t: (key: TranslationKey) => string) =>
  message === 'Invalid login credentials' ? t('login_invalidCredentials') : message;

interface Props {
  onLogin: (userType: 'player' | 'team') => void;
  onRegister: (userType: 'player' | 'team') => void;
}

export default function LoginScreen({ onLogin, onRegister }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [userType, setUserType] = useState<'player' | 'team'>('player');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert(t('login_errorTitle'), t('login_emailRequired'));
      return;
    }
    if (!password) {
      Alert.alert(t('login_errorTitle'), t('login_passwordRequired'));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      Alert.alert(t('login_error'), translateError(error.message, t));
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const banRow = await fetchAccountBanRow(userId);
      const access = evaluateAccountAccess(banRow);
      if (!access.allowed) {
        await supabase.auth.signOut();
        setLoading(false);
        Alert.alert(t('login_blocked'), access.message);
        return;
      }
      if (access.expiredBan && banRow) {
        void clearExpiredBan(userId, banRow.table);
      }
    }

    setLoading(false);
    onLogin(userType);
  };

  const todayLabel = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Seri no / tarih şeridi */}
        <View style={styles.topStrip}>
          <Text style={styles.topStripText}>TFF-LC-2026-08149</Text>
          <Text style={styles.topStripText}>{todayLabel}</Text>
        </View>

        {/* Lisans kartı */}
        <FadeInView style={styles.cardWrap} translateY={20} duration={280}>
          <View style={styles.card}>
            <View style={styles.crestRow}>
              <Image source={require('../assets/logo-icon-square.png')} style={styles.crest} />
              <Text style={styles.cardBrand}>FOOTBALLY</Text>
            </View>
            <Text style={styles.cardLabel}>{t('login_licenseLabel')}</Text>

            <View style={styles.roleRow}>
              <HapticTouchable
                onPress={() => setUserType('player')}
                style={[styles.roleTab, userType === 'player' && styles.roleTabActive]}
              >
                <Text style={[styles.roleTitle, userType === 'player' && styles.roleTitleActive]}>{t('login_iAmPlayer')}</Text>
                <Text style={[styles.roleSub, userType === 'player' && styles.roleSubActive]}>{t('login_careerManagement')}</Text>
              </HapticTouchable>
              <HapticTouchable
                onPress={() => setUserType('team')}
                style={[styles.roleTab, userType === 'team' && styles.roleTabActive]}
              >
                <Text style={[styles.roleTitle, userType === 'team' && styles.roleTitleActive]}>{t('login_iHaveTeam')}</Text>
                <Text style={[styles.roleSub, userType === 'team' && styles.roleSubActive]}>{t('login_findPlayersOpponents')}</Text>
              </HapticTouchable>
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

            <HapticTouchable
              style={[styles.btnGold, loading && styles.btnGoldDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.bg} />
              ) : (
                <Text style={styles.btnGoldText}>{t('login_signIn')}</Text>
              )}
            </HapticTouchable>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('login_or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <HapticTouchable style={styles.socialBtn} onPress={() => onLogin(userType)}>
                <Ionicons name="logo-google" size={16} color={theme.text} />
                <Text style={styles.socialBtnText}>{t('login_google')}</Text>
              </HapticTouchable>
              <HapticTouchable style={styles.socialBtn} onPress={() => onLogin(userType)}>
                <Ionicons name="logo-apple" size={18} color={theme.text} />
                <Text style={styles.socialBtnText}>{t('login_apple')}</Text>
              </HapticTouchable>
            </View>
          </View>
        </FadeInView>

        {/* Register */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>{t('login_noAccount')}</Text>
          <HapticTouchable onPress={() => onRegister(userType)} disabled={loading}>
            <Text style={styles.registerLink}>{t('login_createAccount')}</Text>
          </HapticTouchable>
        </View>

        {/* Şartlar + Gizlilik */}
        <Text style={styles.legalText}>
          {t('login_legalPrefix')}
          <Text style={styles.legalLink} onPress={() => Linking.openURL('https://getfootbally.com/terms')}>
            {t('login_terms')}
          </Text>
          {t('login_and')}
          <Text style={styles.legalLink} onPress={() => Linking.openURL('https://getfootbally.com/privacy')}>
            {t('login_privacy')}
          </Text>
          {t('login_legalSuffix')}
        </Text>

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
    topStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 22,
    },
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
      color: theme.gold,
      paddingBottom: 14,
      marginBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    roleRow: {
      flexDirection: 'row',
      marginBottom: 20,
      borderRadius: RADIUS,
      overflow: 'hidden',
    },
    roleTab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    roleTabActive: {
      backgroundColor: theme.gold,
      borderColor: theme.gold,
    },
    roleTitle: {
      fontFamily: FontFamily.display,
      fontSize: 14,
      letterSpacing: 1,
      color: theme.text,
    },
    roleTitleActive: {
      color: theme.bg,
    },
    roleSub: {
      fontFamily: FontFamily.mono,
      fontSize: 10,
      color: theme.textMuted,
      marginTop: 2,
    },
    roleSubActive: {
      color: theme.bg,
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
    },
    btnGold: {
      height: 52,
      backgroundColor: theme.gold,
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 18,
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
      fontFamily: FontFamily.mono,
      fontSize: 10,
      color: theme.textMuted,
      letterSpacing: 1,
    },
    socialRow: {
      flexDirection: 'row',
      gap: 10,
    },
    socialBtn: {
      flex: 1,
      height: 46,
      flexDirection: 'row',
      gap: 8,
      backgroundColor: 'transparent',
      borderRadius: PILL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    socialBtnText: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: theme.text,
    },
    registerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 22,
    },
    registerText: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: theme.textSecondary,
    },
    registerLink: {
      fontFamily: FontFamily.mono,
      fontSize: 12,
      color: theme.gold,
    },
    legalText: {
      fontFamily: FontFamily.mono,
      fontSize: 10.5,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: 17,
      paddingHorizontal: 32,
      marginTop: 10,
      marginBottom: 30,
    },
    legalLink: {
      color: theme.gold,
    },
  });
