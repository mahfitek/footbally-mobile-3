/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchManagedTeams, mergeManagedTeams } from '../lib/managedTeams';

const FALLBACK = 'Takım';
const OWNED_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const MANAGED_ID = 'aaaaaaaa-0000-0000-0000-000000000002';

test('a team the user owns and manages is listed once, as owner', () => {
  const merged = mergeManagedTeams(
    [{ id: OWNED_ID, name: 'Yıldız FC' }],
    [{ id: OWNED_ID, name: 'Yıldız FC' }],
    FALLBACK,
  );
  assert.deepEqual(merged, [{ id: OWNED_ID, name: 'Yıldız FC', relation: 'owner' }]);
});

test('managed teams are sorted by name and a blank name gets the fallback', () => {
  const merged = mergeManagedTeams(
    [{ id: OWNED_ID, name: '  Zeta ' }],
    [{ id: MANAGED_ID, name: null }, { id: 'x', name: 'Alfa' }],
    FALLBACK,
  );
  assert.deepEqual(
    merged.map((team) => [team.name, team.relation]),
    [['Alfa', 'manager'], [FALLBACK, 'manager'], ['Zeta', 'owner']],
  );
});

type Reply = { data?: unknown; error?: { code?: string; message?: string } | null };

// Sorgu türüne göre yanıt veren sahte istemci. `in` filtreli sorgu (ad okuma) ayrı yanıt alır.
function fakeClient(replies: { owned?: Reply; adminRows?: Reply; namedTeams?: Reply }) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => {
      const state: { table: string; filtered: string[] } = { table, filtered: [] };
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (col: string, value: unknown) => {
        state.filtered.push(`${col}=${String(value)}`);
        return builder;
      };
      builder.in = (col: string) => {
        state.filtered.push(`${col} in`);
        return builder;
      };
      // Zincir await edildiğinde yanıt seçilir.
      builder.then = (resolve: (value: unknown) => unknown) => {
        calls.push(`${table}:${state.filtered.join(',')}`);
        let reply: Reply = {};
        if (table === 'teams' && state.filtered.some((f) => f.endsWith(' in'))) reply = replies.namedTeams ?? {};
        else if (table === 'teams') reply = replies.owned ?? {};
        else if (table === 'team_members') reply = replies.adminRows ?? {};
        return resolve({ data: reply.data ?? [], error: reply.error ?? null });
      };
      return builder;
    },
  };
  return { client, calls };
}

test('fetchManagedTeams merges owned teams with admin teams and names only the admin-only ids', async () => {
  const { client, calls } = fakeClient({
    owned: { data: [{ id: OWNED_ID, name: 'Yıldız FC' }] },
    adminRows: { data: [{ team_id: MANAGED_ID }] },
    namedTeams: { data: [{ id: MANAGED_ID, name: 'Şahin FK' }] },
  });
  const result = await fetchManagedTeams(client, 'user-1', FALLBACK);
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.teams.map((team) => [team.name, team.relation]),
    [['Şahin FK', 'manager'], ['Yıldız FC', 'owner']],
  );
  assert.ok(calls.includes('team_members:user_id=user-1,role=admin'));
  assert.ok(calls.includes('teams:id in'));
});

test('no admin memberships means no extra name query', async () => {
  const { client, calls } = fakeClient({ owned: { data: [{ id: OWNED_ID, name: 'Yıldız FC' }] }, adminRows: { data: [] } });
  const result = await fetchManagedTeams(client, 'user-1', FALLBACK);
  assert.equal(result.ok, true);
  assert.equal(result.teams.length, 1);
  assert.equal(calls.some((c) => c.endsWith(' in')), false);
});

test('a failed query marks the list incomplete instead of pretending it is complete', async () => {
  const { client } = fakeClient({ owned: { error: { code: '42501', message: 'denied' } } });
  const result = await fetchManagedTeams(client, 'user-1', FALLBACK);
  assert.deepEqual(result, { teams: [], ok: false });
});
