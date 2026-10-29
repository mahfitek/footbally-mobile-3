/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAccountStatusError,
  evaluateAccountAccess,
  parseAccountStatusRow,
} from '../lib/accountAccessRules';

const verified = (row: Record<string, unknown> | null) => ({
  verified: true as const,
  row: row ? { account_status: 'active', banned_until: null, ban_is_permanent: null, ban_reason: null, table: 'profiles' as const, ...row } : null,
});

const unverified = (reason: 'network' | 'timeout' | 'missing_rpc' | 'rpc_error' | 'malformed') => ({
  verified: false as const,
  reason,
});

const DAY = 24 * 3600 * 1000;

// --- Doğrulanamayan durumlar: yasak değildir, korunan işlemler kapalıdır ---

test('an unverified status lookup is denied, never treated as "no ban"', () => {
  const access = evaluateAccountAccess(unverified('rpc_error'));
  assert.equal(access.allowed, false);
  assert.equal(access.verified, false);
  assert.match(access.message ?? '', /doğrulanamadı/);
});

test('an unverified lookup never shows a ban message, whatever the reason', () => {
  for (const reason of ['network', 'timeout', 'missing_rpc', 'rpc_error', 'malformed'] as const) {
    const access = evaluateAccountAccess(unverified(reason));
    assert.equal(access.allowed, false, reason);
    assert.equal(access.expiredBan, false, reason);
    assert.doesNotMatch(access.message ?? '', /kalıcı|askıya|yasaklan/, reason);
  }
});

test('network and timeout failures ask the user to check the connection', () => {
  assert.match(evaluateAccountAccess(unverified('network')).message ?? '', /bağlantınızı/);
  assert.match(evaluateAccountAccess(unverified('timeout')).message ?? '', /bağlantınızı/);
});

test('a missing RPC is not reported as a network problem', () => {
  assert.doesNotMatch(evaluateAccountAccess(unverified('missing_rpc')).message ?? '', /bağlantınızı/);
});

// --- Hata sınıflandırması ---

test('a missing function (PGRST202 or 42883) is classified as missing_rpc', () => {
  assert.equal(classifyAccountStatusError({ code: 'PGRST202', message: 'x' }), 'missing_rpc');
  assert.equal(classifyAccountStatusError({ code: '42883', message: 'x' }), 'missing_rpc');
  assert.equal(
    classifyAccountStatusError({ message: 'Could not find the function public.get_my_account_status' }),
    'missing_rpc',
  );
});

test('a permission or server error is an rpc_error, not a network error', () => {
  assert.equal(classifyAccountStatusError({ code: '42501', message: 'permission denied' }), 'rpc_error');
  assert.equal(classifyAccountStatusError({ code: 'XX000', message: 'internal' }), 'rpc_error');
});

test('a coded-less fetch failure is classified as network', () => {
  assert.equal(classifyAccountStatusError({ message: 'TypeError: Network request failed' }), 'network');
  assert.equal(classifyAccountStatusError({ message: 'Failed to fetch' }), 'network');
});

// --- RPC yanıt doğrulaması ---

test('a null or empty response is a verified "no row": account is allowed', () => {
  assert.deepEqual(parseAccountStatusRow(null), { verified: true, row: null });
  assert.deepEqual(parseAccountStatusRow([]), { verified: true, row: null });
  assert.equal(evaluateAccountAccess(parseAccountStatusRow([])).allowed, true);
});

test('an array response uses its first row', () => {
  const parsed = parseAccountStatusRow([{ account_status: 'active', banned_until: null, ban_is_permanent: false, ban_reason: null }]);
  assert.equal(parsed.verified, true);
  assert.equal(parsed.verified && parsed.row?.account_status, 'active');
});

test('a row without a string account_status is malformed and never allowed through as clean', () => {
  const parsed = parseAccountStatusRow({ banned_until: null });
  assert.deepEqual(parsed, { verified: false, reason: 'malformed' });
  assert.equal(evaluateAccountAccess(parsed).allowed, false);
});

test('a non-object response is malformed', () => {
  assert.deepEqual(parseAccountStatusRow('banned'), { verified: false, reason: 'malformed' });
  assert.deepEqual(parseAccountStatusRow(42), { verified: false, reason: 'malformed' });
});

test('optional ban fields with wrong types are normalised to null', () => {
  const parsed = parseAccountStatusRow({ account_status: 'banned', banned_until: 12, ban_is_permanent: 'yes', ban_reason: 3 });
  assert.equal(parsed.verified, true);
  assert.equal(parsed.verified && parsed.row?.banned_until, null);
  assert.equal(parsed.verified && parsed.row?.ban_is_permanent, null);
  assert.equal(parsed.verified && parsed.row?.ban_reason, null);
});

// --- Verified hesap durumları ---

test('an active account is allowed', () => {
  assert.equal(evaluateAccountAccess(verified({ account_status: 'active' })).allowed, true);
});

test('a permanent ban is denied and shows the reason', () => {
  const access = evaluateAccountAccess(verified({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' }));
  assert.equal(access.allowed, false);
  assert.equal(access.verified, true);
  assert.match(access.message ?? '', /kalıcı/);
  assert.match(access.message ?? '', /Sebep: spam/);
});

test('a permanent ban wins even when an old banned_until is in the past', () => {
  const access = evaluateAccountAccess(verified({
    account_status: 'banned',
    ban_is_permanent: true,
    banned_until: new Date(Date.now() - DAY).toISOString(),
  }));
  assert.equal(access.allowed, false);
  assert.equal(access.expiredBan, false);
});

test('a temporary ban in the future is denied with its end date', () => {
  const until = new Date(Date.now() + 3 * DAY);
  const access = evaluateAccountAccess(verified({ account_status: 'banned', banned_until: until.toISOString() }));
  assert.equal(access.allowed, false);
  assert.equal(access.expiredBan, false);
  assert.match(access.message ?? '', /tarihine kadar/);
});

test('an expired temporary ban is allowed and flagged for clearing', () => {
  const past = new Date(Date.now() - DAY);
  const access = evaluateAccountAccess(verified({ account_status: 'banned', banned_until: past.toISOString() }));
  assert.equal(access.allowed, true);
  assert.equal(access.expiredBan, true);
});

test('a temporary ban without an end date is still denied and does not crash', () => {
  const access = evaluateAccountAccess(verified({ account_status: 'banned', banned_until: null, ban_is_permanent: false }));
  assert.equal(access.allowed, false);
  assert.match(access.message ?? '', /askıya alınmıştır/);
});

test('an inactive account is denied', () => {
  assert.equal(evaluateAccountAccess(verified({ account_status: 'inactive' })).allowed, false);
});
