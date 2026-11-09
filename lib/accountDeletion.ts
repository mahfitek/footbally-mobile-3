import type { SupabaseClient } from '@supabase/supabase-js';

// Uygulama içi hesap silme. Sözleşme: MOBILE_BACKEND_CONTRACT.md §3.1.
//
// Sunucu (canlı `delete-account`) başarıyı iki biçimde bildirebilir:
//   - { deleted: true, status } (web repo sürümü)
//   - { status: 'deleted' | 'anonymized' } (canlı sürüm, 2026-11-02 doğrulandı)
// Başarı yalnızca bu alanlardan biri açıkça dönerse kabul edilir.
//
// Diğer durumlar:
//   - 404: fonksiyon deploy edilmemiş → 'unavailable'
//   - 409 + error kodu (admin_account, owns_team): 'blocked' ve nedeni
//   - Diğer tüm hatalar: 'failed'
// Kullanıcı kimliği istemciden gönderilmez; fonksiyon oturumdaki JWT'den `auth.uid()` alır.

export type AccountDeletionBlockReason = 'admin_account' | 'owns_team';

export type AccountDeletionOutcome =
  | { status: 'deleted' }
  | { status: 'unavailable' }
  | { status: 'blocked'; reason: AccountDeletionBlockReason }
  | { status: 'failed' };

interface FunctionErrorLike {
  context?: { status?: number; json?: () => Promise<unknown> };
}

const BLOCK_REASONS: readonly AccountDeletionBlockReason[] = ['admin_account', 'owns_team'];

// supabase-js, HTTP hatalarında context olarak Response verir; gövdeden { error: <kod> } okunur.
async function readBlockReason(error: FunctionErrorLike): Promise<AccountDeletionBlockReason | null> {
  try {
    const body = (await error.context?.json?.()) as { error?: unknown } | undefined;
    return BLOCK_REASONS.find((reason) => reason === body?.error) ?? null;
  } catch {
    return null;
  }
}

function isConfirmedDeletion(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const { deleted, status } = data as { deleted?: unknown; status?: unknown };
  return deleted === true || status === 'deleted' || status === 'anonymized';
}

export async function requestAccountDeletion(
  client: Pick<SupabaseClient, 'functions'>,
): Promise<AccountDeletionOutcome> {
  let result: { data: unknown; error: FunctionErrorLike | null };
  try {
    // Canlı sürüm confirm !== "DELETE" ise 400 döner; bu alan olmadan silme başlamaz.
    result = await client.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  } catch {
    return { status: 'failed' };
  }

  const { data, error } = result;
  if (error) {
    if (error.context?.status === 404) return { status: 'unavailable' };
    if (error.context?.status === 409) {
      const reason = await readBlockReason(error);
      if (reason) return { status: 'blocked', reason };
    }
    return { status: 'failed' };
  }

  return isConfirmedDeletion(data) ? { status: 'deleted' } : { status: 'failed' };
}
