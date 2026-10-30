/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  callAccountStatusRpc,
  classifyAccountStatusError,
  evaluateAccountAccess,
  mustSignOut,
  parseAccountStatusRows,
  renderAccountMessage,
  type AccountAccessResult,
  type AccountBanLookupResult,
  type AccountMessage,
} from '../lib/accountAccessRules';

/** Mesajı Türkçe metne çevirir. İngilizce için ikinci parametre 'en' verilir. */
const textOf = (message: AccountMessage | undefined, lang: 'tr' | 'en' = 'tr') =>
  renderAccountMessage(message, lang) ?? '';

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

const UNVERIFIED_REASONS = [
  'network',
  'timeout',
  'missing_rpc',
  'permission_denied',
  'rpc_error',
  'no_profile',
  'malformed',
] as const;

const unverified = (reason: (typeof UNVERIFIED_REASONS)[number]) => ({
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
  assert.match(textOf(access.message), /doğrulanamadı/);
});

test('an unverified lookup never signs the user out', () => {
  for (const reason of UNVERIFIED_REASONS) {
    assert.equal(mustSignOut(evaluateAccountAccess(unverified(reason))), false, reason);
  }
});

test('an unverified lookup never shows a ban message, whatever the reason', () => {
  for (const reason of UNVERIFIED_REASONS) {
    const access = evaluateAccountAccess(unverified(reason));
    assert.equal(access.expiredBan, false, reason);
    assert.equal(access.teamRestricted, false, reason);
    assert.doesNotMatch(textOf(access.message), /kalıcı|askıya|yasaklan/, reason);
  }
});

test('network and timeout failures ask the user to check the connection', () => {
  assert.match(textOf(evaluateAccountAccess(unverified('network')).message), /bağlantınızı/);
  assert.match(textOf(evaluateAccountAccess(unverified('timeout')).message), /bağlantınızı/);
});

test('a missing RPC or a missing profile is not reported as a network problem', () => {
  assert.doesNotMatch(textOf(evaluateAccountAccess(unverified('missing_rpc')).message), /bağlantınızı/);
  assert.doesNotMatch(textOf(evaluateAccountAccess(unverified('no_profile')).message), /bağlantınızı/);
});

test('an unverified lookup tells the user to try again, except a missing profile which states its own case', () => {
  for (const reason of UNVERIFIED_REASONS.filter((r) => r !== 'no_profile')) {
    assert.match(textOf(evaluateAccountAccess(unverified(reason)).message), /tekrar/, reason);
  }
});

test('each unverified reason has its own message, not one shared generic text', () => {
  const messages = UNVERIFIED_REASONS.map((reason) => textOf(evaluateAccountAccess(unverified(reason)).message));
  assert.ok(messages.every((m) => m.length > 0));
  assert.equal(new Set(messages).size, UNVERIFIED_REASONS.length);
});

test('a missing profile shows the profile-not-created message and keeps the account open', () => {
  const access = evaluateAccountAccess(unverified('no_profile'));
  assert.equal(
    textOf(access.message),
    'Oyuncu profiliniz henüz oluşturulmamış. Hesabınız açık, ancak bazı işlemler geçici olarak kullanılamıyor.',
  );
  assert.equal(access.allowed, true);
  assert.equal(access.profileWriteAllowed, false);
});

test('a missing RPC says it is not a restriction', () => {
  assert.match(textOf(evaluateAccountAccess(unverified('missing_rpc')).message), /kısıtlama anlamına gelmez/);
});

test('a permission failure is reported as a permission problem, not a connection or server problem', () => {
  const message = textOf(evaluateAccountAccess(unverified('permission_denied')).message);
  assert.match(message, /yetki/);
  assert.doesNotMatch(message, /bağlantınızı/);
});

// --- Dil: her mesaj Türkçe ve İngilizce çevrilir; eksik çeviri anahtarın kendisini gösterir ---

test('every unverified reason renders a real English message, not a translation key', () => {
  for (const reason of UNVERIFIED_REASONS) {
    const en = textOf(evaluateAccountAccess(unverified(reason)).message, 'en');
    assert.ok(en.length > 0, reason);
    assert.doesNotMatch(en, /^accountMsg_/, reason);
    assert.notEqual(en, textOf(evaluateAccountAccess(unverified(reason)).message, 'tr'), reason);
  }
});

test('the English no-profile message is the English wording of the same state', () => {
  assert.equal(
    textOf(evaluateAccountAccess(unverified('no_profile')).message, 'en'),
    'Your player profile has not been created yet. Your account is open, but some actions are temporarily unavailable.',
  );
});

