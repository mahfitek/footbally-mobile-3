import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import HapticTouchable from '../components/HapticTouchable';
import EmptyState from '../components/EmptyState';

interface Props {
  onBack: () => void;
}

// Sepet ve teslimat adresi arayüzü. Merch tabloları (merch_cart_items, merch_addresses)
// canlı Supabase'de henüz yok; bu yüzden sepete ekleme ve adres kaydetme kapalıdır.
// Kaydet düğmesi "Yakında" olarak devre dışı bırakılır, sahte kayıt yapılmaz.
export default function MerchCartScreen({ onBack }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [postalCode, setPostalCode] = useState('');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <HapticTouchable style={styles.backBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
        </HapticTouchable>
        <Text style={styles.title}>{t('merch_cartTitle').toUpperCase()}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>{t('merch_cartSection')}</Text>
        <EmptyState
          icon="cart-outline"
          title={t('merch_cartEmptyTitle')}
          subtitle={t('merch_cartEmptyBody')}
        />

        <Text style={styles.sectionLabel}>{t('merch_addressSection')}</Text>
        <View style={styles.card}>
          <Field label={t('merch_addressFullName')} value={fullName} onChangeText={setFullName} styles={styles} />
          <Field label={t('merch_addressPhone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" styles={styles} />
          <Field label={t('merch_addressCity')} value={city} onChangeText={setCity} styles={styles} />
          <Field label={t('merch_addressDistrict')} value={district} onChangeText={setDistrict} styles={styles} />
          <Field label={t('merch_addressLine')} value={addressLine} onChangeText={setAddressLine} multiline styles={styles} />
          <Field label={t('merch_addressPostalCode')} value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" styles={styles} />
        </View>

        <View style={styles.disabledBtn}>
          <Text style={styles.disabledBtnText}>{t('merch_addressSaveComingSoon')}</Text>
        </View>
        <Text style={styles.note}>{t('merch_checkoutNote')}</Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  multiline?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        placeholderTextColor={theme.textMuted}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 12,
    },
    backBtn: {
      width: 42,
      height: 42,
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    title: { fontFamily: FontFamily.display, fontSize: 24, color: theme.text, letterSpacing: 1 },
    content: { paddingHorizontal: 24, paddingBottom: 120, gap: 12 },
    sectionLabel: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textMuted, letterSpacing: 0.5, marginTop: 8 },
    card: {
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 10,
    },
    field: { gap: 4 },
    fieldLabel: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.textMuted },
    input: {
      fontFamily: FontFamily.body,
      fontSize: 14,
      color: theme.text,
      backgroundColor: theme.bg,
      borderRadius: CARD_RADIUS - 6,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
    disabledBtn: {
      marginTop: 6,
      backgroundColor: theme.border,
      borderRadius: CARD_RADIUS - 4,
      paddingVertical: 14,
      alignItems: 'center',
    },
    disabledBtnText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.textMuted },
    note: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, textAlign: 'center' },
  });
