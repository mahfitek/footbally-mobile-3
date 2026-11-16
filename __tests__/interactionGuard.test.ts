import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyInteractionError,
  interactionAvailability,
  canApplyToMatch,
  canRejectApplication,
  rejectMatchApplication,
} from '../lib/interactionGuard';

test('blocked interactions are recognised from either server message', () => {
  assert.equal(classifyInteractionError({ message: 'blocked_interaction' }), 'blocked');
  assert.equal(classifyInteractionError({ message: 'ERROR: blocked_user' }), 'blocked');
  assert.equal(classifyInteractionError({ message: 'application_rejected' }), 'application_rejected');
  assert.equal(classifyInteractionError({ message: 'network down' }), null);
  assert.equal(classifyInteractionError(null), null);
});

test('my own blocks disable interaction buttons and offer unblock; otherwise buttons stay enabled', () => {
  assert.deepEqual(interactionAvailability(true), { canInteract: false, showUnblock: true });
  assert.deepEqual(interactionAvailability(false), { canInteract: true, showUnblock: false });
});

test('a rejected applicant cannot apply to the same listing again', () => {
  assert.equal(canApplyToMatch('rejected'), false);
  assert.equal(canApplyToMatch('REJECTED'), false);
  assert.equal(canApplyToMatch('applied'), true);
  assert.equal(canApplyToMatch(null), true);
});

test('only a pending application on a listing can be rejected by the owner', () => {
  assert.equal(canRejectApplication('applied', true), true);
  assert.equal(canRejectApplication('rejected', true), false, 'no double rejection');
  assert.equal(canRejectApplication('applied', false), false, 'opportunity applications are out of scope');
});

function rpcClient(result: { data: unknown; error: { message?: string } | null }) {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args?: Record<string, unknown>) => {
        calls.push({ fn, args });
        return result;
      },
    },
  };
}

test('reject sends the application id to the server RPC and reports success', async () => {
  const { client, calls } = rpcClient({ data: 'rejected', error: null });
  assert.deepEqual(await rejectMatchApplication(client, 42), { ok: true, alreadyRejected: false });
  assert.deepEqual(calls, [{ fn: 'reject_match_application', args: { p_application_id: 42 } }]);
});

test('a repeated reject is a success with alreadyRejected, not an error', async () => {
  const { client } = rpcClient({ data: 'already_rejected', error: null });
  assert.deepEqual(await rejectMatchApplication(client, 42), { ok: true, alreadyRejected: true });
});

test('reject errors map to user-facing reasons', async () => {
  const cases: [string, string][] = [
    ['not_match_owner', 'not_owner'],
    ['application_not_found', 'not_found'],
    ['application_not_match', 'not_match'],
    ['account_restricted', 'restricted'],
    ['something else', 'unknown'],
  ];
  for (const [message, reason] of cases) {
    const { client } = rpcClient({ data: null, error: { message } });
    assert.deepEqual(await rejectMatchApplication(client, 1), { ok: false, reason }, message);
  }
});
