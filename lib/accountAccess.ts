import { supabase } from './supabase';
import { profiles } from './profiles';

export interface AccountBanFields {
  account_status: string;
  banned_until: string | null;
  ban_is_permanent: boolean | null;
  ban_reason: string | null;
}

export interface AccountBanLookup extends AccountBanFields {
  table: 'profiles' | 'teams';
}

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

export function evaluateAccountAccess(row: AccountBanFields | null | undefined): AccountAccessResult {
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

/**
 * Looks up ban/status fields for the signed-in user's profile row, falling back to their team row (owner_id).
 * `userId` must be the signed-in user: ban fields of other users are not readable from the client.
 */
export async function fetchAccountBanRow(userId: string): Promise<AccountBanLookup | null> {
  const { data: profileRow } = await profiles.ownProfile('account_status, banned_until, ban_is_permanent, ban_reason');
  if (profileRow) return { ...(profileRow as AccountBanFields), table: 'profiles' };

  const { data: teamRow } = await supabase
    .from('teams')
    .select('account_status,banned_until,ban_is_permanent,ban_reason')
    .eq('owner_id', userId)
    .maybeSingle();
  if (teamRow) return { ...(teamRow as AccountBanFields), table: 'teams' };

  return null;
}

/** Self-heals a lapsed temporary ban back to active status. */
export async function clearExpiredBan(userId: string, table: 'profiles' | 'teams'): Promise<void> {
  if (table === 'profiles') {
    // Ban alanlarını istemci doğrudan yazmaz; sunucu fonksiyonu yalnızca süresi dolmuş yasağı temizler.
    await profiles.clearExpiredBan();
    return;
  }
  await supabase
    .from(table)
    .update({
      account_status: 'active',
      banned_until: null,
      ban_is_permanent: false,
      ban_reason: null,
      banned_by: null,
      banned_at: null,
    })
    .eq('owner_id', userId);
}
