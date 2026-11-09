import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Theme, CARD_RADIUS, Paper } from '../constants/theme';
import { FontFamily } from '../constants/fonts';
import { supabase } from '../lib/supabase';
import HapticTouchable from './HapticTouchable';
import Toast from './Toast';
import SectionHeader from './SectionHeader';

// Aylık Premium ücreti (TL). Gerçek tutarı sunucu sabitler; bu değer yalnızca gösterim içindir.
export const PREMIUM_MONTHLY_TRY = 99;

export type PaymentOrderStatus = 'awaiting_transfer' | 'under_review' | 'approved' | 'rejected' | 'cancelled';

type BankAccount = {
  bank_name: string | null;
  recipient_name: string | null;
  iban: string | null;
  enabled: boolean;
};

type PaymentOrder = {
  id: string;
  order_ref: string;
  status: PaymentOrderStatus;
  amount_kurus: number;
  created_at: string;
};

const STATUS_KEYS: Record<PaymentOrderStatus, 'eft_status_awaiting_transfer' | 'eft_status_under_review' | 'eft_status_approved' | 'eft_status_rejected' | 'eft_status_cancelled'> = {
  awaiting_transfer: 'eft_status_awaiting_transfer',
  under_review: 'eft_status_under_review',
  approved: 'eft_status_approved',
  rejected: 'eft_status_rejected',
  cancelled: 'eft_status_cancelled',
};

interface Props {
  memberNo: number | null;
}

// Havale/EFT ile Premium ödeme akışı. Yalnızca geliştirme önizlemesinde gösterilir
// (bkz. PremiumScreen); mağaza sürümlerinde IBAN talimatı yayımlanmaz.
// Banka bilgileri ve talepler sunucudan okunur; bu ekran hiçbir Premium hakkı
// açmaz — Premium yalnızca banka hareketi onaylandıktan sonra sunucuda aktifleşir.
export default function PremiumEftSection({ memberNo }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const styles = createStyles(theme);
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [bankRes, ordersRes] = await Promise.all([
      supabase
        .from('nf_merchant_bank_accounts')
        .select('bank_name, recipient_name, iban, enabled')
        .eq('merchant_key', 'footbally')
        .maybeSingle(),
      supabase
        .from('nf_payment_orders')
        .select('id, order_ref, status, amount_kurus, created_at')
        .order('created_at', { ascending: false })
        .limit(12),
    ]);
    setLoadFailed(!!bankRes.error || !!ordersRes.error);
    setBank(bankRes.data?.enabled ? (bankRes.data as BankAccount) : null);
    setOrders((ordersRes.data ?? []) as PaymentOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    setToast({ message: t('eft_copied'), type: 'success' });
  };

  // Tutar ve kullanıcı kimliği istemciden gönderilmez; sunucu RPC'si bunları kendisi belirler.
  const handleCreateNotice = async () => {
    setCreating(true);
    const { error } = await supabase.rpc('nf_create_footbally_monthly_order');
    setCreating(false);
    if (error) {
      setToast({ message: t('eft_createFailed'), type: 'error' });
      return;
    }
    setToast({ message: t('eft_createdToast'), type: 'success' });
    load();
  };

  const canCreate = !!bank && !!memberNo && !creating;

  return (
    <View style={styles.wrap}>
      <SectionHeader title={t('eft_sectionTitle')} />

      <View style={styles.card}>
        <View style={styles.memberRow}>
          <View style={styles.memberTextWrap}>
            <Text style={styles.label}>{t('eft_memberNoLabel')}</Text>
            <Text style={styles.memberNo}>{memberNo ? String(memberNo) : t('eft_memberNoPending')}</Text>
          </View>
          {memberNo ? (
            <HapticTouchable style={styles.copyBtn} onPress={() => copy(String(memberNo))}>
              <Ionicons name="copy-outline" size={14} color={theme.goldDark} />
              <Text style={styles.copyText}>{t('eft_copy')}</Text>
            </HapticTouchable>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.gold} style={{ marginVertical: 16 }} />
        ) : bank ? (
          <>
            <InfoRow label={t('eft_recipientLabel')} value={bank.recipient_name ?? '-'} styles={styles} />
            <InfoRow
              label={t('eft_ibanLabel')}
              value={bank.iban ?? '-'}
              styles={styles}
              onCopy={bank.iban ? () => copy(bank.iban as string) : undefined}
              copyLabel={t('eft_copy')}
            />
            <InfoRow label={t('eft_amountLabel')} value={`₺${PREMIUM_MONTHLY_TRY}`} styles={styles} />
            <InfoRow
              label={t('eft_descLabel')}
              value={memberNo ? `${t('eft_descPrefix')} ${memberNo}` : '-'}
              styles={styles}
              onCopy={memberNo ? () => copy(`${t('eft_descPrefix')} ${memberNo}`) : undefined}
              copyLabel={t('eft_copy')}
            />
          </>
        ) : (
          <Text style={styles.note}>{loadFailed ? t('eft_loadFailed') : t('eft_notEnabled')}</Text>
        )}

        <Text style={styles.stepsTitle}>{t('eft_stepsTitle')}</Text>
        {[t('eft_step1'), t('eft_step2'), t('eft_step3'), t('eft_step4')].map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={15} color={theme.gold} />
          <Text style={styles.disclaimerText}>{t('eft_disclaimer')}</Text>
        </View>

        <HapticTouchable
          style={[styles.ctaBtn, !canCreate && styles.ctaBtnDisabled]}
          onPress={handleCreateNotice}
          disabled={!canCreate}
        >
          {creating ? (
            <ActivityIndicator color={Paper.ink} />
          ) : (
            <Text style={styles.ctaText}>{t('eft_createBtn')}</Text>
          )}
        </HapticTouchable>
      </View>

      <SectionHeader title={t('eft_ordersTitle')} />
      <View style={styles.card}>
        {orders.length === 0 ? (
          <Text style={styles.note}>{t('eft_ordersEmpty')}</Text>
        ) : (
          orders.map((order) => (
            <View key={order.id} style={styles.orderRow}>
              <View style={styles.orderTextWrap}>
                <Text style={styles.orderRef}>{order.order_ref}</Text>
                <Text style={styles.orderDate}>
                  {new Date(order.created_at).toLocaleDateString('tr-TR')} · ₺{Math.round(order.amount_kurus / 100)}
                </Text>
              </View>
              <Text style={[styles.orderStatus, order.status === 'approved' && styles.orderStatusApproved]}>
                {t(STATUS_KEYS[order.status] ?? 'eft_status_under_review')}
              </Text>
            </View>
          ))
        )}
      </View>

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'success'}
        onHide={() => setToast(null)}
      />
    </View>
  );
}

