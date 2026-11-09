/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, submitReport, isMissingRpc, REPORT_DETAIL_MAX } from '../lib/reports';

function fakeRpc(result: { error: { code?: string; message?: string } | null }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: null, error: result.error };
    },
  };
  return { client: client as never, calls };
}

const base = { targetType: 'profile' as const, targetId: 'user-123', reason: 'spam' as const };

test('a report needs a target and a known reason', () => {
  assert.deepEqual(validateReport({ ...base, targetId: '  ' }), { ok: false, error: 'missing_target' });
  assert.deepEqual(validateReport({ ...base, reason: 'nope' as never }), { ok: false, error: 'invalid_reason' });
});

test('"other" requires a written explanation', () => {
  assert.deepEqual(validateReport({ ...base, reason: 'other', detail: '   ' }), { ok: false, error: 'detail_required' });
  assert.deepEqual(validateReport({ ...base, reason: 'other', detail: ' kısa not ' }), { ok: true, detail: 'kısa not' });
});

test('detail is trimmed, optional for named reasons and capped in length', () => {
  assert.deepEqual(validateReport({ ...base, detail: '' }), { ok: true, detail: null });
  assert.deepEqual(
    validateReport({ ...base, detail: 'x'.repeat(REPORT_DETAIL_MAX + 1) }),
    { ok: false, error: 'detail_too_long' },
  );
});

test('a successful RPC call sends the caller-chosen fields only', async () => {
  const { client, calls } = fakeRpc({ error: null });
  const outcome = await submitReport(client, { ...base, detail: null });
  assert.deepEqual(outcome, { status: 'sent' });
  assert.equal(calls[0].fn, 'submit_report');
  assert.deepEqual(calls[0].args, {
    p_target_type: 'profile',
    p_target_id: 'user-123',
    p_reason: 'spam',
    p_detail: null,
  });
});

test('a missing RPC is reported as unavailable, never as sent', async () => {
  const { client } = fakeRpc({ error: { code: 'PGRST202', message: 'Could not find the function public.submit_report' } });
  assert.deepEqual(await submitReport(client, base), { status: 'unavailable' });
});

test('an undefined function (42883) is also unavailable', async () => {
  const { client } = fakeRpc({ error: { code: '42883', message: 'function does not exist' } });
  assert.deepEqual(await submitReport(client, base), { status: 'unavailable' });
});

test('other errors are failures that the user can retry', async () => {
  const { client } = fakeRpc({ error: { message: 'Network request failed' } });
  assert.deepEqual(await submitReport(client, base), { status: 'failed' });
});

test('invalid input never reaches the server', async () => {
  const { client, calls } = fakeRpc({ error: null });
  const outcome = await submitReport(client, { ...base, reason: 'other' });
  assert.deepEqual(outcome, { status: 'invalid', error: 'detail_required' });
  assert.equal(calls.length, 0);
});

test('isMissingRpc recognises PostgREST and Postgres missing-function signals only', () => {
  assert.equal(isMissingRpc({ code: 'PGRST202' }), true);
  assert.equal(isMissingRpc({ code: '42883' }), true);
  assert.equal(isMissingRpc({ code: '42501', message: 'permission denied' }), false);
});
