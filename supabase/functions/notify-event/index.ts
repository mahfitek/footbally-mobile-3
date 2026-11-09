// notify-event: server-side push + in-app notification dispatch.
// The client reports WHAT happened (an event kind and row references). This function:
//   1) verifies the caller's JWT,
//   2) checks in the database that the caller really performed that event,
//   3) derives recipients and text from trusted rows,
//   4) enforces idempotency and a per-user rate limit,
//   5) reads push token and preferences server-side and sends via Expo.
// service_role is used only here; it never reaches the client.
//
// NOT DEPLOYED. Requires the tables from supabase/drafts/20261028c_notify_event_support.sql.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  type EventKind,
  type NotificationContent,
  type NotifyEvent,
  type PushPrefs,
  dedupeKey,
  expoPushMessage,
  isRateLimited,
  messageForChallengeCreated,
  messageForChallengeResponded,
  messageForChat,
  messageForConnectionAccepted,
  messageForConnectionRequest,
  messageForMatchConfirmed,
  messageForMatchNewParticipant,
  messageForTeamJoined,
  parseEvent,
  pushAllowed,
} from './rules.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Messages older than this are not delivered. Chat notifications must follow a fresh insert.
const CHAT_FRESHNESS_MS = 10 * 60 * 1000;

type Delivery = { recipientId: string; rowId: string | number; content: NotificationContent };
type Outcome = 'sent' | 'duplicate' | 'failed';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function fullNameOf(userId: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('full_name').eq('user_id', userId).maybeSingle();
  return data?.full_name ?? null;
}

async function teamOf(teamId: string): Promise<{ owner_id: string | null; name: string | null } | null> {
  const { data } = await admin.from('teams').select('owner_id, name').eq('id', teamId).maybeSingle();
  return data ?? null;
}

/**
 * Confirms the actor performed the event and returns who should be notified.
 * Returns null when the database does not back the claim. Callers answer 403 without detail.
 */
async function resolveDeliveries(actorId: string, event: NotifyEvent): Promise<Delivery[] | null> {
  switch (event.kind) {
    case 'chat_message': {
      const { data: msg } = await admin
        .from('messages')
        .select('id, conversation_id, sender_user_id, created_at')
        .eq('id', event.messageId)
        .maybeSingle();
      if (!msg || msg.sender_user_id !== actorId) return null;
      if (Date.now() - new Date(msg.created_at).getTime() > CHAT_FRESHNESS_MS) return null;

      const { data: conv } = await admin
        .from('conversations')
        .select('participant_a, participant_b')
        .eq('id', msg.conversation_id)
        .maybeSingle();
      if (!conv) return null;
      const actorIsA = conv.participant_a === actorId;
      if (!actorIsA && conv.participant_b !== actorId) return null;
      const recipientId = actorIsA ? conv.participant_b : conv.participant_a;
      if (recipientId === actorId) return null;

      return [{ recipientId, rowId: msg.id, content: messageForChat(await fullNameOf(actorId)) }];
    }

    case 'connection_request': {
      if (event.targetUserId === actorId) return null;
      const { data: row } = await admin
        .from('connections')
        .select('id')
        .eq('requester_id', actorId)
        .eq('target_id', event.targetUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!row) return null;
      return [{ recipientId: event.targetUserId, rowId: row.id, content: messageForConnectionRequest(await fullNameOf(actorId)) }];
    }

    case 'connection_accepted': {
      if (event.requesterUserId === actorId) return null;
      const { data: row } = await admin
        .from('connections')
        .select('id')
        .eq('requester_id', event.requesterUserId)
        .eq('target_id', actorId)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!row) return null;
      return [{ recipientId: event.requesterUserId, rowId: row.id, content: messageForConnectionAccepted() }];
    }

    case 'match_join': {
      const { data: application } = await admin
        .from('match_applications')
        .select('id')
        .eq('match_id', event.matchId)
        .eq('user_id', actorId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!application) return null;

      const { data: match } = await admin.from('matches').select('title, creator_id').eq('id', event.matchId).maybeSingle();
      if (!match) return null;

      const deliveries: Delivery[] = [
        { recipientId: actorId, rowId: application.id, content: messageForMatchConfirmed(match.title) },
      ];
      if (match.creator_id && match.creator_id !== actorId) {
        deliveries.push({
          recipientId: match.creator_id,
          rowId: application.id,
          content: messageForMatchNewParticipant(await fullNameOf(actorId), match.title),
        });
      }
      return deliveries;
    }

    case 'team_challenge_created': {
      const challenger = await teamOf(event.challengerTeamId);
      if (!challenger || challenger.owner_id !== actorId) return null;
      const opponent = await teamOf(event.opponentTeamId);
      if (!opponent?.owner_id || opponent.owner_id === actorId) return null;

      const { data: challenge } = await admin
        .from('match_challenges')
        .select('id')
        .eq('challenger_team_id', event.challengerTeamId)
        .eq('opponent_team_id', event.opponentTeamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!challenge) return null;

      return [{
        recipientId: opponent.owner_id,
        rowId: challenge.id,
        content: messageForChallengeCreated(challenger.name, opponent.name),
      }];
    }

    case 'team_challenge_responded': {
      const { data: challenge } = await admin
        .from('match_challenges')
        .select('id, challenger_team_id, opponent_team_id, status')
        .eq('id', event.challengeId)
        .maybeSingle();
      if (!challenge || (challenge.status !== 'accepted' && challenge.status !== 'declined')) return null;

      const opponent = await teamOf(challenge.opponent_team_id);
      if (!opponent || opponent.owner_id !== actorId) return null;
      const challenger = await teamOf(challenge.challenger_team_id);
      if (!challenger?.owner_id || challenger.owner_id === actorId) return null;

      return [{
        recipientId: challenger.owner_id,
        rowId: challenge.id,
        content: messageForChallengeResponded(opponent.name, challenge.status === 'accepted'),
      }];
    }

    case 'team_joined': {
      const { data: member } = await admin
        .from('team_members')
        .select('id')
        .eq('team_id', event.teamId)
        .eq('user_id', actorId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!member) return null;

      const team = await teamOf(event.teamId);
      if (!team?.owner_id || team.owner_id === actorId) return null;

      return [{
        recipientId: team.owner_id,
        rowId: member.id,
        content: messageForTeamJoined(await fullNameOf(actorId), team.name),
      }];
    }
  }
}

