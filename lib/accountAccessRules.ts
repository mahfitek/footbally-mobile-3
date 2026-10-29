// Hesap erişim kuralları (saf fonksiyonlar). Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.
// Veri çekme ve süresi dolmuş yasağı temizleme: accountAccess.ts.

export interface AccountBanFields {
  account_status: string;
  banned_until: string | null;
  ban_is_permanent: boolean | null;
  ban_reason: string | null;
}

export interface AccountBanLookup extends AccountBanFields {
  table: 'profiles' | 'teams';
}

export type AccountBanLookupResult =
  | { verified: true; row: AccountBanLookup | null }
  | { verified: false };

export interface AccountAccessResult {
  allowed: boolean;
  expiredBan: boolean;
  message?: string;
}

const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

// Formatted manually (not toLocaleDateString) so the tr-TR output is guaranteed
// regardless of whether the device's Hermes build includes full ICU data.
function formatDate(d: Date): string {
  return `${d.getDate()} ${TURKISH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Fail closed: if the account status could not be verified, access is denied. A team ban must never be
 * skipped just because the status lookup failed.
 */
export function evaluateAccountAccess(lookup: AccountBanLookupResult): AccountAccessResult {
  if (!lookup.verified) {
    return {
      allowed: false,
      expiredBan: false,
      message: 'Hesap durumunuz doğrulanamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
    };
  }
  return evaluateBanRow(lookup.row);
}

function evaluateBanRow(row: AccountBanFields | null): AccountAccessResult {
  if (!row) return { allowed: true, expiredBan: false };

  if (row.account_status === 'banned') {
    const permanent = !!row.ban_is_permanent;
    const until = row.banned_until ? new Date(row.banned_until) : null;
    const expired = !permanent && until !== null && until.getTime() <= Date.now();
    if (expired) return { allowed: true, expiredBan: true };
    const reasonSuffix = row.ban_reason ? ` Sebep: ${row.ban_reason}` : '';
    const message = permanent
      ? `Hesabınız kalıcı olarak yasaklanmıştır.${reasonSuffix}`
      : `Hesabınız ${formatDate(until!)} tarihine kadar askıya alınmıştır.${reasonSuffix}`;
    return { allowed: false, expiredBan: false, message };
  }

  if (row.account_status === 'inactive') {
    return {
      allowed: false,
      expiredBan: false,
      message: 'Hesabınız şu anda pasif durumda. Aktif hale getirilmesi için destek ile iletişime geçin.',
    };
  }

  return { allowed: true, expiredBan: false };
}
