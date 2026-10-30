import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { CARD_RADIUS, Paper, Theme } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { profiles } from '../lib/profiles';
import { useAccountAccess } from '../lib/accountContext';
import { renderAccountMessage } from '../lib/accountAccess';
import { requestAccountDeletion } from '../lib/accountDeletion';
import BottomSheet from '../components/BottomSheet';
import SectionHeader from '../components/SectionHeader';

const RADIUS = CARD_RADIUS;
type IoniconName = keyof typeof Ionicons.glyphMap;

interface Props {
  navigate: (s: string) => void;
  userId: string | null;
  fromScreen?: string;
}

function SettingRow({ theme, icon, title, subtitle, onPress, right, danger = false }: {
    theme: Theme;
    icon: IoniconName; title: string; subtitle?: string; onPress: () => void; right?: React.ReactNode; danger?: boolean;
  }) {
  return (
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
}

export default function SettingsScreen({ navigate, userId, fromScreen }: Props) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const [notifications, setNotifications] = useState(true);
  const [matchNotifs, setMatchNotifs] = useState(true);
  const [messageNotifs, setMessageNotifs] = useState(true);
  const [scoutNotifs, setScoutNotifs] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retryingStatus, setRetryingStatus] = useState(false);
  // Hesap durumu App'teki tek kaynaktan gelir; Ayarlar kendi sorgusunu yapmaz.
  const { access, refresh: refreshAccountStatus } = useAccountAccess();
  // Doğrulanmış ve temiz: korunan işlemler açık. Doğrulanamadıysa "tekrar dene" sunulur.
  const statusClean = !!access && access.verified && access.allowed && !access.teamRestricted;
  const statusDetail = statusClean
    ? undefined
    : access?.verified && access.allowed && access.teamRestricted
      ? renderAccountMessage(access.teamMessage, lang)
      : renderAccountMessage(access?.message, lang) ?? t('settings_accountStatusChecking');
  // "Kısıtlı" yalnızca kişisel hesap kısıtlıysa gösterilir; takım yasağı ya da profil eksikliği ayrı etiket alır.
  const statusLabel = statusClean
    ? t('settings_accountStatusActive')
    : access?.verified
      ? access.allowed
        ? t('settings_accountStatusTeamRestricted')
        : t('settings_accountStatusRestricted')
      : access?.unverifiedReason === 'no_profile'
        ? t('settings_accountStatusNoProfile')
        : t('settings_accountStatusUnverified');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setEmail(session.user.email || '');
    });
  }, []);

  const retryAccountStatus = async () => {
    setRetryingStatus(true);
    await refreshAccountStatus();
    setRetryingStatus(false);
  };

  useEffect(() => {
    if (!userId) return;
    profiles
      .ownProfile('notify_all, notify_match, notify_message, notify_scout')
      .then(({ data, error }) => {
        if (error) {
          if (__DEV__) console.log('Bildirim tercihleri yüklenemedi:', error);
          return;
        }
        if (data) {
          setNotifications(data.notify_all ?? true);
          setMatchNotifs(data.notify_match ?? true);
          setMessageNotifs(data.notify_message ?? true);
          setScoutNotifs(data.notify_scout ?? true);
        }
      });
  }, [userId]);

  const updateNotifPref = (column: 'notify_all' | 'notify_match' | 'notify_message' | 'notify_scout', value: boolean) => {
    if (!userId) return;
    profiles
      .updateOwn(userId, { [column]: value })
      .then(({ error }) => {
        if (error && __DEV__) console.log('Bildirim tercihi kaydedilemedi:', error);
      });
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert(t('regions_error'), t('settings_passwordMismatch'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('regions_error'), t('settings_passwordTooShort'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      Alert.alert(t('regions_error'), t('settings_passwordChangeFailed'));
    } else {
      Alert.alert(t('settings_success'), t('settings_passwordChanged'));
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleChangeEmail = async () => {
    const trimmedEmail = newEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(t('regions_error'), t('settings_invalidEmail'));
      return;
    }
    if (trimmedEmail.toLowerCase() === email.toLowerCase()) {
      Alert.alert(t('regions_error'), t('settings_sameEmail'));
      return;
    }
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
    setEmailLoading(false);
    if (error) {
      Alert.alert(t('regions_error'), t('settings_emailChangeFailed'));
    } else {
      Alert.alert(t('settings_confirmationRequired'), t('settings_emailConfirmationSent'));
      setShowEmailModal(false);
      setNewEmail('');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings_logout'),
      t('settings_logoutConfirm'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('settings_logout'),
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            navigate('onboarding');
          },
        },
      ]
    );
  };

  const openDeletionEmail = () => {
    const subject = encodeURIComponent(t('settings_deleteRequestSubject'));
    Linking.openURL(`mailto:info@getfootbally.com?subject=${subject}`);
  };

  // Gerçek silme: sunucu { deleted: true } dönmeden başarı gösterilmez (bkz. lib/accountDeletion.ts).
  const runAccountDeletion = async () => {
    setDeleting(true);
    try {
      const outcome = await requestAccountDeletion(supabase);
      if (outcome.status === 'deleted') {
        await supabase.auth.signOut();
        Alert.alert(t('account_deleteDone'));
        navigate('onboarding');
        return;
      }
      if (outcome.status === 'unavailable') {
        Alert.alert(t('settings_deleteAccount'), t('account_deleteUnavailable'), [
          { text: t('common_cancel'), style: 'cancel' },
          { text: t('account_deleteEmail'), onPress: openDeletionEmail },
        ]);
        return;
      }
      Alert.alert(t('settings_deleteAccount'), t('account_deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(t('settings_deleteAccount'), t('account_deleteConfirm'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('account_deleteAction'), style: 'destructive', onPress: runAccountDeletion },
    ]);
  };


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
        <Text style={{ color: theme.text, fontSize: 19, fontFamily: FontFamily.display, letterSpacing: 0.5 }}>{t('settings_title')}</Text>
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
            <Text style={{ color: theme.text, fontSize: 15, fontFamily: FontFamily.bodySemiBold }}>{t('settings_account')}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, fontFamily: FontFamily.mono }}>{email}</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: theme.gold, borderRadius: RADIUS, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: theme.goldDark, fontSize: 11, fontFamily: FontFamily.mono }}>{t('settings_free')}</Text>
          </View>
        </View>

        <SettingRow theme={theme}
          icon="location-outline"
          title={t('settings_regionsTitle')}
          subtitle={t('settings_regionsSub')}
          onPress={() => navigate('regions')}
        />

        {/* HESAP AYARLARI */}
        <SectionHeader title={t('settings_accountSectionHeader')} horizontalPadding={4} />

        <SettingRow theme={theme}
          icon={statusClean ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          title={t('settings_accountStatusTitle')}
          subtitle={
            statusClean
              ? t('settings_accountStatusOk')
              : `${statusDetail ?? ''} ${access?.verified ? '' : t('settings_accountStatusRetryHint')}`.trim()
          }
          onPress={() => {
            // Doğrulanamayan durumda dokunmak yeniden dener; doğrulanmış kısıtlamada yalnızca açıklama gösterilir.
            if (statusClean || retryingStatus) return;
            if (access?.verified) {
              Alert.alert(t('settings_accountStatusTitle'), statusDetail || t('settings_accountRestrictionDefault'));
            } else {
              void retryAccountStatus();
            }
          }}
          right={
            <View
              style={{
                borderWidth: 1,
                borderColor: statusClean ? theme.success : theme.error,
                borderRadius: RADIUS,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}>
              <Text style={{ color: statusClean ? theme.success : theme.error, fontSize: 11, fontFamily: FontFamily.mono }}>
                {statusLabel.toUpperCase()}
              </Text>
            </View>
          }
        />

        <SettingRow theme={theme} icon="lock-closed-outline" title={t('settings_changePassword')} subtitle={t('settings_changePasswordSub')} onPress={() => setShowPasswordModal(true)} />

        <SettingRow theme={theme}
          icon="mail-outline"
          title={t('settings_emailTitle')}
          subtitle={email}
          onPress={() => setShowEmailModal(true)}
        />

        <SettingRow theme={theme} icon="star-outline" title={t('performance_premiumCta')} subtitle={t('settings_premiumUpgradeSub')} onPress={() => navigate('premium')} />

        <SettingRow theme={theme} icon="card-outline" title={t('settings_paymentsTitle')} subtitle={t('settings_paymentsSub')} onPress={() => navigate('premium')} />

        <SettingRow theme={theme} icon="shirt-outline" title={t('merch_settingsTitle')} subtitle={t('merch_settingsSub')} onPress={() => navigate('merch')} />

        <SettingRow theme={theme}
          icon="download-outline"
          title={t('settings_downloadDataTitle')}
          subtitle={t('settings_downloadDataSub')}
          onPress={() => Alert.alert(t('settings_comingSoonTitle'), t('settings_dataDownloadComingSoon'))}
        />

        {/* GÖRÜNÜM */}
        <SectionHeader title={t('settings_appearanceHeader')} horizontalPadding={4} />

        <View style={{ backgroundColor: theme.card, borderRadius: RADIUS, marginBottom: 8, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <View style={{ width: 38, height: 38, backgroundColor: theme.card2, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={17} color={theme.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold }}>{t('settings_theme')}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.body }}>{isDark ? t('settings_darkMode') : t('settings_lightMode')}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: 'rgba(7,150,103,0.35)' }}
              thumbColor={isDark ? theme.gold : '#FFFFFF'}
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

        <SettingRow theme={theme}
          icon="compass-outline"
          title={t('settings_replayOnboarding')}
          subtitle={t('settings_replayOnboardingSub')}
          onPress={() => navigate('onboarding')}
        />

        {/* İLERLEME */}
        <SectionHeader title={t('settings_progressHeader')} horizontalPadding={4} />

        <SettingRow theme={theme}
          icon="ribbon-outline"
          title={t('settings_badgesTitle')}
          subtitle={t('settings_badgesSub')}
          onPress={() => navigate('badges')}
        />

        {/* BİLDİRİMLER */}
        <SectionHeader title={t('settings_notificationsHeader')} horizontalPadding={4} />

        {([
          { key: 'all', column: 'notify_all' as const, label: t('settings_notifAll'), icon: 'notifications-outline' as IoniconName, value: notifications, setter: setNotifications },
          { key: 'match', column: 'notify_match' as const, label: t('settings_notifMatch'), icon: 'football-outline' as IoniconName, value: matchNotifs, setter: setMatchNotifs },
          { key: 'message', column: 'notify_message' as const, label: t('settings_notifMessage'), icon: 'chatbubble-outline' as IoniconName, value: messageNotifs, setter: setMessageNotifs },
          { key: 'scout', column: 'notify_scout' as const, label: t('settings_notifScout'), icon: 'search-outline' as IoniconName, value: scoutNotifs, setter: setScoutNotifs },
        ]).map((item) => (
          <View key={item.key} style={{ backgroundColor: theme.card, borderRadius: RADIUS, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
              <View style={{ width: 38, height: 38, backgroundColor: theme.card2, borderRadius: RADIUS, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={17} color={theme.gold} />
              </View>
              <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold, flex: 1 }}>{item.label}</Text>
              <Switch
                value={item.value}
                onValueChange={(newValue) => {
                  item.setter(newValue);
                  updateNotifPref(item.column, newValue);
                }}
                trackColor={{ false: '#D1D5DB', true: 'rgba(7,150,103,0.35)' }}
                thumbColor={item.value ? theme.gold : '#FFFFFF'}
              />
            </View>
          </View>
        ))}

        {/* GİZLİLİK & DESTEK */}
        <SectionHeader title={t('settings_privacyHeader')} horizontalPadding={4} />

        <SettingRow theme={theme}
          icon="document-text-outline"
          title={t('settings_privacyPolicy')}
          subtitle={t('settings_privacyPolicySub')}
          onPress={() => Linking.openURL('https://getfootbally.com/privacy')}
        />

        <SettingRow theme={theme} icon="clipboard-outline" title={t('settings_termsOfUse')} onPress={() => Linking.openURL('https://getfootbally.com/terms')} />

        <SettingRow theme={theme} icon="chatbubble-outline" title={t('settings_contactUs')} subtitle="info@getfootbally.com" onPress={() => Linking.openURL('mailto:info@getfootbally.com')} />

        <SettingRow theme={theme}
          icon="star-outline"
          title={t('settings_rateApp')}
          subtitle={t('settings_rateAppSub')}
          onPress={() => Alert.alert(t('settings_comingSoonTitle'), t('settings_rateComingSoon'))}
        />

        {/* UYGULAMA BİLGİSİ */}
        <SectionHeader title={t('settings_appInfoHeader')} horizontalPadding={4} />

        <View style={{ backgroundColor: theme.card, borderRadius: RADIUS, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
          <Text style={{ color: theme.text, fontSize: 14, fontFamily: FontFamily.bodySemiBold, marginBottom: 4 }}>Footbally</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono }}>{t('settings_versionPrefix')} 1.0.0 Beta</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono }}>{t('settings_copyright')}</Text>
        </View>

        {/* TEHLİKELİ ALAN */}
        <Text style={{ color: theme.error, fontSize: 12, fontFamily: FontFamily.mono, letterSpacing: 1.5, marginBottom: 10, marginTop: 16, paddingHorizontal: 4 }}>
          {t('settings_dangerZoneHeader')}
        </Text>

        <SettingRow theme={theme} icon="log-out-outline" title={t('settings_logout')} subtitle={t('settings_logoutSub')} onPress={handleLogout} danger={true} />

        <SettingRow theme={theme} icon="trash-outline" title={t('settings_deleteAccount')} subtitle={t('settings_deleteAccountSub')} onPress={handleDeleteAccount} danger={true} />

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* PASSWORD CHANGE SHEET */}
      <BottomSheet visible={showPasswordModal} onClose={() => setShowPasswordModal(false)} theme={theme}>
        <Text style={{ color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, marginBottom: 20 }}>{t('settings_changePasswordTitle')}</Text>

        <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>{t('settings_newPasswordLabel')}</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder={t('settings_newPasswordPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          style={{ backgroundColor: theme.bg, borderRadius: RADIUS, padding: 14, color: theme.text, fontFamily: FontFamily.mono, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}
        />

        <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>{t('settings_newPasswordConfirmLabel')}</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t('settings_confirmPasswordPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          style={{ backgroundColor: theme.bg, borderRadius: RADIUS, padding: 14, color: theme.text, fontFamily: FontFamily.mono, marginBottom: 20, borderWidth: 1, borderColor: theme.border }}
        />

        <TouchableOpacity
          onPress={handleChangePassword}
          style={{ backgroundColor: theme.gold, borderRadius: RADIUS, padding: 16, alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ color: Paper.ink, fontFamily: FontFamily.display, fontSize: 14, letterSpacing: 1 }}>{loading ? t('settings_changingPassword') : t('settings_changePasswordBtn')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary, fontFamily: FontFamily.mono, fontSize: 12 }}>{t('common_cancel')}</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* EMAIL CHANGE SHEET */}
      <BottomSheet visible={showEmailModal} onClose={() => { setShowEmailModal(false); setNewEmail(''); }} theme={theme}>
        <Text style={{ color: theme.text, fontSize: 18, fontFamily: FontFamily.display, letterSpacing: 0.5, marginBottom: 20 }}>{t('settings_changeEmailTitle')}</Text>

        <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>{t('settings_currentEmailLabel')}</Text>
        <Text style={{ color: theme.text, fontSize: 13, fontFamily: FontFamily.mono, marginBottom: 16 }}>{email}</Text>

        <Text style={{ color: theme.textSecondary, fontSize: 12, fontFamily: FontFamily.mono, marginBottom: 6 }}>{t('settings_newEmailLabel')}</Text>
        <TextInput
          value={newEmail}
          onChangeText={setNewEmail}
          placeholder={t('settings_newEmailPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ backgroundColor: theme.bg, borderRadius: RADIUS, padding: 14, color: theme.text, fontFamily: FontFamily.mono, marginBottom: 20, borderWidth: 1, borderColor: theme.border }}
        />

        <TouchableOpacity
          onPress={handleChangeEmail}
          disabled={emailLoading}
          style={{ backgroundColor: theme.gold, borderRadius: RADIUS, padding: 16, alignItems: 'center', marginBottom: 10, opacity: emailLoading ? 0.7 : 1 }}>
          <Text style={{ color: Paper.ink, fontFamily: FontFamily.display, fontSize: 14, letterSpacing: 1 }}>{emailLoading ? t('settings_sendingEmail') : t('settings_changeEmailBtn')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setShowEmailModal(false); setNewEmail(''); }} style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ color: theme.textSecondary, fontFamily: FontFamily.mono, fontSize: 12 }}>{t('common_cancel')}</Text>
        </TouchableOpacity>
      </BottomSheet>
    </SafeAreaView>
  );
}
