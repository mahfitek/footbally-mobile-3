/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAccountStatusError,
  evaluateAccountAccess,
  mustSignOut,
  parseAccountStatusRows,
  type AccountAccessResult,
  type AccountBanLookupResult,
} from '../lib/accountAccessRules';

const UID = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = '22222222-2222-4222-8222-222222222222';
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

const unverified = (reason: 'network' | 'timeout' | 'missing_rpc' | 'rpc_error' | 'no_profile' | 'malformed') => ({
  verified: false as const,
  reason,
});

/** Yalnızca nedeni karşılaştırır; tanı alanı (detail, httpStatus) testleri bozmaz. */
const reasonOf = (lookup: AccountBanLookupResult) => (lookup.verified ? 'verified' : lookup.reason);

// --- Doğrulanamayan durumlar: oturum açık kalır, korunan yazmalar kapalıdır, yasak gösterilmez ---

test('an unverified lookup keeps the session but closes protected writes', () => {
  const access = evaluateAccountAccess(unverified('rpc_error'));
  assert.equal(access.allowed, true);
  assert.equal(access.verified, false);
  assert.equal(access.unverifiedReason, 'rpc_error');
  assert.equal(access.profileWriteAllowed, false);
  assert.equal(access.teamWriteAllowed, false);
  assert.match(access.message ?? '', /doğrulanamadı/);
});

test('an unverified lookup never signs the user out', () => {
  for (const reason of ['network', 'timeout', 'missing_rpc', 'rpc_error', 'no_profile', 'malformed'] as const) {
    assert.equal(mustSignOut(evaluateAccountAccess(unverified(reason))), false, reason);
  }
});

test('an unverified lookup never shows a ban message, whatever the reason', () => {
  for (const reason of ['network', 'timeout', 'missing_rpc', 'rpc_error', 'no_profile', 'malformed'] as const) {
    const access = evaluateAccountAccess(unverified(reason));
    assert.equal(access.expiredBan, false, reason);
    assert.equal(access.teamRestricted, false, reason);
    assert.doesNotMatch(access.message ?? '', /kalıcı|askıya|yasaklan/, reason);
  }
});

test('network and timeout failures ask the user to check the connection', () => {
  assert.match(evaluateAccountAccess(unverified('network')).message ?? '', /bağlantınızı/);
  assert.match(evaluateAccountAccess(unverified('timeout')).message ?? '', /bağlantınızı/);
});

test('a missing RPC or a missing profile is not reported as a network problem', () => {
  assert.doesNotMatch(evaluateAccountAccess(unverified('missing_rpc')).message ?? '', /bağlantınızı/);
  assert.doesNotMatch(evaluateAccountAccess(unverified('no_profile')).message ?? '', /bağlantınızı/);
});

