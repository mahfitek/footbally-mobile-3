// Hesap erişim kuralları (saf fonksiyonlar). Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.
// Veri çekme ve süresi dolmuş yasağı temizleme: accountAccess.ts.
import { isMissingRpc } from './reports';

export interface AccountBanFields {
  account_status: string;
  banned_until: string | null;
  ban_is_permanent: boolean | null;
  ban_reason: string | null;
}

export type AccountSubjectType = 'profile' | 'team';

/**
 * get_my_account_status satırı. Bir yanıt birden fazla satır içerebilir (profil + sahip olunan takımlar) ve
 * sırası garanti değildir; bu yüzden satırlar yalnızca tipi ve gerçek kimliğiyle eşleştirilerek okunur.
 *  - subject_type: 'profile' (kullanıcının kendi profili) veya 'team' (sahip olunan takım)
 *  - subject_id:   profil satırında auth kullanıcı id'si, takım satırında takım id'si
 */
export interface AccountSubjectRow extends AccountBanFields {
  subject_type: AccountSubjectType;
  subject_id: string;
}

/**
 * Doğrulanamama nedenleri. Hiçbiri kalıcı yasak anlamına gelmez; yalnızca korunan işlemler için
 * erişimin kapatıldığını ve kullanıcıya "tekrar deneyin" mesajı gösterileceğini belirtir.
 *  - network:      istek hiç ulaşmadı (çevrimdışı, DNS, bağlantı kopması)
 *  - timeout:      sunucu makul sürede yanıt vermedi
 *  - missing_rpc:  get_my_account_status fonksiyonu sunucuda yok
 *  - rpc_error:    RPC hata döndürdü (yetki, sunucu hatası vb.)
 *  - malformed:    RPC yanıtı beklenen şekilde değil veya bir satırın kimliği oturumdaki kullanıcıyla eşleşmiyor
 */
export type AccountUnverifiedReason = 'network' | 'timeout' | 'missing_rpc' | 'rpc_error' | 'malformed';

export type AccountBanLookupResult =
  | { verified: true; profile: AccountBanFields | null; teams: AccountSubjectRow[] }
  | { verified: false; reason: AccountUnverifiedReason };

export interface AccountAccessResult {
  /** Kişisel oturuma izin var mı. Takım yasağı bu alanı değiştirmez. */
  allowed: boolean;
  /** false ise hesap durumu sunucudan doğrulanamadı; yasak kararı verilmedi. */
  verified: boolean;
  /** Profil satırındaki süresi dolmuş geçici yasak; sunucuda temizlenmesi gerekir. */
  expiredBan: boolean;
  message?: string;
  /** Sahip olunan takımlardan en az biri aktif olarak yasaklı. Kişisel oturumu kapatmaz; takım işlemlerini kısıtlar. */
  teamRestricted: boolean;
  teamMessage?: string;
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

const MALFORMED: AccountBanLookupResult = { verified: false, reason: 'malformed' };

function parseSubjectRow(raw: unknown): AccountSubjectRow | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.account_status !== 'string') return null;
  if (candidate.subject_type !== 'profile' && candidate.subject_type !== 'team') return null;
  if (typeof candidate.subject_id !== 'string' || candidate.subject_id.length === 0) return null;
  return {
    subject_type: candidate.subject_type,
    subject_id: candidate.subject_id,
    account_status: candidate.account_status,
    banned_until: typeof candidate.banned_until === 'string' ? candidate.banned_until : null,
    ban_is_permanent: typeof candidate.ban_is_permanent === 'boolean' ? candidate.ban_is_permanent : null,
    ban_reason: typeof candidate.ban_reason === 'string' ? candidate.ban_reason : null,
  };
}

/**
 * get_my_account_status yanıtını oturumdaki kullanıcı kimliğiyle doğrular.
 *  - Yanıt bir dizi ya da tek satır olabilir; sıra anlamsızdır, ilk satır ASLA tek başına karar değildir.
 *  - Her satır tipi ve kimliğiyle okunur. Profil satırının kimliği oturumdaki kullanıcıyla eşleşmelidir.
 *  - Tanınmayan, eksik alanlı veya başka kullanıcıya ait bir satır varsa tüm yanıt doğrulanamadı sayılır.
 *  - Boş yanıt: kısıt yoktur (hesap durumu kaydı olmayan kullanıcı).
 */
