/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockUser, unblockUser } from '../lib/blocking';

function fakeRpc(error: { code?: string; message?: string } | null) {
  const calls: { fn: string; args: unknown }[] = [];
  return {
    client: {
      rpc: async (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return { data: null, error };
      },
    } as never,
    calls,
  };
}

test('blocking calls block_user with the target id and reports done only on success', async () => {
  const { client, calls } = fakeRpc(null);
  assert.deepEqual(await blockUser(client, ' user-9 '), { status: 'done' });
  assert.equal(calls[0].fn, 'block_user');
  assert.deepEqual(calls[0].args, { p_user_id: 'user-9' });
});

test('a missing block_user RPC is unavailable, never done', async () => {
  const { client } = fakeRpc({ code: 'PGRST202', message: 'Could not find the function' });
  assert.deepEqual(await blockUser(client, 'user-9'), { status: 'unavailable' });
});

test('unblocking follows the same rules', async () => {
  const ok = fakeRpc(null);
  assert.deepEqual(await unblockUser(ok.client, 'user-9'), { status: 'done' });
  assert.equal(ok.calls[0].fn, 'unblock_user');
  const fail = fakeRpc({ message: 'network' });
  assert.deepEqual(await unblockUser(fail.client, 'user-9'), { status: 'failed' });
});

test('an empty target never reaches the server', async () => {
  const { client, calls } = fakeRpc(null);
  assert.deepEqual(await blockUser(client, '  '), { status: 'failed' });
  assert.equal(calls.length, 0);
});
