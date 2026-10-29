/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as columns from '../lib/columns';

const BAN_FIELDS = ['account_status', 'banned_until', 'ban_is_permanent', 'ban_reason', 'banned_by', 'banned_at'];

function listOf(value: string): string[] {
  return value.split(',').map((c) => c.trim());
}

test('team lists never expose ban or moderation fields to other users', () => {
  const cols = listOf(columns.TEAM_COLUMNS);
  for (const field of BAN_FIELDS) {
    assert.ok(!cols.includes(field), `TEAM_COLUMNS must not include ${field}`);
  }
});

test('no explicit column list is a wildcard', () => {
  for (const [name, value] of Object.entries(columns)) {
    assert.ok(!listOf(value as string).includes('*'), `${name} must be an explicit list`);
  }
});

test('post columns use the live highlight column names', () => {
  const cols = listOf(columns.POST_COLUMNS);
  assert.ok(cols.includes('highlight_start_seconds'));
  assert.ok(cols.includes('highlight_end_seconds'));
  assert.ok(!cols.includes('highlight_start_sec'));
});

test('messages list carries the live sender column, not a receiver column', () => {
  const cols = listOf(columns.MESSAGE_COLUMNS);
  assert.ok(cols.includes('sender_user_id'));
  assert.ok(!cols.includes('receiver_id'));
});
