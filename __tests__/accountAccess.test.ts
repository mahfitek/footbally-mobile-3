/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAccountStatusError,
  evaluateAccountAccess,
  parseAccountStatusRows,
} from '../lib/accountAccessRules';

const UID = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = '22222222-2222-4222-8222-222222222222';
const TEAM_ID_2 = '44444444-4444-4444-8444-444444444444';
const OTHER_UID = '33333333-3333-4333-8333-333333333333';

const DAY = 24 * 3600 * 1000;
const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const past = (days: number) => new Date(Date.now() - days * DAY).toISOString();

// Canlı get_my_account_status şekli: source + ban alanları, subject_id yok.
const profileRow = (overrides: Record<string, unknown> = {}) => ({
  source: 'profile',
  account_status: 'active',
  banned_until: null,
  ban_is_permanent: false,
  ban_reason: null,
  ...overrides,
});

const teamRow = (overrides: Record<string, unknown> = {}) => ({
  source: 'team',
  account_status: 'active',
  banned_until: null,
  ban_is_permanent: false,
  ban_reason: null,
  ...overrides,
});

// Eski şekil (subject_type + subject_id) hâlâ kabul edilmeli.
const legacyProfileRow = (overrides: Record<string, unknown> = {}) => ({
  subject_type: 'profile',
  subject_id: UID,
  account_status: 'active',
  banned_until: null,
  ban_is_permanent: false,
  ban_reason: null,
  ...overrides,
});

const legacyTeamRow = (overrides: Record<string, unknown> = {}) => ({
  subject_type: 'team',
  subject_id: TEAM_ID,
  account_status: 'active',
  banned_until: null,
  ban_is_permanent: false,
  ban_reason: null,
  ...overrides,
});

const parse = (data: unknown) => parseAccountStatusRows(data, UID);

const unverified = (reason: 'network' | 'timeout' | 'missing_rpc' | 'rpc_error' | 'malformed') => ({
  verified: false as const,
  reason,
});

const MALFORMED = { verified: false, reason: 'malformed' };

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
    assert.equal(access.teamRestricted, false, reason);
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

// --- Eksik veya bozuk yanıt: temiz hesap varsayılmaz ---

test('a null, undefined or empty response is malformed, never a clean account', () => {
  for (const data of [null, undefined, [], '']) {
    const parsed = parse(data);
    assert.deepEqual(parsed, MALFORMED, JSON.stringify(data));
    assert.equal(evaluateAccountAccess(parsed).allowed, false, JSON.stringify(data));
  }
});

test('a response without a profile row is malformed, even if a team row is present', () => {
  const parsed = parse([teamRow({ account_status: 'banned', ban_is_permanent: true })]);
  assert.deepEqual(parsed, MALFORMED);
  const access = evaluateAccountAccess(parsed);
  assert.equal(access.allowed, false);
  assert.equal(access.teamRestricted, false);
});

test('a row without a known type is malformed and never allowed through as clean', () => {
  const parsed = parse([{ account_status: 'banned', ban_is_permanent: true }]);
  assert.deepEqual(parsed, MALFORMED);
  assert.equal(evaluateAccountAccess(parsed).allowed, false);
});

test('an unknown source value is malformed', () => {
  assert.deepEqual(parse([profileRow({ source: 'venue' })]), MALFORMED);
});

test('source and subject_type that disagree are malformed', () => {
  assert.deepEqual(parse([{ ...profileRow(), subject_type: 'team', subject_id: TEAM_ID }]), MALFORMED);
});

test('a row without a string account_status is malformed', () => {
  assert.deepEqual(parse([{ source: 'profile' }]), MALFORMED);
  assert.deepEqual(parse([legacyProfileRow({ account_status: 7 })]), MALFORMED);
});

test('a non-object response is malformed', () => {
  assert.deepEqual(parse('banned'), MALFORMED);
  assert.deepEqual(parse(42), MALFORMED);
  assert.deepEqual(parse(true), MALFORMED);
});

