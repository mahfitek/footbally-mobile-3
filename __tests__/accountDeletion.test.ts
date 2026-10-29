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

test('other server errors and thrown network errors are failures', async () => {
  assert.deepEqual(
    await requestAccountDeletion(fakeFunctions({ error: { context: { status: 500 } } }).client),
    { status: 'failed' },
  );
  assert.deepEqual(await requestAccountDeletion(fakeFunctions('throw').client), { status: 'failed' });
});
