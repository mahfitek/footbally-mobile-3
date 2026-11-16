import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSahadanMessages,
  sahadanPreview,
  sahadanSenderRoute,
  withoutUnverifiedMedia,
  SAHADAN_PREVIEW_COUNT,
  type SahadanMessage,
} from '../lib/sahadan';

const ME = 'me-1';
const msg = (id: string, sender: string, over: Partial<SahadanMessage> = {}): SahadanMessage => ({
  id,
  sender_id: sender,
  content: `m-${id}`,
  media_url: null,
  media_type: null,
  created_at: '2026-11-16T10:00:00Z',
  ...over,
});

test('messages from blocked users are hidden, my own are always shown', () => {
  const rows = [msg('1', ME), msg('2', 'blocked'), msg('3', 'other')];
  const out = filterSahadanMessages(rows, new Set(['blocked', ME]), ME);
  assert.deepEqual(out.map((m) => m.id), ['1', '3'], 'my own message stays even if my id is in the set');
});

test('the preview keeps the newest messages in chronological order', () => {
  const rows = Array.from({ length: 8 }, (_, i) => msg(String(i + 1), 'a'));
  const preview = sahadanPreview(rows);
  assert.equal(preview.length, SAHADAN_PREVIEW_COUNT);
  assert.deepEqual(preview.map((m) => m.id), ['4', '5', '6', '7', '8']);
  assert.deepEqual(sahadanPreview([msg('1', 'a')]).map((m) => m.id), ['1']);
  assert.deepEqual(sahadanPreview([]), []);
});

test('unverified media is removed; media-only messages are dropped entirely', () => {
  const rows = [
    msg('text', 'a'),
    msg('mixed', 'a', { media_url: 'https://x/p.jpg', media_type: 'image' }),
    msg('mediaOnly', 'a', { content: null, media_url: 'https://x/v.mp4', media_type: 'video' }),
  ];
  const out = withoutUnverifiedMedia(rows);
  assert.deepEqual(out.map((m) => m.id), ['text', 'mixed']);
  const mixed = out.find((m) => m.id === 'mixed')!;
  assert.equal(mixed.media_url, null);
  assert.equal(mixed.media_type, null);
  assert.equal(mixed.content, 'm-mixed', 'text is kept');
});

test('a sender opens a player profile or a team profile by its user id', () => {
  assert.deepEqual(sahadanSenderRoute('player', 'u-1'), { screen: 'profile', params: { userId: 'u-1' } });
  assert.deepEqual(sahadanSenderRoute('team', 'owner-7'), { screen: 'teamProfile', params: { userId: 'owner-7' } });
});