test('a non-object row inside an array is malformed', () => {
  assert.deepEqual(parse([profileRow(), 'banned']), MALFORMED);
  assert.deepEqual(parse([profileRow(), null]), MALFORMED);
});

test('a present but invalid subject_id is malformed', () => {
  assert.deepEqual(parse([profileRow({ subject_id: '' })]), MALFORMED);
  assert.deepEqual(parse([profileRow({ subject_id: 9 })]), MALFORMED);
});

test('a legacy profile row that belongs to another user makes the response malformed', () => {
  assert.deepEqual(parse([legacyProfileRow({ subject_id: OTHER_UID })]), MALFORMED);
});

test('two profile rows make the response malformed', () => {
  assert.deepEqual(parse([profileRow(), profileRow()]), MALFORMED);
  assert.deepEqual(parse([legacyProfileRow(), legacyProfileRow()]), MALFORMED);
});

test('optional ban fields with wrong types are normalised to null', () => {
  const parsed = parse([profileRow({ account_status: 'banned', banned_until: 12, ban_is_permanent: 'yes', ban_reason: 3 })]);
  assert.equal(parsed.verified, true);
  assert.equal(parsed.verified && parsed.profile?.banned_until, null);
  assert.equal(parsed.verified && parsed.profile?.ban_is_permanent, null);
  assert.equal(parsed.verified && parsed.profile?.ban_reason, null);
});

// --- Canlı şekil (source) ---

test('a single live profile row (source only) is parsed as the personal account', () => {
  const parsed = parse([profileRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' })]);
  assert.equal(parsed.verified, true);
  assert.equal(parsed.verified && parsed.profile?.ban_reason, 'spam');
});

test('a single live profile row object (not wrapped in an array) is accepted', () => {
  const access = evaluateAccountAccess(parse(profileRow()));
  assert.equal(access.allowed, true);
  assert.equal(access.verified, true);
});

test('a live profile row without subject_id is accepted for the caller', () => {
  assert.equal(evaluateAccountAccess(parse([profileRow()])).allowed, true);
});

test('a live team ban is a team restriction and does not block the personal account', () => {
  const access = evaluateAccountAccess(parse([
    profileRow(),
    teamRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'kötü takım' }),
  ]));
  assert.equal(access.allowed, true);
  assert.equal(access.verified, true);
  assert.equal(access.teamRestricted, true);
  assert.equal(access.message, undefined);
  assert.match(access.teamMessage ?? '', /Sahip olduğunuz bir takım kalıcı/);
  assert.match(access.teamMessage ?? '', /Sebep: kötü takım/);
});

test('a live profile ban is found after team rows and blocks the personal account', () => {
  const access = evaluateAccountAccess(parse([
    teamRow(),
    teamRow({ account_status: 'active' }),
    profileRow({ account_status: 'banned', banned_until: future(3) }),
  ]));
  assert.equal(access.allowed, false);
  assert.match(access.message ?? '', /tarihine kadar/);
});

// --- Sıra bağımsızlığı: ilk satır karar değildir ---

test('a banned profile is denied even when a clean team row comes first', () => {
  const access = evaluateAccountAccess(parse([
    teamRow({ account_status: 'active' }),
    profileRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' }),
  ]));
  assert.equal(access.allowed, false);
  assert.match(access.message ?? '', /kalıcı/);
});

test('a banned profile is denied when it comes after a banned team row', () => {
  const access = evaluateAccountAccess(parse([
    teamRow({ account_status: 'banned', ban_is_permanent: true }),
    profileRow({ account_status: 'banned', ban_is_permanent: true }),
  ]));
  assert.equal(access.allowed, false);
  assert.equal(access.teamRestricted, true);
});

