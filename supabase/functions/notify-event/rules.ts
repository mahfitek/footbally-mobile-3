// Pure decision logic for the notify-event Edge Function.
// Kept free of Deno / Supabase imports so it can be unit tested under Node (see __tests__/notifyRules.test.ts).
// The client only names WHAT happened (an event + ids). Recipients, text, and preferences are decided here
// and in index.ts from trusted database rows, never from client-supplied text or user ids.

export type Category = 'match' | 'message' | 'scout';

export type NotifyEvent =
  | { kind: 'chat_message'; messageId: number }
  | { kind: 'connection_request'; targetUserId: string }
  | { kind: 'connection_accepted'; requesterUserId: string }
  | { kind: 'match_join'; matchId: number }
  | { kind: 'team_challenge_created'; challengerTeamId: string; opponentTeamId: string }
  | { kind: 'team_challenge_responded'; challengeId: string }
  | { kind: 'team_joined'; teamId: string };

export type EventKind = NotifyEvent['kind'];

export type NotificationContent = {
  title: string;
  body: string;
  screen: string;
  category: Category;
};

export type ParseResult = { ok: true; event: NotifyEvent } | { ok: false; error: 'invalid_event' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
const isId = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

/** Validates the request body shape. Unknown kinds and malformed ids are rejected. */
export function parseEvent(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') return { ok: false, error: 'invalid_event' };
  const e = input as Record<string, unknown>;
  switch (e.kind) {
    case 'chat_message':
      return isId(e.messageId) ? { ok: true, event: { kind: 'chat_message', messageId: e.messageId } } : { ok: false, error: 'invalid_event' };
    case 'connection_request':
      return isUuid(e.targetUserId) ? { ok: true, event: { kind: 'connection_request', targetUserId: e.targetUserId } } : { ok: false, error: 'invalid_event' };
    case 'connection_accepted':
      return isUuid(e.requesterUserId) ? { ok: true, event: { kind: 'connection_accepted', requesterUserId: e.requesterUserId } } : { ok: false, error: 'invalid_event' };
    case 'match_join':
      return isId(e.matchId) ? { ok: true, event: { kind: 'match_join', matchId: e.matchId } } : { ok: false, error: 'invalid_event' };
    case 'team_challenge_created':
      return isUuid(e.challengerTeamId) && isUuid(e.opponentTeamId)
        ? { ok: true, event: { kind: 'team_challenge_created', challengerTeamId: e.challengerTeamId, opponentTeamId: e.opponentTeamId } }
        : { ok: false, error: 'invalid_event' };
    case 'team_challenge_responded':
      return isUuid(e.challengeId) ? { ok: true, event: { kind: 'team_challenge_responded', challengeId: e.challengeId } } : { ok: false, error: 'invalid_event' };
    case 'team_joined':
      return isUuid(e.teamId) ? { ok: true, event: { kind: 'team_joined', teamId: e.teamId } } : { ok: false, error: 'invalid_event' };
    default:
      return { ok: false, error: 'invalid_event' };
  }
}

// Message texts mirror the wording the app previously sent from the client (Turkish).

export const messageForChat = (senderName: string | null): NotificationContent => ({
  title: 'Yeni Mesaj',
  body: `${senderName || 'Bir kullanıcı'} sana mesaj gönderdi`,
  screen: 'chat',
  category: 'message',
});

export const messageForConnectionRequest = (requesterName: string | null): NotificationContent => ({
  title: 'Bağlantı İsteği',
  body: `${requesterName || 'Kullanıcı'} sana bağlantı isteği gönderdi`,
  screen: 'messages',
  category: 'scout',
});

export const messageForConnectionAccepted = (): NotificationContent => ({
  title: 'Bağlantı Kabul Edildi',
  body: 'Bağlantı isteğiniz kabul edildi',
  screen: 'messages',
  category: 'scout',
});

export const messageForMatchConfirmed = (matchTitle: string | null): NotificationContent => ({
  title: 'Katılım Onaylandı',
  body: `${matchTitle ?? ''} maçına katılımın onaylandı.`.trimStart(),
  screen: 'match',
  category: 'match',
});

export const messageForMatchNewParticipant = (applicantName: string | null, matchTitle: string | null): NotificationContent => ({
  title: 'Yeni Katılımcı',
  body: `${applicantName || 'Bir oyuncu'} "${matchTitle ?? ''}" maçına katıldı.`,
  screen: 'match',
  category: 'match',
});

export const messageForChallengeCreated = (challengerTeamName: string | null, opponentTeamName: string | null): NotificationContent => ({
  title: 'Yeni Maç Daveti',
  body: `${challengerTeamName ?? 'Bir takım'} takımı ${opponentTeamName ?? ''} takımına maç daveti gönderdi`,
  screen: 'teamHome',
  category: 'match',
});

export const messageForChallengeResponded = (opponentTeamName: string | null, accepted: boolean): NotificationContent => ({
  title: 'Maç Daveti Yanıtlandı',
  body: `${opponentTeamName ?? 'Takım'}${accepted ? ' maç davetini kabul etti' : ' maç davetini reddetti'}`,
  screen: 'teamHome',
  category: 'match',
});

export const messageForTeamJoined = (joinerName: string | null, teamName: string | null): NotificationContent => ({
  title: 'Takıma Katılım',
  body: `${joinerName || 'Yeni bir oyuncu'} ${teamName ?? ''} takımına katıldı`,
  screen: 'teamSquad',
  category: 'match',
});

/** Stable key for idempotency: the same event + row + recipient is delivered at most once. */
export const dedupeKey = (kind: EventKind, rowId: string | number, recipientId: string): string =>
  `${kind}:${rowId}:${recipientId}`;

// Abuse limits per acting user. Counted from notification_events (one row per delivery attempt).
export const RATE_LIMIT_PER_MINUTE = 20;
export const RATE_LIMIT_PER_HOUR = 200;

export function isRateLimited(lastMinuteCount: number, lastHourCount: number): boolean {
  return lastMinuteCount >= RATE_LIMIT_PER_MINUTE || lastHourCount >= RATE_LIMIT_PER_HOUR;
}

export type PushPrefs = {
  push_token?: string | null;
  notify_all?: boolean | null;
  notify_match?: boolean | null;
  notify_message?: boolean | null;
  notify_scout?: boolean | null;
};

/** Mirrors the preference rules the app applied on the client before sending a push. */
export function pushAllowed(category: Category, prefs: PushPrefs): boolean {
  if (!prefs.push_token) return false;
  if (prefs.notify_all === false) return false;
  if (category === 'match' && prefs.notify_match === false) return false;
  if (category === 'message' && prefs.notify_message === false) return false;
  if (category === 'scout' && prefs.notify_scout === false) return false;
  return true;
}

export function expoPushMessage(token: string, content: NotificationContent): Record<string, unknown> {
  return { to: token, title: content.title, body: content.body, data: { screen: content.screen }, sound: 'default' };
}
