import { supabase } from './supabase';
import { profiles } from './profiles';
import {
  classifyAccountStatusError,
  evaluateAccountAccess,
  parseAccountStatusRow,
  type AccountAccessResult,
  type AccountBanLookupResult,
} from './accountAccessRules';

export { evaluateAccountAccess } from './accountAccessRules';
export type { AccountAccessResult, AccountBanFields, AccountBanLookup, AccountBanLookupResult, AccountUnverifiedReason } from './accountAccessRules';

// Açılışta ağ yavaşsa kullanıcı sonsuza kadar splash'te beklemesin; süre dolunca doğrulanamadı sayılır.
const ACCOUNT_STATUS_TIMEOUT_MS = 6000;

/**
 * Ban/status fields of the signed-in user (contract §4.2).
 *
 * Uses get_my_account_status(), which returns only the caller's own status (team or profile). The `teams`
 * table is NOT read here: its ban columns are anon-readable until backend fix S2 lands.
 * Errors are classified (network, timeout, missing RPC, RPC error, malformed) and never treated as a ban.
 * Call only with a signed-in session.
 */
export async function fetchAccountBanRow(): Promise<AccountBanLookupResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AccountBanLookupResult>((resolve) => {
    timer = setTimeout(() => resolve({ verified: false, reason: 'timeout' }), ACCOUNT_STATUS_TIMEOUT_MS);
  });
  const lookup = (async (): Promise<AccountBanLookupResult> => {
    try {
      const { data, error } = await supabase.rpc('get_my_account_status');
      if (error) return { verified: false, reason: classifyAccountStatusError(error) };
      return parseAccountStatusRow(data);
    } catch {
      return { verified: false, reason: 'network' };
    }
  })();
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Oturum açan kullanıcının erişim kararı: ban kontrolü + doğrulama durumu. */
export async function checkAccountAccess(): Promise<AccountAccessResult> {
  return evaluateAccountAccess(await fetchAccountBanRow());
}

/**
 * Süresi dolmuş geçici yasağı temizler.
 *
 * Profil: yalnızca sunucu RPC'si (clear_my_expired_ban) ban kolonlarını değiştirir.
 * Takım: istemci `teams` ban kolonlarını YAZMAZ. Aksi halde yasaklı bir takım sahibi, RLS izin verirse
 * kendi yasağını kaldırabilirdi. Süresi dolmuş yasak zaten evaluateAccountAccess ile izin verilir, bu yüzden
 * yazmaya gerek yoktur. Takım için sunucu RPC'si MOBILE_BACKEND_CONTRACT.md §4'te istenmiştir.
 */
export async function clearExpiredBan(table: 'profiles' | 'teams'): Promise<void> {
  if (table === 'profiles') {
    await profiles.clearExpiredBan();
  }
}
