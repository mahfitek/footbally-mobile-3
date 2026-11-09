/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_VIDEO_CONSENT, recordAiVideoConsent } from '../lib/consent';

function fakeRpc(response: { error: unknown } | 'throw') {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (response === 'throw') throw new Error('network down');
      return { data: null, error: response.error };
    },
  };
  return { client: client as never, calls };
}

test('consent is recorded through the record_user_consent RPC with the current document version', async () => {
  const { client, calls } = fakeRpc({ error: null });
  assert.equal(await recordAiVideoConsent(client), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'record_user_consent');
  assert.deepEqual(calls[0].args, {
    p_app: 'mobile',
    p_consent_type: AI_VIDEO_CONSENT.consentType,
    p_document_version: AI_VIDEO_CONSENT.documentVersion,
    p_granted: true,
  });
});

test('a failed or missing RPC means consent is NOT recorded (fail-closed)', async () => {
  assert.equal(await recordAiVideoConsent(fakeRpc({ error: { message: 'function not found' } }).client), false);
  assert.equal(await recordAiVideoConsent(fakeRpc('throw').client), false);
});

test('consent text exists in both supported languages and is marked as not yet legally reviewed', () => {
  assert.ok(AI_VIDEO_CONSENT.text.tr.length > 0);
  assert.ok(AI_VIDEO_CONSENT.text.en.length > 0);
  assert.equal(AI_VIDEO_CONSENT.legalReviewed, false);
});
