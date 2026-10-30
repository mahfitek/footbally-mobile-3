/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatchInsert, classifyMatchError, classifyMatchResult, type MatchBase } from '../lib/matchCreation';

const BASE: MatchBase = {
  title: 'Cumartesi maçı',
  date: '2026-11-07',
  time: '18:30',
  location: 'Kadıköy halı saha',
  city: 'İstanbul, Kadıköy',
  required_players: 14,
  type: '7v7',
  category: 'Eğlence',
  creator_id: '11111111-1111-4111-8111-111111111111',
};
const TEAM_ID = '22222222-2222-4222-8222-222222222222';

test('a personal match never sends team_id, not even as null', () => {
  const row = buildMatchInsert(BASE, { kind: 'personal' });
  assert.equal('team_id' in row, false);
  assert.equal(row.creator_id, BASE.creator_id);
});

test('a team match sends the chosen team_id alongside the base fields', () => {
  const row = buildMatchInsert(BASE, { kind: 'team', teamId: TEAM_ID });
  assert.equal(row.team_id, TEAM_ID);
  assert.equal(row.title, BASE.title);
});

test('server scope errors map to their specific reason', () => {
  const team = { kind: 'team' as const, teamId: TEAM_ID };
  assert.equal(classifyMatchError({ code: '42501', message: 'not_team_manager' }, team), 'not_team_manager');
  assert.equal(classifyMatchError({ code: '42501', message: 'team_archived' }, team), 'team_archived');
  assert.equal(classifyMatchError({ code: '42501', message: 'team_restricted' }, team), 'team_restricted');
  assert.equal(classifyMatchError({ code: '42501', message: 'personal_account_restricted' }, { kind: 'personal' }), 'personal_account_restricted');
  assert.equal(classifyMatchError({ code: '23503', message: 'team_not_found' }, team), 'team_not_found');
});

test('a missing team_id column is team_unsupported only for a team match', () => {
  const missing = { code: '42703', message: 'column matches.team_id does not exist' };
  assert.equal(classifyMatchError(missing, { kind: 'team', teamId: TEAM_ID }), 'team_unsupported');
  assert.equal(classifyMatchError(missing, { kind: 'personal' }), 'unknown');
});

test('unrecognised errors stay unknown and success is created', () => {
  assert.equal(classifyMatchError({ code: 'XX000', message: 'boom' }, { kind: 'personal' }), 'unknown');
  assert.deepEqual(classifyMatchResult({ error: null }, { kind: 'personal' }), { status: 'created' });
  assert.deepEqual(classifyMatchResult({ error: { code: '42501', message: 'personal_account_restricted' } }, { kind: 'personal' }), {
    status: 'failed',
    reason: 'personal_account_restricted',
  });
});
