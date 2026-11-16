import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockedRowRoute,
  fetchMyBlockedUsers,
  normalizeBlockedRow,
  sortNewestBlockedFirst,
  visibleBlockedRows,
  type BlockedUserRow,
} from '../lib/blockedUsers';

const row = (id: string, blockedAt: string, over: Partial<BlockedUserRow> = {}): BlockedUserRow => ({
  user_id: id,
  full_name: `Oyuncu ${id}`,
  avatar_url: null,
  team_name: null,
  blocked_at: blockedAt,
  ...over,
});

test('a server row without a user id or a date is dropped; blank names become null', () => {
  assert.equal(normalizeBlockedRow({ full_name: 'x', blocked_at: '2026-11-01T00:00:00Z' }), null);
  assert.equal(normalizeBlockedRow({ user_id: 'u1' }), null);
  assert.equal(normalizeBlockedRow(null), null);
  assert.deepEqual(
    normalizeBlockedRow({ user_id: 'u1', full_name: '   ', avatar_url: '', team_name: null, blocked_at: '2026-11-01T00:00:00Z' }),
    { user_id: 'u1', full_name: null, avatar_url: null, team_name: null, blocked_at: '2026-11-01T00:00:00Z' },
  );
});

test('the list is newest first, with a stable tie-break on user id', () => {
  const out = sortNewestBlockedFirst([
    row('b', '2026-11-01T10:00:00Z'),
    row('a', '2026-11-05T10:00:00Z'),
    row('c', '2026-11-01T10:00:00Z'),
  ]);
  assert.deepEqual(out.map((r) => r.user_id), ['a', 'b', 'c']);
});

test('an unblocked row disappears at once when the shared block list no longer holds it', () => {
  const rows = [row('a', '2026-11-05T00:00:00Z'), row('b', '2026-11-04T00:00:00Z')];
  assert.deepEqual(visibleBlockedRows(rows, new Set(['a'])).map((r) => r.user_id), ['a']);
});

test('while the shared list is unknown the rows are shown as the server returned them', () => {
  const rows = [row('a', '2026-11-05T00:00:00Z')];
  assert.deepEqual(visibleBlockedRows(rows, null), rows);
});

test('fetch returns the rows newest first and maps malformed rows away', async () => {
  const client = {
    rpc: async (fn: string) => {
      assert.equal(fn, 'get_my_blocked_users');
      return {
        data: [
          { user_id: 'old', full_name: 'Eski', avatar_url: null, team_name: null, blocked_at: '2026-11-01T00:00:00Z' },
          { full_name: 'no id', blocked_at: '2026-11-09T00:00:00Z' },
          { user_id: 'new', full_name: null, avatar_url: null, team_name: 'Team N', blocked_at: '2026-11-08T00:00:00Z' },
        ],
        error: null,
      };
    },
  };
  const out = await fetchMyBlockedUsers(client);
  assert.equal(out.ok, true);
  if (out.ok) assert.deepEqual(out.rows.map((r) => r.user_id), ['new', 'old']);
});

test('a failed read is reported as failed, not as an empty list', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'denied' } }) };
  assert.deepEqual(await fetchMyBlockedUsers(client), { ok: false });
});

test('a non-array payload is treated as a failed read', async () => {
  const client = { rpc: async () => ({ data: { unexpected: true }, error: null }) };
  assert.deepEqual(await fetchMyBlockedUsers(client), { ok: false });
});

test('tapping a blocked row opens that user profile', () => {
  assert.deepEqual(blockedRowRoute(row('u-9', '2026-11-01T00:00:00Z')), {
    screen: 'profile',
    params: { userId: 'u-9' },
  });
});
