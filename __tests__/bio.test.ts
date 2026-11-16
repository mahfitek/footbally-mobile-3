import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIO_MAX_LENGTH, bioLength, bioView, checkBio } from '../lib/bio';
import { buildProfilePatch, type ProfileFormValues } from '../lib/profileCompletion';

const values = (over: Partial<ProfileFormValues> = {}): ProfileFormValues => ({
  fullName: 'Test Oyuncu',
  position: '',
  city: '',
  district: '',
  foot: '',
  age: '',
  height: '',
  weight: '',
  club: '',
  ...over,
});

test('bio is limited to 500 characters, counted as code points', () => {
  assert.equal(BIO_MAX_LENGTH, 500);
  assert.equal(checkBio('a'.repeat(500)).ok, true, '500 is allowed');
  assert.deepEqual(checkBio('a'.repeat(501)), { ok: false, reasonKey: 'bio_tooLong' });
  assert.equal(checkBio('😀'.repeat(500)).ok, true, 'emoji count once, like the database char_length');
  assert.deepEqual(checkBio('😀'.repeat(501)), { ok: false, reasonKey: 'bio_tooLong' });
  assert.equal(bioLength('ğüşıöç'), 6);
});

test('the length is checked after trimming surrounding spaces', () => {
  const padded = `   ${'b'.repeat(500)}   `;
  assert.deepEqual(checkBio(padded), { ok: true, value: 'b'.repeat(500) });
});

test('an empty or blank bio is saved as null, which means no bio', () => {
  assert.deepEqual(checkBio(''), { ok: true, value: null });
  assert.deepEqual(checkBio('   \n  '), { ok: true, value: null });
});

test('an ordinary Turkish introduction passes moderation and is trimmed', () => {
  assert.deepEqual(checkBio('  Orta saha oynarım, haftada iki maç arıyorum.  '), {
    ok: true,
    value: 'Orta saha oynarım, haftada iki maç arıyorum.',
  });
});

test('a phone number in the bio is rejected as personal data', () => {
  assert.deepEqual(checkBio('Bana 0532 111 22 33 numarasından ulaşın'), {
    ok: false,
    reasonKey: 'moderation_personalData',
  });
});

test('script markup in the bio is rejected as malicious code', () => {
  assert.deepEqual(checkBio('<script>alert(1)</script>'), {
    ok: false,
    reasonKey: 'moderation_maliciousCode',
  });
});

test('the bio view: own empty bio shows the hint, other empty bio hides the section', () => {
  assert.deepEqual(bioView({ isOwn: true, bio: null, blocked: false }), { mode: 'owner_empty' });
  assert.deepEqual(bioView({ isOwn: true, bio: '  ', blocked: false }), { mode: 'owner_empty' });
  assert.deepEqual(bioView({ isOwn: false, bio: null, blocked: false }), { mode: 'hidden' });
});

test('the bio view: a filled bio is shown on both profiles', () => {
  assert.deepEqual(bioView({ isOwn: true, bio: ' Merhaba ', blocked: false }), { mode: 'text', text: 'Merhaba' });
  assert.deepEqual(bioView({ isOwn: false, bio: 'Merhaba', blocked: false }), { mode: 'text', text: 'Merhaba' });
});

test('a blocked user\'s bio is hidden even when it has text', () => {
  assert.deepEqual(bioView({ isOwn: false, bio: 'Gizli metin', blocked: true }), { mode: 'hidden' });
});

test('saving the profile writes bio only when the form provides it, and empty bio as null', () => {
  assert.equal('bio' in buildProfilePatch(values()), false, 'no bio key when the form has no bio');
  assert.equal(buildProfilePatch(values({ bio: '' })).bio, null);
  assert.equal(buildProfilePatch(values({ bio: 'Kaleci' })).bio, 'Kaleci');
});