function InfoRow({
  label,
  value,
  styles,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  onCopy?: () => void;
  copyLabel?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoTextWrap}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.infoValue} selectable>{value}</Text>
      </View>
      {onCopy ? (
        <HapticTouchable style={styles.copyBtn} onPress={onCopy}>
          <Ionicons name="copy-outline" size={14} color={theme.goldDark} />
          <Text style={styles.copyText}>{copyLabel}</Text>
        </HapticTouchable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 24, gap: 4 },
    card: {
      backgroundColor: theme.card,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 12,
    },
    label: { fontFamily: FontFamily.mono, fontSize: 11, color: theme.textMuted, letterSpacing: 0.5 },
    memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    memberTextWrap: { flex: 1 },
    memberNo: { fontFamily: FontFamily.monoMedium, fontSize: 22, color: theme.text, marginTop: 4, letterSpacing: 1 },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: CARD_RADIUS - 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    copyText: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.goldDark },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    infoTextWrap: { flex: 1, paddingRight: 8 },
    infoValue: { fontFamily: FontFamily.bodySemiBold, fontSize: 14, color: theme.text, marginTop: 2 },
    note: { fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, paddingVertical: 8 },
    stepsTitle: { fontFamily: FontFamily.bodySemiBold, fontSize: 13, color: theme.text, marginTop: 12, marginBottom: 6 },
    stepRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
    stepNum: { fontFamily: FontFamily.monoMedium, fontSize: 12, color: theme.goldDark, width: 16 },
    stepText: { flex: 1, fontFamily: FontFamily.body, fontSize: 13, color: theme.textMuted, lineHeight: 18 },
    disclaimer: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      padding: 10,
      borderRadius: CARD_RADIUS - 6,
      backgroundColor: theme.bg,
    },
    disclaimerText: { flex: 1, fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, lineHeight: 17 },
    ctaBtn: {
      marginTop: 14,
      backgroundColor: theme.gold,
      borderRadius: CARD_RADIUS - 4,
      paddingVertical: 14,
      alignItems: 'center',
    },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaText: { fontFamily: FontFamily.bodySemiBold, fontSize: 15, color: Paper.ink },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    orderTextWrap: { flex: 1, paddingRight: 8 },
    orderRef: { fontFamily: FontFamily.monoMedium, fontSize: 13, color: theme.text },
    orderDate: { fontFamily: FontFamily.body, fontSize: 12, color: theme.textMuted, marginTop: 2 },
    orderStatus: { fontFamily: FontFamily.bodySemiBold, fontSize: 12, color: theme.textMuted },
    orderStatusApproved: { color: theme.success },
  });
