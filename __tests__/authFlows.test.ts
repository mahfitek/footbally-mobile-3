/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidEmail,
  requestPasswordReset,
  parseRecoveryUrl,
  validateNewPassword,
  PASSWORD_RESET_REDIRECT,
} from '../lib/authFlows';

function fakeAuth(error: unknown) {
  const calls: { email: string; options: unknown }[] = [];
  const client = {
    auth: {
      resetPasswordForEmail: async (email: string, options: unknown) => {
        calls.push({ email, options });
        return { data: {}, error };
      },
    },
  };
  return { client: client as never, calls };
}

test('email validation rejects blanks and malformed addresses', () => {
  assert.equal(isValidEmail(' a@b.co '), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail('   '), false);
});

test('a reset request is sent with the app redirect and reports success only without error', async () => {
  const { client, calls } = fakeAuth(null);
  assert.deepEqual(await requestPasswordReset(client, ' oyuncu@ornek.com '), { status: 'sent' });
  assert.equal(calls[0].email, 'oyuncu@ornek.com');
  assert.deepEqual(calls[0].options, { redirectTo: PASSWORD_RESET_REDIRECT });
});

test('a failed reset request is reported as failed, never as sent', async () => {
  const { client } = fakeAuth({ message: 'rate limit' });
  assert.deepEqual(await requestPasswordReset(client, 'oyuncu@ornek.com'), { status: 'failed' });
});

test('an invalid email never reaches the auth server', async () => {
  const { client, calls } = fakeAuth(null);
  assert.deepEqual(await requestPasswordReset(client, 'nope'), { status: 'invalid_email' });
  assert.equal(calls.length, 0);
});

test('recovery links yield the two tokens', () => {
  const url = `${PASSWORD_RESET_REDIRECT}#access_token=abc.def&refresh_token=r%2Bx&expires_in=3600&type=recovery`;
  assert.deepEqual(parseRecoveryUrl(url), { accessToken: 'abc.def', refreshToken: 'r+x' });
});

test('links that are not recovery links, or lack tokens, are ignored', () => {
  assert.equal(parseRecoveryUrl(null), null);
  assert.equal(parseRecoveryUrl('footbally://join-team?id=1'), null);
  assert.equal(parseRecoveryUrl(`${PASSWORD_RESET_REDIRECT}#access_token=a&refresh_token=b&type=signup`), null);
  assert.equal(parseRecoveryUrl(`${PASSWORD_RESET_REDIRECT}#type=recovery&access_token=a`), null);
});

test('new passwords need the minimum length and a matching confirmation', () => {
  assert.equal(validateNewPassword('kisa', 'kisa'), 'too_short');
  assert.equal(validateNewPassword('uzunsifre1', 'farkli123'), 'mismatch');
  assert.equal(validateNewPassword('uzunsifre1', 'uzunsifre1'), null);
});
