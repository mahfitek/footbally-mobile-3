/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPremiumQueries, INACTIVE_PREMIUM } from '../lib/premiumQueries';

// Sahte istemci: zincirdeki çağrıları kaydeder, sonunda verilen sonucu döndürür.
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: { table: string; chain: string[] }[] = [];
  const client = {
    from: (table: string) => {
      const chain: string[] = [];
      calls.push({ table, chain });
      const node: Record<string, unknown> = {};
      for (const name of ['select', 'eq', 'ilike', 'gt', 'order', 'limit']) {
        node[name] = (...args: unknown[]) => {
          chain.push(`${name}(${JSON.stringify(args)})`);
          return node;
        };
      }
      node.maybeSingle = () => {
        chain.push('maybeSingle()');
        return Promise.resolve(result);
      };
      return node;
    },
  };
  return { client, calls };
}

const NOW = new Date('2026-11-01T10:00:00.000Z');

test('premium status is read from subscriptions only, never from auth metadata', async () => {
  const { client, calls } = fakeClient({ data: null, error: null });
  await createPremiumQueries(client as any).fetchPremiumStatus('u1', NOW);
  assert.equal(calls[0].table, 'subscriptions');
});

test('premium query matches only Active rows that have not expired yet', async () => {
  const { client, calls } = fakeClient({ data: null, error: null });
  await createPremiumQueries(client as any).fetchPremiumStatus('u1', NOW);
  assert.deepEqual(calls[0].chain, [
    'select(["status, expires_at"])',
    'eq(["user_id","u1"])',
    'ilike(["status","active"])',
    `gt(["expires_at","${NOW.toISOString()}"])`,
    'order(["expires_at",{"ascending":false}])',
    'limit([1])',
    'maybeSingle()',
  ]);
});

test('no matching subscription means not premium', async () => {
  const { client } = fakeClient({ data: null, error: null });
  const status = await createPremiumQueries(client as any).fetchPremiumStatus('u1', NOW);
  assert.deepEqual(status, INACTIVE_PREMIUM);
});

test('a matching subscription returns its expiry date', async () => {
  const until = '2026-12-01T00:00:00.000Z';
  const { client } = fakeClient({ data: { status: 'Active', expires_at: until }, error: null });
  const status = await createPremiumQueries(client as any).fetchPremiumStatus('u1', NOW);
  assert.deepEqual(status, { active: true, until });
});

test('query errors propagate so callers can fall back to inactive', async () => {
  const { client } = fakeClient({ data: null, error: new Error('network') });
  await assert.rejects(createPremiumQueries(client as any).fetchPremiumStatus('u1', NOW));
});