export function parseAccountStatusRows(data: unknown, userId: string): AccountBanLookupResult {
  if (data === null || data === undefined) return { verified: true, profile: null, teams: [] };
  const rows: unknown[] = Array.isArray(data) ? data : [data];

  let profile: AccountBanFields | null = null;
  let profileRows = 0;
  const teams: AccountSubjectRow[] = [];

  for (const raw of rows) {
    const row = parseSubjectRow(raw);
    if (!row) return MALFORMED;
    if (row.subject_type === 'profile') {
      // Başka bir kullanıcının profil satırı asla bu kullanıcının kararına girmez.
      if (row.subject_id !== userId) return MALFORMED;
      profileRows += 1;
      profile = {
        account_status: row.account_status,
        banned_until: row.banned_until,
        ban_is_permanent: row.ban_is_permanent,
        ban_reason: row.ban_reason,
      };
    } else {
      teams.push(row);
    }
  }

  if (profileRows > 1) return MALFORMED;
  return { verified: true, profile, teams };
}

/**
 * Fail closed for protected actions: an unverified status denies access, but never with a ban message.
 * A verified profile ban is shown with its reason; an expired temporary ban is allowed and flagged for clearing.
 * A team ban restricts team actions only and never blocks the personal session.
 */
export function evaluateAccountAccess(lookup: AccountBanLookupResult): AccountAccessResult {
  if (!lookup.verified) {
    const message =
      lookup.reason === 'network' || lookup.reason === 'timeout'
        ? 'Hesap durumunuz doğrulanamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.'
        : 'Hesap durumunuz şu anda doğrulanamadı. Lütfen daha sonra tekrar deneyin.';
    return { allowed: false, verified: false, expiredBan: false, teamRestricted: false, message };
  }

  const profileAccess = evaluateBanFields(lookup.profile);
  const activeTeamBan = lookup.teams.find((team) => isActiveBan(team));
  return {
    ...profileAccess,
    teamRestricted: !!activeTeamBan,
    teamMessage: activeTeamBan ? banMessage(activeTeamBan, 'Takımınız') : undefined,
  };
}

/** Süresi dolmamış yasak (kalıcı ya da bitiş tarihi gelecekte). Durumu "banned" olmayan satır yasak değildir. */
function isActiveBan(row: AccountBanFields): boolean {
  if (row.account_status !== 'banned') return false;
  if (row.ban_is_permanent) return true;
  const until = row.banned_until ? new Date(row.banned_until) : null;
  if (until === null || Number.isNaN(until.getTime())) return true;
  return until.getTime() > Date.now();
}

function banMessage(row: AccountBanFields, subject: string): string {
  const reasonSuffix = row.ban_reason ? ` Sebep: ${row.ban_reason}` : '';
  if (row.ban_is_permanent) return `${subject} kalıcı olarak yasaklanmıştır.${reasonSuffix}`;
  const until = row.banned_until ? new Date(row.banned_until) : null;
  if (until && !Number.isNaN(until.getTime())) {
    return `${subject} ${formatDate(until)} tarihine kadar askıya alınmıştır.${reasonSuffix}`;
  }
  // Bitiş tarihi yoksa süre bilinmiyor; yine de yasak uygulanır.
  return `${subject} askıya alınmıştır.${reasonSuffix}`;
}

function evaluateBanFields(row: AccountBanFields | null): Pick<AccountAccessResult, 'allowed' | 'verified' | 'expiredBan' | 'message'> {
  if (!row) return { allowed: true, verified: true, expiredBan: false };

  if (row.account_status === 'banned') {
    if (!isActiveBan(row)) return { allowed: true, verified: true, expiredBan: true };
    return { allowed: false, verified: true, expiredBan: false, message: banMessage(row, 'Hesabınız') };
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