async function recordFailure(dedupe: string | null, recipientId: string, stage: string, error: string): Promise<void> {
  await admin.from('notification_failures').insert({ dedupe_key: dedupe, recipient_id: recipientId, stage, error });
}

/** Sends one Expo push. Returns an error string on failure, null on success. */
async function sendExpoPush(recipientId: string, token: string, content: NotificationContent): Promise<string | null> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(expoPushMessage(token, content)),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return `http_${res.status}`;

  const payload = await res.json().catch(() => null);
  const ticket = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (ticket?.status === 'error') {
    // Stale device token: stop sending to it. The in-app notification is already stored.
    if (ticket.details?.error === 'DeviceNotRegistered') {
      await admin.from('profiles').update({ push_token: null }).eq('user_id', recipientId);
    }
    return ticket.message ?? 'expo_error';
  }
  return null;
}

async function deliver(actorId: string, kind: EventKind, d: Delivery): Promise<Outcome> {
  const key = dedupeKey(kind, d.rowId, d.recipientId);

  // 1) Claim the delivery. A unique dedupe_key makes repeated requests for the same event a no-op.
  const { data: claimed, error: claimError } = await admin
    .from('notification_events')
    .upsert(
      { dedupe_key: key, kind, actor_id: actorId, recipient_id: d.recipientId },
      { onConflict: 'dedupe_key', ignoreDuplicates: true },
    )
    .select('id');
  if (claimError) {
    await recordFailure(key, d.recipientId, 'claim', claimError.message);
    return 'failed';
  }
  if (!claimed || claimed.length === 0) return 'duplicate';

  // 2) In-app notification. Stored regardless of push preferences, as before.
  const { error: insertError } = await admin.from('notifications').insert({
    user_id: d.recipientId,
    title: d.content.title,
    body: d.content.body,
    screen: d.content.screen,
    read: false,
  });
  if (insertError) {
    // Release the claim so a later retry can deliver it.
    await admin.from('notification_events').delete().eq('dedupe_key', key);
    await recordFailure(key, d.recipientId, 'in_app', insertError.message);
    return 'failed';
  }

  // 3) Push, using the recipient's token and preferences read here, never from the client.
  const { data: prefs } = await admin
    .from('profiles')
    .select('push_token, notify_all, notify_match, notify_message, notify_scout')
    .eq('user_id', d.recipientId)
    .maybeSingle();
  const pushPrefs: PushPrefs = prefs ?? {};
  if (!pushAllowed(d.content.category, pushPrefs)) return 'sent';

  try {
    const error = await sendExpoPush(d.recipientId, pushPrefs.push_token!, d.content);
    if (error) {
      await recordFailure(key, d.recipientId, 'push', error);
      return 'failed';
    }
  } catch (err) {
    await recordFailure(key, d.recipientId, 'push', String(err));
    return 'failed';
  }
  return 'sent';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // 1) Authenticate the caller with their own JWT.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'unauthorized' });
  const { data: userData, error: authError } = await admin.auth.getUser(token);
  if (authError || !userData.user) return json(401, { error: 'unauthorized' });
  const actorId = userData.user.id;

  // 2) Validate the event shape.
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const parsed = parseEvent(body?.event);
  if (!parsed.ok) return json(400, { error: parsed.error });

  // 3) Rate limit per acting user.
  const now = Date.now();
  const [{ count: lastMinute }, { count: lastHour }] = await Promise.all([
    admin
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', actorId)
      .gte('created_at', new Date(now - 60_000).toISOString()),
    admin
      .from('notification_events')
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', actorId)
      .gte('created_at', new Date(now - 3_600_000).toISOString()),
  ]);
  if (isRateLimited(lastMinute ?? 0, lastHour ?? 0)) return json(429, { error: 'rate_limited' });

  // 4) Confirm the event against the database.
  let deliveries: Delivery[] | null;
  try {
    deliveries = await resolveDeliveries(actorId, parsed.event);
  } catch (err) {
    console.error('notify-event resolve failed:', err);
    return json(500, { error: 'resolve_failed' });
  }
  if (!deliveries || deliveries.length === 0) return json(403, { error: 'not_allowed' });

  // 5) Deliver each recipient, with idempotency per (event, row, recipient).
  const results: Outcome[] = [];
  for (const d of deliveries) {
    results.push(await deliver(actorId, parsed.event.kind, d));
  }
  return json(200, { ok: true, results });
});