test('English ban messages use the English subject, date and reason', () => {
  const access = evaluateAccountAccess(
    parse([profileRow({ account_status: 'banned', banned_until: '2027-01-15T12:00:00.000Z', ban_reason: 'spam' })]),
  );
  const en = textOf(access.message, 'en');
  assert.match(en, /^Your account is suspended until January 15, 2027\./);
  assert.match(en, /Reason: spam$/);
  assert.doesNotMatch(en, /Hesab|Sebep|Ocak/);
});

test('English team restriction names a team the user owns', () => {
  const access = evaluateAccountAccess(
    parse([profileRow(), teamRow({ account_status: 'banned', ban_is_permanent: true })]),
  );
  assert.equal(textOf(access.teamMessage, 'en'), 'A team you own has been permanently banned.');
});

test('the language of a rendered message follows the requested language, not the stored data', () => {
  const access = evaluateAccountAccess(unverified('rpc_error'));
  assert.notEqual(textOf(access.message, 'en'), textOf(access.message, 'tr'));
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

test('a permission error is permission_denied, not a network error', () => {
  assert.equal(classifyAccountStatusError({ code: '42501', message: 'permission denied' }), 'permission_denied');
  assert.equal(classifyAccountStatusError({ message: 'permission denied for table profiles' }), 'permission_denied');
});

test('other server errors are rpc_error, not a network or permission error', () => {
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
  assert.match(textOf(access.teamMessage), /Sahip olduğunuz bir takım kalıcı/);
  assert.match(textOf(access.teamMessage), /Sebep: kötü takım/);
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
  assert.match(textOf(access.message), /tarihine kadar/);
});

// --- Sıra bağımsızlığı: ilk satır karar değildir ---

test('a banned profile is denied even when a clean team row comes first', () => {
  const access = evaluateAccountAccess(parse([
    teamRow({ account_status: 'active' }),
    profileRow({ account_status: 'banned', ban_is_permanent: true, ban_reason: 'spam' }),
  ]));
  assert.equal(access.allowed, false);
  assert.match(textOf(access.message), /kalıcı/);
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
    assert.match(textOf(access.teamMessage), /Sahip olduğunuz bir takım kalıcı/);
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
  assert.match(textOf(access.message), /Sebep: spam/);
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
  assert.match(textOf(access.message), /kalıcı/);
  assert.match(textOf(access.message), /Sebep: spam/);
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
  assert.match(textOf(access.message), /tarihine kadar/);
});

test('an expired temporary profile ban is allowed and flagged for clearing', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', banned_until: past(1) })]));
  assert.equal(access.allowed, true);
  assert.equal(access.expiredBan, true);
});

test('a temporary ban without an end date is still denied and does not crash', () => {
  const access = evaluateAccountAccess(parse([profileRow({ account_status: 'banned', banned_until: null, ban_is_permanent: false })]));
  assert.equal(access.allowed, false);
  assert.match(textOf(access.message), /askıya alınmıştır/);
});

test('an inactive account is denied', () => {
  assert.equal(evaluateAccountAccess(parse([profileRow({ account_status: 'inactive' })])).allowed, false);
});

// v2 yoksa (canlı) v1'e düşülür; diğer hatalar v1'e düşmez ve doğrulanamadı olarak kalır.
test('the status lookup prefers v2 and falls back to v1 only when v2 is missing on the server', async () => {
  const calls: string[] = [];
  const missingV2 = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_my_account_status_v2' } };
  const v1 = { data: [profileRow()], error: null };
  const response = await callAccountStatusRpc(async (fn) => {
    calls.push(fn);
    return fn === 'get_my_account_status_v2' ? missingV2 : v1;
  });
  assert.deepEqual(calls, ['get_my_account_status_v2', 'get_my_account_status']);
  assert.deepEqual(response, v1);
});

test('a v2 success is used as is, without calling v1', async () => {
  const calls: string[] = [];
  const v2 = { data: [profileRow({ subject_id: UID, subject_type: 'profile' }), teamRow({ subject_id: TEAM_ID, subject_type: 'team' })], error: null };
  const response = await callAccountStatusRpc(async (fn) => {
    calls.push(fn);
    return v2;
  });
  assert.deepEqual(calls, ['get_my_account_status_v2']);
  assert.deepEqual(response, v2);
});

test('a non-missing v2 error is not replaced by v1 and stays unverified', async () => {
  const calls: string[] = [];
  const denied = { data: null, error: { code: '42501', message: 'permission denied' } };
  const response = await callAccountStatusRpc(async (fn) => {
    calls.push(fn);
    return denied;
  });
  assert.deepEqual(calls, ['get_my_account_status_v2']);
  assert.equal(classifyAccountStatusError(response.error ?? {}), 'permission_denied');
});