test('an unverified lookup tells the user to try again', () => {
  for (const reason of ['network', 'timeout', 'missing_rpc', 'rpc_error', 'no_profile', 'malformed'] as const) {
    assert.match(evaluateAccountAccess(unverified(reason)).message ?? '', /tekrar/, reason);
  }
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

// --- Yanıt doğrulaması: boş, bozuk, profilsiz ---

test('a null, undefined or empty response is never a clean account', () => {
  for (const data of [null, undefined, '']) {
    const access = evaluateAccountAccess(parse(data));
    assert.equal(reasonOf(parse(data)), 'malformed', JSON.stringify(data));
    assert.equal(access.profileWriteAllowed, false, JSON.stringify(data));
  }
});

test('an empty array (RPC ok, no rows) is a missing profile, not a clean account', () => {
  assert.equal(reasonOf(parse([])), 'no_profile');
  assert.equal(evaluateAccountAccess(parse([])).profileWriteAllowed, false);
});

test('a response without a profile row is no_profile, even if a team row is present', () => {
  const lookup = parse([teamRow({ account_status: 'banned', ban_is_permanent: true })]);
  assert.equal(reasonOf(lookup), 'no_profile');
  const access = evaluateAccountAccess(lookup);
  assert.equal(access.teamRestricted, false);
  assert.equal(mustSignOut(access), false);
});

test('a row without a known type is malformed and never allowed through as clean', () => {
  const lookup = parse([{ account_status: 'banned', ban_is_permanent: true }]);
  assert.equal(reasonOf(lookup), 'malformed');
  assert.equal(evaluateAccountAccess(lookup).profileWriteAllowed, false);
});

test('an unknown source value is malformed', () => {
  assert.equal(reasonOf(parse([profileRow({ source: 'venue' })])), 'malformed');
});

test('source and subject_type that disagree are malformed', () => {
  assert.equal(reasonOf(parse([{ ...profileRow(), subject_type: 'team', subject_id: TEAM_ID }])), 'malformed');
});

test('a row without a string account_status is malformed', () => {
  assert.equal(reasonOf(parse([{ source: 'profile' }])), 'malformed');
  assert.equal(reasonOf(parse([legacyProfileRow({ account_status: 7 })])), 'malformed');
});

test('a non-object response is malformed', () => {
  assert.equal(reasonOf(parse('banned')), 'malformed');
  assert.equal(reasonOf(parse(42)), 'malformed');
  assert.equal(reasonOf(parse(true)), 'malformed');
});

test('a non-object row inside an array is malformed', () => {
  assert.equal(reasonOf(parse([profileRow(), 'banned'])), 'malformed');
  assert.equal(reasonOf(parse([profileRow(), null])), 'malformed');
});

test('a present but invalid subject_id is malformed', () => {
  assert.equal(reasonOf(parse([profileRow({ subject_id: '' })])), 'malformed');
  assert.equal(reasonOf(parse([profileRow({ subject_id: 9 })])), 'malformed');
});

test('a legacy profile row that belongs to another user makes the response malformed', () => {
  assert.equal(reasonOf(parse([legacyProfileRow({ subject_id: OTHER_UID })])), 'malformed');
});

test('two profile rows make the response malformed', () => {
  assert.equal(reasonOf(parse([profileRow(), profileRow()])), 'malformed');
  assert.equal(reasonOf(parse([legacyProfileRow(), legacyProfileRow()])), 'malformed');
});

test('a malformed lookup carries a diagnostic detail without any personal identifier', () => {
  const lookup = parse([profileRow({ subject_id: OTHER_UID })]);
  assert.equal(lookup.verified, false);
  assert.ok(!lookup.verified && lookup.detail);
  assert.doesNotMatch(!lookup.verified ? lookup.detail ?? '' : '', new RegExp(OTHER_UID));
});

test('optional ban fields with wrong types are normalised to null', () => {
  const parsed = parse([profileRow({ account_status: 'banned', banned_until: 12, ban_is_permanent: 'yes', ban_reason: 3 })]);
  assert.equal(parsed.verified, true);
  assert.equal(parsed.verified && parsed.profile.banned_until, null);
  assert.equal(parsed.verified && parsed.profile.ban_is_permanent, null);
  assert.equal(parsed.verified && parsed.profile.ban_reason, null);
});

// --- Canlı şekil (source) ---

test('a single live profile row (source only) is parsed as the personal account', () => {
  const parsed = parse([profileRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' })]);
  assert.equal(parsed.verified, true);
  assert.equal(parsed.verified && parsed.profile.ban_reason, 'spam');
});

test('a single live profile row object (not wrapped in an array) is accepted', () => {
  const access = evaluateAccountAccess(parse(profileRow()));
  assert.equal(access.allowed, true);
  assert.equal(access.verified, true);
  assert.equal(access.profileWriteAllowed, true);
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
  assert.equal(access.profileWriteAllowed, true);
  assert.equal(access.teamRestricted, true);
  assert.equal(access.teamWriteAllowed, false);
  assert.equal(access.message, undefined);
  assert.match(access.teamMessage ?? '', /Sahip olduğunuz bir takım kalıcı/);
  assert.match(access.teamMessage ?? '', /Sebep: kötü takım/);
  assert.equal(mustSignOut(access), false);
});

test('a live profile ban is found after team rows and blocks the personal account', () => {
  const access = evaluateAccountAccess(parse([
    teamRow(),
    teamRow({ account_status: 'active' }),
    profileRow({ account_status: 'banned', banned_until: future(3) }),
  ]));
  assert.equal(access.allowed, false);
  assert.equal(mustSignOut(access), true);
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
  assert.equal(access.teamWriteAllowed, false);
  assert.equal(access.profileWriteAllowed, true);
});

test('several owned teams with no active ban are unrestricted', () => {
  const access = evaluateAccountAccess(parse([
    profileRow(),
    teamRow(),
    teamRow({ account_status: 'banned', banned_until: past(4) }),
  ]));
  assert.equal(access.allowed, true);
  assert.equal(access.teamRestricted, false);
  assert.equal(access.teamWriteAllowed, true);
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

test('a team restriction is never reported as a personal sign-out', () => {
  const access: AccountAccessResult = evaluateAccountAccess(parse([
    profileRow(),
    teamRow({ account_status: 'banned', ban_is_permanent: true }),
  ]));
  assert.equal(mustSignOut(access), false);
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

test('a permanent ban is denied, shows the reason and signs out', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' })]));
  assert.equal(access.allowed, false);
  assert.equal(access.verified, true);
  assert.equal(mustSignOut(access), true);
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
