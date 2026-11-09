import type { SupabaseClient } from '@supabase/supabase-js';

// Kullanıcı / içerik şikâyeti. Sözleşme: MOBILE_BACKEND_CONTRACT.md §3.2.
//
// Sunucu tarafı `submit_report` RPC'si canlı şemada henüz yok (2026-10-29 OpenAPI kontrolü).
// Bu modül şikâyeti RPC üzerinden gönderir ve sonucu üç duruma ayırır:
//   - 'sent'        : sunucu kabul etti
//   - 'unavailable' : RPC sunucuda yok; kullanıcıya "şu an kullanılamıyor" denir (başarı gösterilmez)
//   - 'failed'      : ağ veya sunucu hatası; tekrar denenebilir
// Mevcut web tablolarına (profile_reports, comment_reports, content_reports) doğrudan yazılmaz:
// şemaları ve RLS kuralları web tarafına ait.

export type ReportTargetType = 'profile' | 'team' | 'post' | 'comment' | 'message';

export type ReportReason = 'harassment' | 'spam' | 'inappropriate' | 'fake' | 'other';

export const REPORT_REASONS: readonly ReportReason[] = ['harassment', 'spam', 'inappropriate', 'fake', 'other'];

export const REPORT_DETAIL_MAX = 500;

export interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  detail?: string | null;
}

export type ReportValidation =
  | { ok: true; detail: string | null }
  | { ok: false; error: 'invalid_reason' | 'detail_required' | 'detail_too_long' | 'missing_target' };

export type ReportOutcome =
  | { status: 'sent' }
  | { status: 'unavailable' }
  | { status: 'failed' }
  | { status: 'invalid'; error: Exclude<ReportValidation, { ok: true }>['error'] };

export function validateReport(input: ReportInput): ReportValidation {
  if (!input.targetId || !input.targetId.trim()) return { ok: false, error: 'missing_target' };
  if (!REPORT_REASONS.includes(input.reason)) return { ok: false, error: 'invalid_reason' };

  const detail = input.detail?.trim() ? input.detail.trim() : null;
  if (input.reason === 'other' && !detail) return { ok: false, error: 'detail_required' };
  if (detail && detail.length > REPORT_DETAIL_MAX) return { ok: false, error: 'detail_too_long' };

  return { ok: true, detail };
}

interface RpcErrorLike {
  code?: string;
  message?: string;
}

/** PostgREST, RPC bulunamadığında PGRST202 (şema önbelleği) veya 42883 (undefined_function) döner. */
export function isMissingRpc(error: RpcErrorLike): boolean {
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? '');
}

export async function submitReport(
  client: Pick<SupabaseClient, 'rpc'>,
  input: ReportInput,
): Promise<ReportOutcome> {
  const validation = validateReport(input);
  if (!validation.ok) return { status: 'invalid', error: validation.error };

  const { error } = await client.rpc('submit_report', {
    p_target_type: input.targetType,
    p_target_id: input.targetId.trim(),
    p_reason: input.reason,
    p_detail: validation.detail,
  });

  if (!error) return { status: 'sent' };
  return isMissingRpc(error) ? { status: 'unavailable' } : { status: 'failed' };
}
