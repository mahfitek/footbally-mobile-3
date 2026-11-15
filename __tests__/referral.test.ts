import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REFERRAL_CODE_ALPHABET,
  normalizeReferralCode,
  isValidReferralCodeFormat,
  referralProgress,
  parseReferralSummary,
  classifyRedeemError,
  buildShareMessage,
  fetchReferralSummary,
  getOrCreateReferralCode,
  redeemReferralCode,
} from '../lib/referral';

test('code alphabet has no confusable characters and codes are 8 characters', () => {
  for (const ch of ['0', 'O', '1', 'I', 'L']) {
    assert.equal(REFERRAL_CODE_ALPHABET.includes(ch), false, `${ch} must not be used`);
  }
  assert.equal(isValidReferralCodeFormat('ABCD2345'), true);
  assert.equal(isValidReferralCodeFormat('ABCD234'), false, 'seven characters');
  assert.equal(isValidReferralCodeFormat('ABCD2340'), false, 'contains 0');
  assert.equal(isValidReferralCodeFormat('abcd2345'), false, 'lower case is normalised before check');
});

test('user input is trimmed, spaces and dashes removed and upper-cased', () => {
  assert.equal(normalizeReferralCode('  abcd-2345 '), 'ABCD2345');
  assert.equal(isValidReferralCodeFormat(normalizeReferralCode(' ab cd-23 45 ')), true);
});

test('progress counts within the 7-invite group (6 to 7 and the 14th invite)', () => {
  assert.deepEqual(referralProgress(0), { done: 0, target: 7, remaining: 7 });
  assert.deepEqual(referralProgress(3), { done: 3, target: 7, remaining: 4 });
  assert.deepEqual(referralProgress(6), { done: 6, target: 7, remaining: 1 });
  assert.deepEqual(referralProgress(7), { done: 0, target: 7, remaining: 7 }, 'the 7th invite completes a group');
  assert.deepEqual(referralProgress(14), { done: 0, target: 7, remaining: 7 }, 'the 14th invite completes the second group');
  assert.equal(referralProgress(15).done, 1);
  assert.equal(referralProgress(-4).done, 0, 'negative counts are treated as zero');
  assert.equal(referralProgress(Number.NaN).done, 0);
});

test('summary parsing is defensive and keeps only a valid code', () => {
  const parsed = parseReferralSummary({
    code: 'ABCD2345',
    invited_count: 9,
    qualified_count: '8',
    progress: 1,
    reward_months_total: 1,
    redeemed: true,
    can_redeem: false,
  });
  assert.equal(parsed.code, 'ABCD2345');
  assert.equal(parsed.invitedCount, 9);
  assert.equal(parsed.qualifiedCount, 8);
  assert.equal(parsed.progress, 1);
  assert.equal(parsed.rewardMonthsTotal, 1);
  assert.equal(parsed.redeemed, true);
  assert.equal(parsed.canRedeem, false);

  const empty = parseReferralSummary(null);
  assert.equal(empty.code, null);
  assert.equal(empty.invitedCount, 0);
  assert.equal(empty.canRedeem, false);

  assert.equal(parseReferralSummary({ code: 'bad0code' }).code, null, 'invalid code is dropped');
});

test('redeem errors map to user-facing reasons, unknown errors stay unknown', () => {
  assert.equal(classifyRedeemError({ message: 'referral_own_code' }), 'own_code');
  assert.equal(classifyRedeemError({ message: 'P0001: referral_already_used' }), 'already_used');
  assert.equal(classifyRedeemError({ message: 'referral_account_too_old' }), 'too_old');
  assert.equal(classifyRedeemError({ message: 'referral_invalid_code' }), 'invalid_code');
  assert.equal(classifyRedeemError({ message: 'account_restricted' }), 'restricted');
  assert.equal(classifyRedeemError({ message: 'network down' }), 'unknown');
  assert.equal(classifyRedeemError(null), 'unknown');
});

test('share text carries the app name, the code and the website, never an App Store link', () => {
  for (const lang of ['tr', 'en'] as const) {
    const text = buildShareMessage(lang, 'Footbally', 'ABCD2345');
    assert.ok(text.includes('ABCD2345'));
    assert.ok(text.includes('Footbally'));
    assert.ok(text.includes('https://www.getfootbally.com'));
    assert.equal(/apps\.apple|itunes|play\.google/i.test(text), false, 'no store link');
  }
  assert.ok(buildShareMessage('tr', 'Footbally', 'ABCD2345').includes('Premium'));
  assert.ok(buildShareMessage('en', 'Footbally', 'ABCD2345').includes('Premium'));
});

test('summary fetch and code creation go through the rpc names the server defines', async () => {
  const calls: { fn: string; args?: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === 'get_my_referral_summary') return { data: { code: 'ABCD2345', qualified_count: 2 }, error: null };
      return { data: 'ABCD2345', error: null };
    },
  };
  const summary = await fetchReferralSummary(client);
  assert.equal(summary.ok, true);
  assert.equal(await getOrCreateReferralCode(client), 'ABCD2345');
  assert.deepEqual(calls.map((c) => c.fn), ['get_my_referral_summary', 'get_or_create_my_referral_code']);
});

test('a failing summary call is reported as not ok, never as an empty summary', async () => {
  const client = { rpc: async () => ({ data: null, error: { message: 'boom' } }) };
  assert.deepEqual(await fetchReferralSummary(client), { ok: false });
  assert.equal(await getOrCreateReferralCode(client), null);
});

test('redeem sends the normalised code and maps the server reason', async () => {
  let sent: unknown = null;
  const ok = { rpc: async (_fn: string, args?: Record<string, unknown>) => { sent = args; return { data: { status: 'redeemed' }, error: null }; } };
  assert.deepEqual(await redeemReferralCode(ok, ' abcd-2345 '), { ok: true });
  assert.deepEqual(sent, { p_code: 'ABCD2345' });

  const rejected = { rpc: async () => ({ data: null, error: { message: 'referral_already_used' } }) };
  assert.deepEqual(await redeemReferralCode(rejected, 'ABCD2345'), { ok: false, reason: 'already_used' });

  const malformed = { rpc: async () => { throw new Error('should not be called'); } };
  assert.deepEqual(await redeemReferralCode(malformed, 'O0I1L'), { ok: false, reason: 'invalid_code' });
});
