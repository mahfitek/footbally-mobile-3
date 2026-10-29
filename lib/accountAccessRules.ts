// Hesap erişim kuralları (saf fonksiyonlar). Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.
// Veri çekme ve süresi dolmuş yasağı temizleme: accountAccess.ts.
import { isMissingRpc } from './reports';

export interface AccountBanFields {
  account_status: string;
  banned_until: string | null;
  ban_is_permanent: boolean | null;
  ban_reason: string | null;
}

export interface AccountBanLookup extends AccountBanFields {
  table: 'profiles' | 'teams';
}

/**
 * Doğrulanamama nedenleri. Hiçbiri kalıcı yasak anlamına gelmez; yalnızca korunan işlemler için
 * erişimin kapatıldığını ve kullanıcıya "tekrar deneyin" mesajı gösterileceğini belirtir.
 *  - network:      istek hiç ulaşmadı (çevrimdışı, DNS, bağlantı kopması)
 *  - timeout:      sunucu makul sürede yanıt vermedi
 *  - missing_rpc:  get_my_account_status fonksiyonu sunucuda yok
 *  - rpc_error:    RPC hata döndürdü (yetki, sunucu hatası vb.)
 *  - malformed:    RPC yanıtı beklenen şekilde değil; yorumlanmadan reddedilir
 */
export type AccountUnverifiedReason = 'network' | 'timeout' | 'missing_rpc' | 'rpc_error' | 'malformed';

export type AccountBanLookupResult =
  | { verified: true; row: AccountBanLookup | null }
  | { verified: false; reason: AccountUnverifiedReason };

export interface AccountAccessResult {
  allowed: boolean;
  /** false ise hesap durumu sunucudan doğrulanamadı; yasak kararı verilmedi. */
  verified: boolean;
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

/** Supabase RPC hatasını doğrulanamama nedenine çevirir. */
export function classifyAccountStatusError(error: { code?: string; message?: string }): AccountUnverifiedReason {
  if (isMissingRpc(error)) return 'missing_rpc';
  // supabase-js ağ hatalarında kod taşımaz; mesaj fetch/ağ kökenlidir.
  if (!error.code && /network|fetch|failed to|abort/i.test(error.message ?? '')) return 'network';
  return 'rpc_error';
}

/**
 * get_my_account_status yanıtını doğrular. Satır yoksa (hesap durumu kaydı olmayan kullanıcı) kısıt yoktur.
 * Satır var ama account_status metin değilse yanıt yorumlanmaz; aksi halde yasaklı bir hesap "temiz" görünebilirdi.
 */
export function parseAccountStatusRow(data: unknown): AccountBanLookupResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (row === undefined || row === null) return { verified: true, row: null };
  if (typeof row !== 'object') return { verified: false, reason: 'malformed' };

  const candidate = row as Record<string, unknown>;
  if (typeof candidate.account_status !== 'string') return { verified: false, reason: 'malformed' };

  return {
    verified: true,
    row: {
      account_status: candidate.account_status,
      banned_until: typeof candidate.banned_until === 'string' ? candidate.banned_until : null,
      ban_is_permanent: typeof candidate.ban_is_permanent === 'boolean' ? candidate.ban_is_permanent : null,
      ban_reason: typeof candidate.ban_reason === 'string' ? candidate.ban_reason : null,
      table: 'profiles',
    },
  };
}

/**
 * Fail closed for protected actions: an unverified status denies access, but never with a ban message.
 * A verified ban is shown with its reason; an expired temporary ban is allowed and flagged for clearing.
 */
export function evaluateAccountAccess(lookup: AccountBanLookupResult): AccountAccessResult {
  if (!lookup.verified) {
    const message =
      lookup.reason === 'network' || lookup.reason === 'timeout'
        ? 'Hesap durumunuz doğrulanamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
        : 'Hesap durumunuz şu anda doğrulanamadı. Lütfen daha sonra tekrar deneyin.';
    return { allowed: false, verified: false, expiredBan: false, message };
  }
  return evaluateBanRow(lookup.row);
}

function evaluateBanRow(row: AccountBanFields | null): AccountAccessResult {
  if (!row) return { allowed: true, verified: true, expiredBan: false };

  if (row.account_status === 'banned') {
    const permanent = !!row.ban_is_permanent;
    const until = row.banned_until ? new Date(row.banned_until) : null;
    const expired = !permanent && until !== null && until.getTime() <= Date.now();
    if (expired) return { allowed: true, verified: true, expiredBan: true };
    const reasonSuffix = row.ban_reason ? ` Sebep: ${row.ban_reason}` : '';
    let message: string;
    if (permanent) {
      message = `Hesabınız kalıcı olarak yasaklanmıştır.${reasonSuffix}`;
    } else if (until && !Number.isNaN(until.getTime())) {
      message = `Hesabınız ${formatDate(until)} tarihine kadar askıya alınmıştır.${reasonSuffix}`;
    } else {
      // Bitiş tarihi yoksa süre bilinmiyor; yine de yasak uygulanır.
      message = `Hesabınız askıya alınmıştır.${reasonSuffix}`;
    }
    return { allowed: false, verified: true, expiredBan: false, message };
  }

  if (row.account_status === 'inactive') {
    return {
      allowed: false,
      verified: true,
      expiredBan: false,
      message: 'Hesabınız şu anda pasif durumda. Aktif hale getirilmesi için destek ile iletişime geçin.',
    };
  }

  return { allowed: true, verified: true, expiredBan: false };
}
