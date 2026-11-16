import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPlayerFilters,
  fetchBlockedUserIds,
  fetchDiscoverablePlayers,
  isTeamBlocked,
  playerProfileRoute,
  teamProfileRoute,
  type DiscoverablePlayer,
} from '../lib/discovery';
import {
  isOwnProfileView,
  visibleProfileActions,
  reportTargetFor,
  blockTargetUserId,
} from '../lib/profileActions';

const ME = 'me-0000';
const player = (id: string, over: Partial<DiscoverablePlayer> = {}): DiscoverablePlayer => ({
  user_id: id,
  full_name: `Oyuncu ${id}`,
  position: 'Defans',
  city: 'İstanbul',
  district: 'Kadıköy',
  age: 24,
  foot: 'Sağ',
  avatar_url: null,
  score: 60,
  club: null,
  ...over,
});

const NO_FILTERS = { city: '', district: '', positions: [] as string[] };

test('own profile is never listed among discoverable players', () => {
  const list = [player(ME), player('a')];
  const out = applyPlayerFilters(list, NO_FILTERS, new Set(), ME);
  assert.deepEqual(out.map((p) => p.user_id), ['a']);
});

test('blocked users are removed from the player list', () => {
  const list = [player('a'), player('b'), player('c')];
  const out = applyPlayerFilters(list, NO_FILTERS, new Set(['b']), ME);
  assert.deepEqual(out.map((p) => p.user_id), ['a', 'c']);
});

test('city, district and multi-position filters apply to real profile values', () => {
  const list = [
    player('a', { city: 'İstanbul', district: 'Kadıköy', position: 'Defans' }),
    player('b', { city: 'İstanbul', district: 'Beşiktaş', position: 'Forvet' }),
    player('c', { city: 'Ankara', district: 'Çankaya', position: 'Forvet' }),
    player('d', { city: 'İstanbul', district: 'Kadıköy', position: 'Kaleci' }),
  ];
  assert.deepEqual(
    applyPlayerFilters(list, { city: 'İstanbul', district: '', positions: [] }, new Set(), ME).map((p) => p.user_id),
    ['a', 'b', 'd'],
  );
  assert.deepEqual(
    applyPlayerFilters(list, { city: 'İstanbul', district: 'Kadıköy', positions: [] }, new Set(), ME).map((p) => p.user_id),
    ['a', 'd'],
  );
  assert.deepEqual(
    applyPlayerFilters(list, { city: '', district: '', positions: ['Forvet', 'Kaleci'] }, new Set(), ME).map((p) => p.user_id),
    ['b', 'c', 'd'],
  );
});

test('discoverable players call the server list and pass the city filter', async () => {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: [player('a')], error: null };
    },
  };
  const result = await fetchDiscoverablePlayers(client, { city: 'İzmir', limit: 50 });
  assert.equal(result.ok, true);
  assert.equal(calls[0].fn, 'list_discoverable_players');
  assert.deepEqual(calls[0].args, { p_city: 'İzmir', p_limit: 50, p_offset: 0 });
});

test('a failing server list is reported as not ok, never as an empty success', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'boom' } }) };
  assert.deepEqual(await fetchDiscoverablePlayers(client), { ok: false });
});

function blocksClient(result: { data: unknown; error: { message?: string } | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: async () => result,
      }),
    }),
  };
}

test('blocked ids are read from the viewer rows; an unreadable list yields null (fail closed)', async () => {
  const ok = await fetchBlockedUserIds(blocksClient({ data: [{ blocked_id: 'x' }, { blocked_id: null }], error: null }), ME);
  assert.deepEqual([...(ok ?? [])], ['x']);
  const failed = await fetchBlockedUserIds(blocksClient({ data: null, error: { message: 'denied' } }), ME);
  assert.equal(failed, null);
});

test('a blocked team is the one whose owner is blocked', () => {
  assert.equal(isTeamBlocked('owner-1', new Set(['owner-1'])), true);
  assert.equal(isTeamBlocked('owner-2', new Set(['owner-1'])), false);
  assert.equal(isTeamBlocked(null, new Set(['owner-1'])), false);
});

test('player and team profile routes carry the user id parameter the app expects', () => {
  assert.deepEqual(playerProfileRoute('u-1'), { screen: 'profile', params: { userId: 'u-1' } });
  assert.deepEqual(teamProfileRoute('owner-9'), { screen: 'teamProfile', params: { userId: 'owner-9' } });
});

test('own profile hides follow, report and block for players and teams alike', () => {
  assert.equal(isOwnProfileView(ME, ME), true);
  assert.deepEqual(visibleProfileActions(ME, ME), []);
  assert.deepEqual(visibleProfileActions(ME, 'other'), ['follow', 'report', 'block']);
  assert.deepEqual(visibleProfileActions(null, 'other'), [], 'no session means no actions');
});

test('report targets use profile for players and team for teams', () => {
  assert.deepEqual(reportTargetFor('player', { userId: 'u-1', name: 'Ali' }), { type: 'profile', id: 'u-1', name: 'Ali' });
  assert.deepEqual(reportTargetFor('team', { userId: 'owner-1', teamId: 'team-1', name: 'Takım' }), {
    type: 'team',
    id: 'team-1',
    name: 'Takım',
  });
  assert.equal(reportTargetFor('team', { userId: 'owner-1', teamId: null, name: 'T' }), null);
  assert.equal(blockTargetUserId('owner-1'), 'owner-1', 'blocking a team blocks its owner');
});
