import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { BUTTON_RADIUS, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { validateNewPassword } from '../lib/authFlows';
import HapticTouchable from '../components/HapticTouchable';

interface Props {
  // Kurtarma oturumu App tarafından kurulmuşsa true. Değilse ekran geçersiz bağlantı gösterir.
  hasRecoverySession: boolean;
  onDone: () => void;
}

// Kurtarma bağlantısından gelen kullanıcı yeni şifre belirler. Başarıda oturum kapatılır ve giriş ekranına dönülür:
// kullanıcı yeni şifreyle giriş yaptığını görmüş olur.
export default function ResetPasswordScreen({ hasRecoverySession, onDone }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const problem = validateNewPassword(password, confirm);
    if (problem === 'too_short') return Alert.alert(t('login_errorTitle'), t('auth_passwordTooShort'));
    if (problem === 'mismatch') return Alert.alert(t('login_errorTitle'), t('auth_passwordMismatch'));

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      Alert.alert(t('login_errorTitle'), t('auth_passwordUpdateFailed'));
      return;
    }
    await supabase.auth.signOut();
    setSaving(false);
    Alert.alert(t('auth_newPasswordTitle'), t('auth_passwordUpdated'), [{ text: 'OK', onPress: onDone }]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <Text style={styles.title}>{t('auth_newPasswordTitle')}</Text>

        {!hasRecoverySession ? (
          <>
            <Text style={styles.hint}>{t('auth_linkInvalid')}</Text>
            <HapticTouchable style={styles.button} onPress={onDone}>
              <Text style={styles.buttonText}>{t('auth_backToLogin')}</Text>
            </HapticTouchable>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('auth_newPassword')}</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={theme.textMuted} autoCapitalize="none" />
            <Text style={styles.label}>{t('auth_confirmPassword')}</Text>
            <TextInput style={styles.input} secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="••••••••" placeholderTextColor={theme.textMuted} autoCapitalize="none" />
            <HapticTouchable style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.buttonText}>{t('auth_saveNewPassword')}</Text>}
            </HapticTouchable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    wrap: { flex: 1, padding: 24, gap: 10, justifyContent: 'center' },
    title: { fontFamily: FontFamily.display, fontSize: 22, color: theme.text, marginBottom: 12 },
    hint: { fontFamily: FontFamily.body, fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 12 },
    label: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text, marginTop: 6 },
    input: {
      height: 50,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      color: theme.text,
      paddingHorizontal: 14,
      fontFamily: FontFamily.body,
      fontSize: 15,
    },
    button: { height: 52, borderRadius: BUTTON_RADIUS, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: FontFamily.display, fontSize: 16, color: '#101820' },
  });
}
