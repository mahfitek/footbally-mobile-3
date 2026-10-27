/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfileQueries } from '../lib/profileQueries';

// Sahte Supabase istemcisi: çağrıları kaydeder ve sabit bir sonuç döndürür.
function fakeClient() {
  const calls: { method: string; args: unknown[]; chain: string[] }[] = [];
  const builder = (method: string, args: unknown[]) => {
    const chain: string[] = [];
    const node: Record<string, unknown> = {};
    const record = (name: string) => (...a: unknown[]) => {
      chain.push(`${name}(${JSON.stringify(a)})`);
      return node;
    };
    for (const name of ['select', 'eq', 'in', 'update', 'insert', 'maybeSingle']) {
      node[name] = record(name);
    }
    calls.push({ method, args, chain });
    return node;
  };
  const client = {
    from: (table: string) => builder(`from:${table}`, []),
    rpc: (fn: string) => builder(`rpc:${fn}`, []),
  };
  return { client, calls };
}

test('ownProfile reads the caller row through get_my_profile with explicit fields', () => {
  const { client, calls } = fakeClient();
  createProfileQueries(client as any).ownProfile('full_name, city');
  assert.equal(calls[0].method, 'rpc:get_my_profile');
  assert.deepEqual(calls[0].chain, ['select(["full_name, city"])', 'maybeSingle([])']);
});

test('publicProfile reads from profiles_public, never from profiles', () => {
  const { client, calls } = fakeClient();
  createProfileQueries(client as any).publicProfile('u1', 'user_id, full_name');
  assert.equal(calls[0].method, 'from:profiles_public');
  assert.deepEqual(calls[0].chain, [
    'select(["user_id, full_name"])',
    'eq(["user_id","u1"])',
    'maybeSingle([])',
  ]);
});

test('publicProfiles filters by the given ids on profiles_public', () => {
  const { client, calls } = fakeClient();
  createProfileQueries(client as any).publicProfiles(['a', 'b'], 'user_id');
  assert.equal(calls[0].method, 'from:profiles_public');
  assert.deepEqual(calls[0].chain, ['select(["user_id"])', 'in(["user_id",["a","b"]])']);
});

test('updateOwn only returns user_id so sensitive columns are not read back', () => {
  const { client, calls } = fakeClient();
  createProfileQueries(client as any).updateOwn('me', { city: 'Ankara' });
  assert.equal(calls[0].method, 'from:profiles');
  assert.deepEqual(calls[0].chain, [
    `update(${JSON.stringify([{ city: 'Ankara' }])})`,
    'eq(["user_id","me"])',
    'select(["user_id"])',
  ]);
});

test('clearExpiredBan goes through the RPC, not a direct ban-column update', () => {
  const { client, calls } = fakeClient();
  createProfileQueries(client as any).clearExpiredBan();
  assert.equal(calls[0].method, 'rpc:clear_my_expired_ban');
  assert.equal(calls.some((c) => c.method === 'from:profiles'), false);
});

test('insertOwn stamps the caller user_id onto the values', () => {
  const { client, calls } = fakeClient();
  createProfileQueries(client as any).insertOwn('me', { full_name: 'X', score: 0 });
  assert.equal(calls[0].method, 'from:profiles');
  assert.deepEqual(calls[0].chain, [`insert(${JSON.stringify([{ user_id: 'me', full_name: 'X', score: 0 }])})`]);
});
