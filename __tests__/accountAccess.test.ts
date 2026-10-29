/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAccountAccess } from '../lib/accountAccessRules';

const verified = (row: Record<string, unknown> | null) => ({
  verified: true as const,
  row: row ? { account_status: 'active', banned_until: null, ban_is_permanent: null, ban_reason: null, table: 'profiles' as const, ...row } : null,
});

test('an unverified status lookup is denied, never treated as "no ban"', () => {
  const access = evaluateAccountAccess({ verified: false });
  assert.equal(access.allowed, false);
  assert.match(access.message ?? '', /doğrulanamadı/);
});

test('a verified status with no row is allowed', () => {
  assert.equal(evaluateAccountAccess(verified(null)).allowed, true);
});

test('an active account is allowed', () => {
  assert.equal(evaluateAccountAccess(verified({ account_status: 'active' })).allowed, true);
});

test('a permanent ban is denied and shows the reason', () => {
  const access = evaluateAccountAccess(verified({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' }));
  assert.equal(access.allowed, false);
  assert.match(access.message ?? '', /kalıcı/);
  assert.match(access.message ?? '', /Sebep: spam/);
});

test('a temporary ban in the future is denied with its end date', () => {
  const until = new Date(Date.now() + 3 * 24 * 3600 * 1000);
  const access = evaluateAccountAccess(verified({ account_status: 'banned', banned_until: until.toISOString() }));
  assert.equal(access.allowed, false);
  assert.equal(access.expiredBan, false);
  assert.match(access.message ?? '', /tarihine kadar/);
});

test('an expired temporary ban is allowed and flagged for clearing', () => {
  const past = new Date(Date.now() - 24 * 3600 * 1000);
  const access = evaluateAccountAccess(verified({ account_status: 'banned', banned_until: past.toISOString() }));
  assert.equal(access.allowed, true);
  assert.equal(access.expiredBan, true);
});

test('an inactive account is denied', () => {
  assert.equal(evaluateAccountAccess(verified({ account_status: 'inactive' })).allowed, false);
});
