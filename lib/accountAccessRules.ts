// Hesap erişim kuralları (saf fonksiyonlar). Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.
// Veri çekme ve süresi dolmuş yasağı temizleme: accountAccess.ts.
// Mesajlar burada metin olarak tutulmaz: yapısal veri döner, renderAccountMessage dilde çevirir.
import { isMissingRpc } from './reports';
import { t as translate, type Lang, type TranslationKey } from './i18n';

export interface AccountBanFields {
  account_status: string;
  banned_until: string | null;
  ban_is_permanent: boolean | null;
  ban_reason: string | null;
}

export type AccountSubjectType = 'profile' | 'team';

/**
 * Canlı get_my_account_status satırının (source, account_status, banned_until, ban_is_permanent, ban_reason)
 * ve eski şeklin (subject_type, subject_id, ...) ortak temsili. Satırın tipi hangi alanla geldiyse ondan okunur.
 *  - subject_type: 'profile' (kullanıcının kendi profili) veya 'team' (sahip olunan takım)
 *  - subject_id:   canlı RPC döndürmez (null); eski şekilde profilde auth kullanıcı id'si, takımda takım id'si
 */
export interface AccountSubjectRow extends AccountBanFields {
  subject_type: AccountSubjectType;
  subject_id: string | null;
}

/**
 * Doğrulanamama nedenleri. Hiçbiri kalıcı yasak anlamına gelmez; oturumu kapatmaz, yalnızca korunan yazma
 * işlemlerini kapatır ve kullanıcıya yeniden deneme sunulur.
 *  - network:      istek hiç ulaşmadı (çevrimdışı, DNS, bağlantı kopması)
 *  - timeout:      sunucu makul sürede yanıt vermedi
 *  - missing_rpc:  get_my_account_status fonksiyonu sunucuda yok
 *  - permission_denied: RPC yetki hatası verdi (42501 / permission denied)
 *  - rpc_error:    RPC diğer bir hata döndürdü (sunucu hatası vb.)
 *  - no_profile:   RPC başarılı yanıt verdi ama kullanıcının profil satırı yok
 *  - malformed:    yanıt bozuk, tanınmayan satır içeriyor veya kimliği eşleşmiyor
 */
export type AccountUnverifiedReason =
  | 'network'
  | 'timeout'
  | 'missing_rpc'
  | 'permission_denied'
  | 'rpc_error'
  | 'no_profile'
  | 'malformed';

export type AccountBanLookupResult =
  | { verified: true; profile: AccountBanFields; teams: AccountSubjectRow[] }
  | {
      verified: false;
      reason: AccountUnverifiedReason;
      /** Kişisel veri içermeyen tanı özeti (ör. "rows=0"); loglara yazılabilir. */
      detail?: string;
      httpStatus?: number;
    };

/**
 * Kullanıcıya gösterilecek hesap mesajı. Metin değil veri: dil, render anında (renderAccountMessage) seçilir;
 * böylece Ayarlar'da dil değiştiğinde mesaj da değişir.
 */
export type AccountMessage =
  | { kind: 'unverified'; reason: AccountUnverifiedReason }
  | {
      kind: 'ban';
      subject: 'account' | 'team';
      /** permanent: kalıcı; until: bitiş tarihi (ISO); indefinite: süre bilinmiyor. */
      ban: 'permanent' | 'until' | 'indefinite';
      until?: string;
      reason?: string | null;
    }
  | { kind: 'inactive' };

export interface AccountAccessResult {
  /**
   * Kişisel oturum devam edebilir mi. Yalnızca doğrulanmış kişisel yasak ya da pasiflik false yapar.
   * Doğrulanamama oturumu kapatmaz; ekranlar okunabilir kalır.
   */
  allowed: boolean;
  /** Profil gibi korumalı yazma işlemleri için doğrulanmış temiz durum gerekir. */
  profileWriteAllowed: boolean;
  /** Takım yazma işlemleri: doğrulanmış temiz durum VE aktif takım yasağı yok. */
  teamWriteAllowed: boolean;
  /** false ise hesap durumu sunucudan doğrulanamadı; yasak kararı verilmedi. */
  verified: boolean;
  unverifiedReason?: AccountUnverifiedReason;
  /** Profil satırındaki süresi dolmuş geçici yasak; sunucuda temizlenmesi gerekir. */
  expiredBan: boolean;
  message?: AccountMessage;
  /** Sahip olunan takımlardan en az biri aktif olarak yasaklı. Kişisel oturumu kapatmaz; takım işlemlerini kısıtlar. */
  teamRestricted: boolean;
  teamMessage?: AccountMessage;
}

