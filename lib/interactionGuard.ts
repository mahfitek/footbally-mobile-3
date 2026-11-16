// Engel ve reddetme kuralları (istemci). Sunucu kuralları: 20261116110000 ve 20261116110100 migration'ları.
// Engel iki yönlüdür: ben engellediysem de beni engellediyse de etkileşim yapılamaz; kimin kimi engellediği gösterilmez.
// Saf fonksiyonlar; Supabase'e bağlı değildir (birim testi için). RPC sarmalayıcısı en altta.

export type InteractionErrorKind = 'blocked' | 'application_rejected';

type ErrorLike = { code?: string; message?: string } | null | undefined;

/** Sunucu hatası bir etkileşim engeli mi (blocked_interaction) ya da reddedilmiş başvuru mu? */
export function classifyInteractionError(error: ErrorLike): InteractionErrorKind | null {
  const message = error?.message ?? '';
  if (message.includes('blocked_interaction') || message.includes('blocked_user')) return 'blocked';
  if (message.includes('application_rejected')) return 'application_rejected';
  return null;
}

/**
 * Bir profilde etkileşim düğmelerinin durumu. blockedByMe: BEN bu kişiyi engelledim.
 * Ben engellediysem etkileşim düğmeleri pasif ve "Engeli kaldır" görünür. Beni engelleyenler için düğmeler açık kalır;
 * sunucu o etkileşimi reddeder ve tek tip mesaj gösterilir.
 */
export function interactionAvailability(blockedByMe: boolean): { canInteract: boolean; showUnblock: boolean } {
  return { canInteract: !blockedByMe, showUnblock: blockedByMe };
}

export type MatchApplicationStatus = 'applied' | 'pending' | 'accepted' | 'rejected' | string;

/** Başvuran için: reddedilmiş başvuru yeniden başvuru kabul etmez. */
export function canApplyToMatch(existingStatus: MatchApplicationStatus | null | undefined): boolean {
  return (existingStatus ?? '').toLowerCase() !== 'rejected';
}

/** İlan sahibi bir başvuruyu reddedebilir mi: ilana bağlı (match_id) ve henüz reddedilmemiş olmalı. */
export function canRejectApplication(status: MatchApplicationStatus | null | undefined, hasMatch: boolean): boolean {
  return hasMatch && (status ?? '').toLowerCase() !== 'rejected';
}

export type RejectOutcome = { ok: true; alreadyRejected: boolean } | { ok: false; reason: 'not_owner' | 'not_found' | 'not_match' | 'restricted' | 'unknown' };

/** reject_match_application RPC'si. "already_rejected" da başarıdır (ikinci bildirim yoktur). */
export async function rejectMatchApplication(
  client: { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }> },
  applicationId: number,
): Promise<RejectOutcome> {
  const { data, error } = await client.rpc('reject_match_application', { p_application_id: applicationId });
  if (!error) return { ok: true, alreadyRejected: data === 'already_rejected' };
  const message = error.message ?? '';
  if (message.includes('not_match_owner')) return { ok: false, reason: 'not_owner' };
  if (message.includes('application_not_found')) return { ok: false, reason: 'not_found' };
  if (message.includes('application_not_match')) return { ok: false, reason: 'not_match' };
  if (message.includes('account_restricted')) return { ok: false, reason: 'restricted' };
  return { ok: false, reason: 'unknown' };
}
