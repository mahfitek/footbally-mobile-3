import { supabase } from './supabase';
import { profiles } from './profiles';
import {
  classifyAccountStatusError,
  evaluateAccountAccess,
  parseAccountStatusRows,
  type AccountAccessResult,
  type AccountBanLookupResult,
} from './accountAccessRules';

export { evaluateAccountAccess } from './accountAccessRules';
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
 * Ban/status rows of the signed-in user (contract §4.2).
 *
 * Uses get_my_account_status(), which returns the caller's own profile row (`source = 'profile'`) and owned team
 * rows (`source = 'team'`) in no guaranteed order. The `teams` table is NOT read here.
 * Errors are classified (network, timeout, missing RPC, RPC error, malformed) and never treated as a ban.
 * A response that is not verified is never treated as a clean account.
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
    const { data, error } = response;
    if (error) return { verified: false, reason: classifyAccountStatusError(error) };
    return parseAccountStatusRows(data, userId);
  })();
  try {
    return await Promise.race([lookup, timeout]);
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
