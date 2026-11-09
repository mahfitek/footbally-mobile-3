import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { CARD_RADIUS, BUTTON_RADIUS, PILL_RADIUS } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import { submitReport, REPORT_REASONS, REPORT_DETAIL_MAX, ReportReason, ReportTargetType, ReportOutcome } from '../lib/reports';
import { TranslationKey } from '../lib/i18n';
import HapticTouchable from '../components/HapticTouchable';

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  name: string;
}

interface Props {
  onBack: () => void;
  target: ReportTarget | null;
}

const REASON_KEYS: Record<ReportReason, TranslationKey> = {
  harassment: 'report_reason_harassment',
  spam: 'report_reason_spam',
  inappropriate: 'report_reason_inappropriate',
  fake: 'report_reason_fake',
  other: 'report_reason_other',
};

type Status = { kind: 'idle' } | { kind: 'sent' } | { kind: 'unavailable' } | { kind: 'failed' } | { kind: 'invalid'; key: TranslationKey };

export default function ReportScreen({ onBack, target }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const handleSubmit = async () => {
    if (!target || !reason || sending) return;
    if (reason === 'other' && !detail.trim()) {
      setStatus({ kind: 'invalid', key: 'report_detailRequired' });
      return;
    }
    setSending(true);
    setStatus({ kind: 'idle' });
    const outcome: ReportOutcome = await submitReport(supabase, {
      targetType: target.type,
      targetId: target.id,
      reason,
      detail,
    });
    setSending(false);

    if (outcome.status === 'sent') setStatus({ kind: 'sent' });
    else if (outcome.status === 'unavailable') setStatus({ kind: 'unavailable' });
    else if (outcome.status === 'invalid') setStatus({ kind: 'invalid', key: 'report_detailRequired' });
    else setStatus({ kind: 'failed' });
  };

  const header = (
    <View style={styles.header}>
      <HapticTouchable style={styles.backBtn} onPress={onBack}>
        <Ionicons name="chevron-back" size={17} color={theme.text} />
      </HapticTouchable>
      <Text style={styles.title}>{t('report_title')}</Text>
      <View style={styles.backBtn} />
    </View>
  );

  if (!target) {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <View style={styles.resultWrap}>
          <Text style={styles.resultText}>{t('report_noTarget')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status.kind === 'sent') {
    return (
      <SafeAreaView style={styles.safe}>
        {header}
        <View style={styles.resultWrap}>
          <Ionicons name="checkmark-circle-outline" size={44} color={theme.gold} />
          <Text style={styles.resultText}>{t('report_sent')}</Text>
          <HapticTouchable style={styles.submit} onPress={onBack}>
            <Text style={styles.submitText}>{t('common_back')}</Text>
          </HapticTouchable>
        </View>
      </SafeAreaView>
    );
  }

  const canSubmit = !!reason && !sending;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.targetName} numberOfLines={1}>{target.name}</Text>
        <Text style={styles.sectionTitle}>{t('report_reasonHeader')}</Text>

        <View style={styles.card}>
          {REPORT_REASONS.map((r) => {
            const active = reason === r;
            return (
              <HapticTouchable key={r} style={styles.reasonRow} onPress={() => setReason(r)}>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.reasonText, active && styles.reasonTextActive]}>{t(REASON_KEYS[r])}</Text>
              </HapticTouchable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          value={detail}
          onChangeText={setDetail}
          placeholder={t('report_detailPlaceholder')}
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={REPORT_DETAIL_MAX}
          textAlignVertical="top"
        />

        {status.kind === 'invalid' && <Text style={styles.error}>{t(status.key)}</Text>}
        {status.kind === 'unavailable' && <Text style={styles.error}>{t('report_unavailable')}</Text>}
        {status.kind === 'failed' && <Text style={styles.error}>{t('report_failed')}</Text>}

        <HapticTouchable style={[styles.submit, !canSubmit && styles.submitDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          {sending ? (
            <ActivityIndicator color={theme.gold} />
          ) : (
            <Text style={styles.submitText}>{t('report_submit')}</Text>
          )}
        </HapticTouchable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
    backBtn: { width: 36, height: 36, borderRadius: PILL_RADIUS, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.card },
    title: { fontFamily: FontFamily.display, fontSize: 17, color: theme.text },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    targetName: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: theme.textMuted },
    sectionTitle: { fontFamily: FontFamily.display, fontSize: 18, color: theme.text, marginTop: 4 },
    card: { backgroundColor: theme.card, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: theme.border, padding: 6 },
    reasonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.textMuted, alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: theme.gold },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.gold },
    reasonText: { fontFamily: FontFamily.body, fontSize: 15, color: theme.text },
    reasonTextActive: { fontFamily: FontFamily.bodySemiBold },
    input: {
      minHeight: 96,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      color: theme.text,
      fontFamily: FontFamily.body,
      fontSize: 15,
      padding: 14,
    },
    error: { fontFamily: FontFamily.body, fontSize: 13, color: theme.error },
    submit: {
      height: 52,
      borderRadius: BUTTON_RADIUS,
      backgroundColor: theme.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    submitDisabled: { opacity: 0.45 },
    submitText: { fontFamily: FontFamily.display, fontSize: 16, color: '#101820' },
    resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    resultText: { fontFamily: FontFamily.body, fontSize: 15, color: theme.text, textAlign: 'center' },
  });
}
