import { supabase } from './supabase';
import { profiles } from './profiles';
import type { AccountBanFields, AccountBanLookupResult } from './accountAccessRules';

export { evaluateAccountAccess } from './accountAccessRules';
export type { AccountAccessResult, AccountBanFields, AccountBanLookup, AccountBanLookupResult } from './accountAccessRules';

/**
 * Ban/status fields of the signed-in user (contract §4.2).
 *
 * Uses get_my_account_status(), which returns only the caller's own status (team or profile). The `teams`
 * table is NOT read here: its ban columns are anon-readable until backend fix S2 lands. Any RPC error,
 * including a missing function, returns `verified: false`, which evaluateAccountAccess denies.
 * Call only with a signed-in session.
 */
export async function fetchAccountBanRow(): Promise<AccountBanLookupResult> {
  try {
    const { data, error } = await supabase.rpc('get_my_account_status');
    if (error) return { verified: false };
    const row = Array.isArray(data) ? data[0] : data;
    return { verified: true, row: row ? { ...(row as AccountBanFields), table: 'profiles' } : null };
  } catch {
    return { verified: false };
  }
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
