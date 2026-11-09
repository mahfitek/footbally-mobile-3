/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RATE_LIMIT_PER_HOUR,
  RATE_LIMIT_PER_MINUTE,
  dedupeKey,
  expoPushMessage,
  isRateLimited,
  messageForChallengeResponded,
  messageForChat,
  messageForConnectionRequest,
  messageForMatchConfirmed,
  messageForMatchNewParticipant,
  parseEvent,
  pushAllowed,
} from '../supabase/functions/notify-event/rules';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_UUID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

test('parseEvent accepts every known event kind with well-formed ids', () => {
  const valid = [
    { kind: 'chat_message', messageId: 42 },
    { kind: 'connection_request', targetUserId: UUID },
    { kind: 'connection_accepted', requesterUserId: UUID },
    { kind: 'match_join', matchId: 7 },
    { kind: 'team_challenge_created', challengerTeamId: UUID, opponentTeamId: OTHER_UUID },
    { kind: 'team_challenge_responded', challengeId: UUID },
    { kind: 'team_joined', teamId: UUID },
  ];
  for (const event of valid) {
    assert.deepEqual(parseEvent(event), { ok: true, event });
  }
});

test('parseEvent rejects unknown kinds, malformed ids and non-object input', () => {
  const invalid: unknown[] = [
    null,
    'chat_message',
    {},
    { kind: 'send_anything', targetUserId: UUID },
    { kind: 'chat_message', messageId: '42' },
    { kind: 'chat_message', messageId: -1 },
    { kind: 'chat_message', messageId: 1.5 },
    { kind: 'connection_request', targetUserId: "1' or '1'='1" },
    { kind: 'team_joined', teamId: 'not-a-uuid' },
    { kind: 'team_challenge_created', challengerTeamId: UUID },
  ];
  for (const input of invalid) {
    assert.deepEqual(parseEvent(input), { ok: false, error: 'invalid_event' }, JSON.stringify(input));
  }
});

test('parseEvent drops client-supplied text: only ids survive parsing', () => {
  const parsed = parseEvent({ kind: 'chat_message', messageId: 5, body: 'injected text', title: 'x' });
  assert.deepEqual(parsed, { ok: true, event: { kind: 'chat_message', messageId: 5 } });
});

test('message texts keep the wording the app used before the move to the server', () => {
  assert.deepEqual(messageForChat('Ali'), { title: 'Yeni Mesaj', body: 'Ali sana mesaj gönderdi', screen: 'chat', category: 'message' });
  assert.equal(messageForChat(null).body, 'Bir kullanıcı sana mesaj gönderdi');
  assert.equal(messageForConnectionRequest(null).body, 'Kullanıcı sana bağlantı isteği gönderdi');
  assert.equal(messageForMatchConfirmed('Halı Saha').body, 'Halı Saha maçına katılımın onaylandı.');
  assert.equal(
    messageForMatchNewParticipant(null, 'Akşam Maçı').body,
    'Bir oyuncu "Akşam Maçı" maçına katıldı.',
  );
  assert.equal(
    messageForChallengeResponded('Kartal FC', true).body,
    'Kartal FC maç davetini kabul etti',
  );
  assert.equal(
    messageForChallengeResponded('Kartal FC', false).body,
    'Kartal FC maç davetini reddetti',
  );
});

test('rate limit trips at the per-minute and per-hour thresholds', () => {
  assert.equal(isRateLimited(RATE_LIMIT_PER_MINUTE - 1, 0), false);
  assert.equal(isRateLimited(RATE_LIMIT_PER_MINUTE, 0), true);
  assert.equal(isRateLimited(0, RATE_LIMIT_PER_HOUR - 1), false);
  assert.equal(isRateLimited(0, RATE_LIMIT_PER_HOUR), true);
});

test('push is only allowed with a token and no opt-out for the category', () => {
  assert.equal(pushAllowed('message', {}), false, 'no token');
  assert.equal(pushAllowed('message', { push_token: 'ExponentPushToken[a]' }), true);
  assert.equal(pushAllowed('match', { push_token: 't', notify_all: false }), false, 'global opt-out');
  assert.equal(pushAllowed('match', { push_token: 't', notify_match: false }), false);
  assert.equal(pushAllowed('match', { push_token: 't', notify_message: false }), true, 'other category unaffected');
  assert.equal(pushAllowed('message', { push_token: 't', notify_message: false }), false);
  assert.equal(pushAllowed('scout', { push_token: 't', notify_scout: false }), false);
  assert.equal(pushAllowed('scout', { push_token: 't', notify_scout: null }), true, 'null means default on');
});

test('dedupe key is stable per event, row and recipient', () => {
  const a = dedupeKey('chat_message', 10, UUID);
  assert.equal(a, dedupeKey('chat_message', 10, UUID));
  assert.notEqual(a, dedupeKey('chat_message', 10, OTHER_UUID), 'different recipient');
  assert.notEqual(a, dedupeKey('chat_message', 11, UUID), 'different row');
  assert.notEqual(a, dedupeKey('match_join', 10, UUID), 'different kind');
});

test('expo payload carries the screen for deep links and no extra fields', () => {
  const message = expoPushMessage('ExponentPushToken[a]', messageForChat('Ali'));
  assert.deepEqual(message, {
    to: 'ExponentPushToken[a]',
    title: 'Yeni Mesaj',
    body: 'Ali sana mesaj gönderdi',
    data: { screen: 'chat' },
    sound: 'default',
  });
});
