/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNameMap, displayName, partnerIdFor } from '../lib/chatNames';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const FALLBACK = 'Kullanıcı';

test('the partner is the other participant, whichever side the user is on', () => {
  assert.equal(partnerIdFor({ participant_a: ME, participant_b: OTHER }, ME), OTHER);
  assert.equal(partnerIdFor({ participant_a: OTHER, participant_b: ME }, ME), OTHER);
});

test('a conversation the user is not part of has no partner', () => {
  assert.equal(partnerIdFor({ participant_a: OTHER, participant_b: STRANGER }, ME), null);
});

test('a missing or empty participant id yields no partner instead of an empty id', () => {
  assert.equal(partnerIdFor({ participant_a: ME, participant_b: null }, ME), null);
  assert.equal(partnerIdFor({ participant_a: ME, participant_b: '' }, ME), null);
});

test('a visible full name is used for the partner', () => {
  const names = buildNameMap([{ user_id: OTHER, full_name: 'Ayşe Demir' }]);
  assert.equal(displayName(OTHER, names, FALLBACK), 'Ayşe Demir');
});

test('a partner with no public profile row falls back to the default name', () => {
  const names = buildNameMap([{ user_id: STRANGER, full_name: 'Başka Biri' }]);
  assert.equal(displayName(OTHER, names, FALLBACK), FALLBACK);
});

test('a null, blank or whitespace-only name falls back instead of showing empty text', () => {
  const names = buildNameMap([
    { user_id: OTHER, full_name: null },
    { user_id: STRANGER, full_name: '   ' },
  ]);
  assert.equal(displayName(OTHER, names, FALLBACK), FALLBACK);
  assert.equal(displayName(STRANGER, names, FALLBACK), FALLBACK);
});

test('names are trimmed', () => {
  const names = buildNameMap([{ user_id: OTHER, full_name: '  Can Yılmaz ' }]);
  assert.equal(displayName(OTHER, names, FALLBACK), 'Can Yılmaz');
});

test('a failed profile lookup (no data) leaves every partner on the fallback, without throwing', () => {
  const names = buildNameMap(null);
  assert.equal(names.size, 0);
  assert.equal(displayName(OTHER, names, FALLBACK), FALLBACK);
  assert.equal(displayName(OTHER, buildNameMap(undefined), FALLBACK), FALLBACK);
});
