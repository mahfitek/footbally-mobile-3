/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestAccountDeletion } from '../lib/accountDeletion';

function fakeFunctions(response: { data?: unknown; error?: unknown } | 'throw') {
  const calls: { name: string; options: unknown }[] = [];
  const client = {
    functions: {
      invoke: async (name: string, options: unknown) => {
        calls.push({ name, options });
        if (response === 'throw') throw new Error('network down');
        return { data: response.data ?? null, error: response.error ?? null };
      },
    },
  };
  return { client: client as never, calls };
}

test('deletion is reported as success only when the server confirms it', async () => {
  const { client, calls } = fakeFunctions({ data: { deleted: true }, error: null });
  assert.deepEqual(await requestAccountDeletion(client), { status: 'deleted' });
  assert.equal(calls[0].name, 'delete-account');
});

test('the request body carries the explicit DELETE confirmation the live server requires', async () => {
  const { client, calls } = fakeFunctions({ data: { deleted: true }, error: null });
  await requestAccountDeletion(client);
  assert.deepEqual(calls[0].options, { body: { confirm: 'DELETE' } });
});

test('an empty or unconfirmed success response is NOT treated as deleted', async () => {
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ data: null, error: null }).client),
    { status: 'failed' },
  );
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ data: { ok: true }, error: null }).client),
    { status: 'failed' },
  );
});

test('a 404 from the gateway means the function is not deployed yet', async () => {
  const { client } = fakeFunctions({ error: { context: { status: 404 } } });
  assert.deepEqual(await requestAccountDeletion(client), { status: 'unavailable' });
});

test('the live server status field is accepted as confirmation', async () => {
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ data: { status: 'deleted' }, error: null }).client),
    { status: 'deleted' },
  );
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ data: { status: 'anonymized' }, error: null }).client),
    { status: 'deleted' },
  );
});

test('409 with a known error code is reported as blocked with its reason', async () => {
  const json = async () => ({ error: 'owns_team', message: 'ignored server text' });
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ error: { context: { status: 409, json } } }).client),
    { status: 'blocked', reason: 'owns_team' },
  );
  const adminJson = async () => ({ error: 'admin_account' });
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ error: { context: { status: 409, json: adminJson } } }).client),
    { status: 'blocked', reason: 'admin_account' },
  );
});

test('409 with an unknown body or unreadable body falls back to failed', async () => {
  const unknownJson = async () => ({ error: 'something_else' });
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ error: { context: { status: 409, json: unknownJson } } }).client),
    { status: 'failed' },
  );
  const brokenJson = async () => { throw new Error('body already consumed'); };
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ error: { context: { status: 409, json: brokenJson } } }).client),
    { status: 'failed' },
  );
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ error: { context: { status: 409 } } }).client),
    { status: 'failed' },
  );
});

test('other server errors and thrown network errors are failures', async () => {
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ error: { context: { status: 500 } } }).client),
    { status: 'failed' },
  );
  assert.deepEqual(await requestAccountDeletion(fakeFunctions('throw').client), { status: 'failed' });
});
