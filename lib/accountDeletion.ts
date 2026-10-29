import type { SupabaseClient } from '@supabase/supabase-js';

// Uygulama içi hesap silme. Sözleşme: MOBILE_BACKEND_CONTRACT.md §3.1.
//
// Edge Function `delete-account` henüz deploy edilmedi (2026-10-29). Bu yüzden:
//   - Başarı YALNIZCA sunucu açıkça { deleted: true } döndürürse kabul edilir.
//   - Fonksiyon bulunamazsa (404) 'unavailable' döner; kullanıcıya silinmiş gibi gösterilmez.
//   - Diğer tüm hatalar 'failed' olur ve kullanıcı tekrar deneyebilir.
// Kullanıcı kimliği istemciden gönderilmez; fonksiyon oturumdaki JWT'den `auth.uid()` alır.

export type AccountDeletionOutcome =
  | { status: 'deleted' }
  | { status: 'unavailable' }
  | { status: 'failed' };

interface FunctionErrorLike {
  context?: { status?: number };
}

export async function requestAccountDeletion(
  client: Pick<SupabaseClient, 'functions'>,
): Promise<AccountDeletionOutcome> {
  let result: { data: unknown; error: FunctionErrorLike | null };
  try {
    result = await client.functions.invoke('delete-account', { body: {} });
  } catch {
    return { status: 'failed' };
  }

  const { data, error } = result;
  if (error) {
    return error.context?.status === 404 ? { status: 'unavailable' } : { status: 'failed' };
  }

  const deleted = typeof data === 'object' && data !== null && (data as { deleted?: unknown }).deleted === true;
  return deleted ? { status: 'deleted' } : { status: 'failed' };
}
