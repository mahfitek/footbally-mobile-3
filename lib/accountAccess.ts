import { supabase } from './supabase';
import { profiles } from './profiles';
import {
  classifyAccountStatusError,
  evaluateAccountAccess,
  parseAccountStatusRows,
  type AccountAccessResult,
  type AccountBanLookupResult,
} from './accountAccessRules';

export { evaluateAccountAccess, mustSignOut } from './accountAccessRules';
export type {
  AccountAccessResult,
  AccountBanFields,
  AccountBanLookupResult,
  AccountSubjectRow,
  AccountSubjectType,
  AccountUnverifiedReason,
} from './accountAccessRules';

// Açılışta ağ yavaşsa kullanıcı sonsuza kadar splash'te beklemesin; süre dolunca doğrulanamadı sayılır.
const ACCOUNT_STATUS_TIMEOUT_MS = 6000;

/**
 * Oturum açan kullanıcının hesap durumu (get_my_account_status, v1).
 *
 * Yanıt profil satırı (`source = 'profile'`) ve sahip olunan takım satırlarını içerir; sıra garanti değildir.
 * Her başarısız durum doğrulanamadı olarak döner ve yasak olarak yorumlanmaz. Tanı için yalnızca nedeni, HTTP
 * durumunu ve satır sayılarını loglar; kullanıcı kimliği, e-posta ya da yanıt içeriği loglanmaz.
 *
 * TODO(v2): get_my_account_status_v2 canlıya çıkınca tercih edilecek; şimdilik yalnızca v1 kullanılır.
 */
export async function fetchAccountBanRow(userId: string): Promise<AccountBanLookupResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AccountBanLookupResult>((resolve) => {
    timer = setTimeout(() => resolve({ verified: false, reason: 'timeout' }), ACCOUNT_STATUS_TIMEOUT_MS);
  });
  const lookup = (async (): Promise<AccountBanLookupResult> => {
    let response: Awaited<ReturnType<typeof supabase.rpc>>;
    try {
      response = await supabase.rpc('get_my_account_status');
    } catch {
      // Yalnızca istemci çağrısının kendisi fırlatırsa ağ hatası sayılır; ayrıştırma hataları burada değil.
      return { verified: false, reason: 'network' };
    }
    const { data, error, status } = response;
    if (error) {
      return { verified: false, reason: classifyAccountStatusError(error), httpStatus: status, detail: `code=${error.code ?? 'none'}` };
    }
    const parsed = parseAccountStatusRows(data, userId);
    return parsed.verified ? parsed : { ...parsed, httpStatus: status };
  })();
  try {
    const result = await Promise.race([lookup, timeout]);
    if (!result.verified) {
      // Tanı: yalnızca neden, HTTP durumu ve sayılar. Kişisel veri yok.
      console.warn(`[account-status] unverified reason=${result.reason} http=${result.httpStatus ?? 'n/a'} ${result.detail ?? ''}`.trim());
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}

/** Oturum açan kullanıcının erişim kararı: ban kontrolü + doğrulama durumu. */
export async function checkAccountAccess(userId: string): Promise<AccountAccessResult> {
  return evaluateAccountAccess(await fetchAccountBanRow(userId));
}

/**
 * Süresi dolmuş geçici profil yasağını temizler (yalnızca sunucu RPC'si ban kolonlarını değiştirir).
 *
 * Takım: istemci `teams` ban kolonlarını YAZMAZ. Aksi halde yasaklı bir takım sahibi, RLS izin verirse
 * kendi yasağını kaldırabilirdi. Süresi dolmuş yasak zaten evaluateAccountAccess ile izin verilir.
 * Takım için sunucu RPC'si MOBILE_BACKEND_CONTRACT.md §4.2'de istenmiştir.
 */
export async function clearExpiredBan(): Promise<void> {
  await profiles.clearExpiredBan();
}