// Formatted manually (not toLocaleDateString) so the output is guaranteed
// regardless of whether the device's Hermes build includes full ICU data.
function formatDate(d: Date, lang: Lang): string {
  const monthKeys: TranslationKey[] = [
    'accountMsg_month1', 'accountMsg_month2', 'accountMsg_month3', 'accountMsg_month4',
    'accountMsg_month5', 'accountMsg_month6', 'accountMsg_month7', 'accountMsg_month8',
    'accountMsg_month9', 'accountMsg_month10', 'accountMsg_month11', 'accountMsg_month12',
  ];
  const month = translate(monthKeys[d.getMonth()], lang);
  return lang === 'en'
    ? `${month} ${d.getDate()}, ${d.getFullYear()}`
    : `${d.getDate()} ${month} ${d.getFullYear()}`;
}

/** Hesap mesajını seçilen dile çevirir. Mesaj yoksa undefined döner. */
export function renderAccountMessage(message: AccountMessage | undefined, lang: Lang): string | undefined {
  if (!message) return undefined;
  if (message.kind === 'inactive') return translate('accountMsg_inactive', lang);
  if (message.kind === 'unverified') {
    const keys = {
      network: 'accountMsg_unverifiedNetwork',
      timeout: 'accountMsg_unverifiedTimeout',
      missing_rpc: 'accountMsg_unverifiedMissingRpc',
      permission_denied: 'accountMsg_unverifiedPermission',
      rpc_error: 'accountMsg_unverifiedRpc',
      no_profile: 'accountMsg_unverifiedNoProfile',
      malformed: 'accountMsg_unverifiedMalformed',
    } as const;
    return translate(keys[message.reason], lang);
  }
  const subject = translate(message.subject === 'team' ? 'accountMsg_subjectTeam' : 'accountMsg_subjectAccount', lang);
  let text: string;
  if (message.ban === 'permanent') {
    text = translate('accountMsg_banPermanent', lang).replace('{subject}', subject);
  } else if (message.ban === 'until' && message.until) {
    text = translate('accountMsg_banUntil', lang)
      .replace('{subject}', subject)
      .replace('{date}', formatDate(new Date(message.until), lang));
  } else {
    text = translate('accountMsg_banIndefinite', lang).replace('{subject}', subject);
  }
  if (message.reason) text += ` ${translate('accountMsg_reason', lang).replace('{reason}', message.reason)}`;
  return text;
}

export interface StatusRpcResponse {
  data: unknown;
  error: { code?: string; message?: string } | null;
  status?: number;
}

/**
 * Hesap durumu RPC'si: önce v2 (takım satırlarında team_id), canlıda yoksa (PGRST202 / 42883) v1.
 * Diğer hatalar v1'e düşmez; doğrulanamadı olarak yorumlanır. Supabase'e bağımlı değildir (çağrıcı verilir).
 */
export async function callAccountStatusRpc(
  callRpc: (fn: string) => PromiseLike<StatusRpcResponse>,
): Promise<StatusRpcResponse> {
  const first = await callRpc('get_my_account_status_v2');
  if (first.error && isMissingRpc(first.error)) return callRpc('get_my_account_status');
  return first;
}

/** Supabase RPC hatasını doğrulanamama nedenine çevirir. */
export function classifyAccountStatusError(error: { code?: string; message?: string }): AccountUnverifiedReason {
  if (isMissingRpc(error)) return 'missing_rpc';
  // supabase-js ağ hatalarında kod taşımaz; mesaj fetch/ağ kökenlidir.
  if (!error.code && /network|fetch|failed to|abort/i.test(error.message ?? '')) return 'network';
  // 42501 = insufficient_privilege; PostgREST da yetkisiz çağrıda "permission denied" döner.
  if (error.code === '42501' || /permission denied/i.test(error.message ?? '')) return 'permission_denied';
  return 'rpc_error';
}

/** Satırın tipi: canlı RPC `source`, eski şekil `subject_type` kullanır. İkisi de varsa aynı olmalıdır. */
function readSubjectType(candidate: Record<string, unknown>): AccountSubjectType | null {
  const { source, subject_type: legacyType } = candidate;
  const isKnown = (value: unknown): value is AccountSubjectType => value === 'profile' || value === 'team';
  if (source !== undefined && !isKnown(source)) return null;
  if (legacyType !== undefined && !isKnown(legacyType)) return null;
  if (source !== undefined && legacyType !== undefined && source !== legacyType) return null;
  return source ?? legacyType ?? null;
}

function parseSubjectRow(raw: unknown): AccountSubjectRow | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.account_status !== 'string') return null;
  const subjectType = readSubjectType(candidate);
  if (subjectType === null) return null;
  // Canlı RPC subject_id döndürmez (null). Varsa boş olmayan metin olmalıdır.
  const { subject_id: subjectId } = candidate;
  if (subjectId !== undefined && subjectId !== null && (typeof subjectId !== 'string' || subjectId.length === 0)) return null;
  return {
    subject_type: subjectType,
    subject_id: typeof subjectId === 'string' ? subjectId : null,
    account_status: candidate.account_status,
    banned_until: typeof candidate.banned_until === 'string' ? candidate.banned_until : null,
    ban_is_permanent: typeof candidate.ban_is_permanent === 'boolean' ? candidate.ban_is_permanent : null,
    ban_reason: typeof candidate.ban_reason === 'string' ? candidate.ban_reason : null,
  };
}