test('a clean profile is never blocked by a banned team, in either order', () => {
  const bannedTeam = teamRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'kötü takım' });
  for (const rows of [[bannedTeam, profileRow()], [profileRow(), bannedTeam]]) {
    const access = evaluateAccountAccess(parse(rows));
    assert.equal(access.allowed, true);
    assert.equal(access.verified, true);
    assert.equal(access.teamRestricted, true);
    assert.match(access.teamMessage ?? '', /Sahip olduğunuz bir takım kalıcı/);
    assert.equal(access.message, undefined);
  }
});

// --- Çoklu takım ---

test('several owned teams with one active ban restrict team actions only', () => {
  const access = evaluateAccountAccess(parse([
    teamRow({ account_status: 'active' }),
    profileRow(),
    teamRow({ account_status: 'banned', ban_is_permanent: true }),
    teamRow({ account_status: 'active' }),
  ]));
  assert.equal(access.allowed, true);
  assert.equal(access.teamRestricted, true);
});

test('several owned teams with no active ban are unrestricted', () => {
  const access = evaluateAccountAccess(parse([
    profileRow(),
    teamRow(),
    teamRow({ account_status: 'banned', banned_until: past(4) }),
  ]));
  assert.equal(access.allowed, true);
  assert.equal(access.teamRestricted, false);
});

test('a team whose ban has ended does not restrict the team', () => {
  const access = evaluateAccountAccess(parse([
    profileRow(),
    teamRow({ account_status: 'banned', banned_until: past(2) }),
  ]));
  assert.equal(access.allowed, true);
  assert.equal(access.teamRestricted, false);
});

test('a team ban with an unreadable end date stays active (fail closed for the team)', () => {
  const access = evaluateAccountAccess(parse([
    profileRow(),
    teamRow({ account_status: 'banned', banned_until: 'not-a-date' }),
  ]));
  assert.equal(access.allowed, true);
  assert.equal(access.teamRestricted, true);
});

// --- Eski şekil (subject_type + subject_id) geriye uyumluluk ---

test('legacy shape: banned profile and team rows are still read', () => {
  const access = evaluateAccountAccess(parse([
    legacyTeamRow({ account_status: 'banned', ban_is_permanent: true }),
    legacyProfileRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' }),
  ]));
  assert.equal(access.allowed, false);
  assert.equal(access.teamRestricted, true);
  assert.match(access.message ?? '', /Sebep: spam/);
});

test('legacy shape: an owner with an active profile and team is allowed without restriction', () => {
  const access = evaluateAccountAccess(parse([legacyProfileRow(), legacyTeamRow()]));
  assert.equal(access.allowed, true);
  assert.equal(access.teamRestricted, false);
  assert.equal(access.expiredBan, false);
});

// --- Profil yasağı ---

test('an active account is allowed', () => {
  assert.equal(evaluateAccountAccess(parse([profileRow()])).allowed, true);
});

test('a permanent ban is denied and shows the reason', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' })]));
  assert.equal(access.allowed, false);
  assert.equal(access.verified, true);
  assert.match(access.message ?? '', /kalıcı/);
  assert.match(access.message ?? '', /Sebep: spam/);
});

test('a permanent ban wins even when an old banned_until is in the past', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', ban_is_permanent: true, banned_until: past(1) })]));
  assert.equal(access.allowed, false);
  assert.equal(access.expiredBan, false);
});

test('a temporary ban in the future is denied with its end date', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', banned_until: future(3) })]));
  assert.equal(access.allowed, false);
  assert.equal(access.expiredBan, false);
  assert.match(access.message ?? '', /tarihine kadar/);
});

test('an expired temporary profile ban is allowed and flagged for clearing', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', banned_until: past(1) })]));
  assert.equal(access.allowed, true);
  assert.equal(access.expiredBan, true);
});

test('a temporary ban without an end date is still denied and does not crash', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', banned_until: null, ban_is_permanent: false })]));
  assert.equal(access.allowed, false);
  assert.match(access.message ?? '', /askıya alınmıştır/);
});

test('an inactive account is denied', () => {
  assert.equal(evaluateAccountAccess(parse([profileRow({ account_status: 'inactive' })])).allowed, false);
});
