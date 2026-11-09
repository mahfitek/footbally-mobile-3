import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRpc } from './reports';

// Kullanıcı engelleme (App Store 5.1.2 / 1.2 gereği). Sözleşme: MOBILE_BACKEND_CONTRACT.md §4.3.
// Sunucu RPC'leri (block_user, unblock_user) canlıda yok. Mobil bunları çağırır; RPC yoksa
// "kullanılamıyor" döner ve engelleme yapılmış gibi gösterilmez.

export type BlockOutcome = { status: 'done' } | { status: 'unavailable' } | { status: 'failed' };

export async function blockUser(client: Pick<SupabaseClient, 'rpc'>, userId: string): Promise<BlockOutcome> {
  if (!userId.trim()) return { status: 'failed' };
  const { error } = await client.rpc('block_user', { p_user_id: userId.trim() });
  if (!error) return { status: 'done' };
  return isMissingRpc(error) ? { status: 'unavailable' } : { status: 'failed' };
}

export async function unblockUser(client: Pick<SupabaseClient, 'rpc'>, userId: string): Promise<BlockOutcome> {
  if (!userId.trim()) return { status: 'failed' };
  const { error } = await client.rpc('unblock_user', { p_user_id: userId.trim() });
  if (!error) return { status: 'done' };
  return isMissingRpc(error) ? { status: 'unavailable' } : { status: 'failed' };
}