/**
 * get_my_account_status yanıtını doğrular.
 *  - Null ya da nesne olmayan yanıt: malformed (bozuk yanıt).
 *  - Tanınmayan, eksik ya da çelişkili satır: malformed.
 *  - Geçerli satırlar ama hiç profil satırı yok: no_profile (profil eksik, yanıt sağlam).
 *  - Birden çok profil satırı, başka kullanıcıya ait profil satırı: malformed.
 *  - Tam bir profil satırı: doğrulanmış. Takım satırları takım kısıtlamasıdır; kişisel oturumu kapatmaz.
 *  - Sıra anlamsızdır; ilk satır tek başına karar değildir.
 */
export function parseAccountStatusRows(data: unknown, userId: string): AccountBanLookupResult {
  if (data === null || typeof data !== 'object') return { verified: false, reason: 'malformed', detail: 'payload=invalid' };
  const rows: unknown[] = Array.isArray(data) ? data : [data];

  let profile: AccountBanFields | null = null;
  let profileRows = 0;
  const teams: AccountSubjectRow[] = [];

  for (const raw of rows) {
    const row = parseSubjectRow(raw);
    if (!row) return { verified: false, reason: 'malformed', detail: `rows=${rows.length} row=invalid` };
    if (row.subject_type === 'profile') {
      // Başka bir kullanıcının profil satırı asla bu kullanıcının kararına girmez.
      if (row.subject_id !== null && row.subject_id !== userId) {
        return { verified: false, reason: 'malformed', detail: 'profile_owner=mismatch' };
      }
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

  if (profileRows > 1) return { verified: false, reason: 'malformed', detail: `profile_rows=${profileRows}` };
  if (profileRows === 0) {
    return { verified: false, reason: 'no_profile', detail: `rows=${rows.length} team=${teams.length}` };
  }
  return { verified: true, profile: profile as AccountBanFields, teams };
}

/**
 * Hesap durumu kararı.
 *  - Doğrulanmış kişisel yasak ya da pasiflik: oturum kapatılır (allowed false). Yasak mesajı yalnızca burada gösterilir.
 *  - Doğrulanamama: oturum açık kalır, korunan yazmalar kapalıdır. Yasak mesajı ASLA gösterilmez.
 *  - Takım yasağı kişisel oturumu kapatmaz; takım yazmalarını kapatır.
 */
export function evaluateAccountAccess(lookup: AccountBanLookupResult): AccountAccessResult {
  if (!lookup.verified) {
    // Her neden ayrı mesaj alır; hiçbiri yasak anlamına gelmez (bkz. renderAccountMessage).
    return {
      allowed: true,
      profileWriteAllowed: false,
      teamWriteAllowed: false,
      verified: false,
      unverifiedReason: lookup.reason,
      expiredBan: false,
      teamRestricted: false,
      message: { kind: 'unverified', reason: lookup.reason },
    };
  }

  const profileAccess = evaluateBanFields(lookup.profile);
  const activeTeamBan = lookup.teams.find((team) => isActiveBan(team));
  const teamRestricted = !!activeTeamBan;
  return {
    ...profileAccess,
    profileWriteAllowed: profileAccess.allowed,
    teamWriteAllowed: profileAccess.allowed && !teamRestricted,
    teamRestricted,
    // Hangi takım olduğu RPC'de yok; mesaj belirli bir takım adı iddia etmez.
    teamMessage: activeTeamBan ? banMessage(activeTeamBan, 'team') : undefined,
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

function banMessage(row: AccountBanFields, subject: 'account' | 'team'): AccountMessage {
  const reason = row.ban_reason ?? null;
  if (row.ban_is_permanent) return { kind: 'ban', subject, ban: 'permanent', reason };
  const until = row.banned_until ? new Date(row.banned_until) : null;
  if (until && !Number.isNaN(until.getTime())) {
    return { kind: 'ban', subject, ban: 'until', until: until.toISOString(), reason };
  }
  // Bitiş tarihi yoksa süre bilinmiyor; yine de yasak uygulanır.
  return { kind: 'ban', subject, ban: 'indefinite', reason };
}

function evaluateBanFields(row: AccountBanFields): Pick<AccountAccessResult, 'allowed' | 'verified' | 'expiredBan' | 'message'> {
  if (row.account_status === 'banned') {
    if (!isActiveBan(row)) return { allowed: true, verified: true, expiredBan: true };
    return { allowed: false, verified: true, expiredBan: false, message: banMessage(row, 'account') };
  }

  if (row.account_status === 'inactive') {
    return { allowed: false, verified: true, expiredBan: false, message: { kind: 'inactive' } };
  }

  return { allowed: true, verified: true, expiredBan: false };
}

/** Oturumu kapatmayı gerektiren doğrulanmış durum: kişisel yasak ya da pasiflik. Doğrulanamama buna dahil değildir. */
export function mustSignOut(access: AccountAccessResult): boolean {
  return access.verified && !access.allowed;
}
