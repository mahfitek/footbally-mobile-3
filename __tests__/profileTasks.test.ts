/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROFILE_TASK_DEFS,
  PROFILE_TASK_TOTAL,
  PROFILE_SCORE_MAX,
  NEGATIVE_APPLICATION_STATUSES,
  buildProfileTaskRows,
  countsAsApplication,
  countsAsPaidPremium,
  parseScoreBreakdown,
} from '../lib/profileTasks';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const future = '2026-12-14T12:00:00Z';
const past = '2026-10-14T12:00:00Z';

test('"Premium\'a geç" counts only active, unexpired, paid or Apple subscriptions', () => {
  const base = { plan: 'Monthly', status: 'active', amount: 99, payment_provider: null, expires_at: future };
  assert.equal(countsAsPaidPremium(base, NOW), true);
  assert.equal(countsAsPaidPremium({ ...base, plan: 'reward', amount: 0 }, NOW), false);
  assert.equal(countsAsPaidPremium({ ...base, plan: 'admin', amount: null }, NOW), false);
  assert.equal(countsAsPaidPremium({ ...base, amount: 0 }, NOW), false);
  assert.equal(countsAsPaidPremium({ ...base, amount: 0, payment_provider: 'apple' }, NOW), true);
  assert.equal(countsAsPaidPremium({ ...base, status: 'Cancelled' }, NOW), false);
  assert.equal(countsAsPaidPremium({ ...base, expires_at: past }, NOW), false);
  assert.equal(countsAsPaidPremium({ ...base, expires_at: null }, NOW), true);
});

test('applications with a negative status do not count; others do', () => {
  for (const status of NEGATIVE_APPLICATION_STATUSES) {
    assert.equal(countsAsApplication(status), false, status);
    assert.equal(countsAsApplication(status.toUpperCase()), false, status.toUpperCase());
  }
  assert.equal(countsAsApplication('applied'), true);
  assert.equal(countsAsApplication('accepted'), true);
  assert.equal(countsAsApplication(null), true);
});

test('the server SQL uses the same negative application statuses and reward rule', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261114120100_profile_task_score.sql'), 'utf8');
  for (const status of NEGATIVE_APPLICATION_STATUSES) {
    assert.ok(sql.includes(`'${status}'`), `server SQL is missing status ${status}`);
  }
  assert.ok(sql.includes("coalesce(s.plan, '') <> 'reward'"));
  assert.ok(sql.includes("s.payment_provider = 'apple'"));
});

// Sunucu (compute_profile_task_breakdown) ile istemci puan tablosu aynı olmalı; sapma testte yakalanır.
test('task ids and points match the server breakdown in the migration', () => {
  // npm test repo kökünden çalışır; derlenmiş çıktı klasöründen (__dirname) okunmaz.
  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '20261114120100_profile_task_score.sql'), 'utf8');
  const server = new Map<string, number>();
  for (const m of sql.matchAll(/'id',\s*'(\w+)',\s*'points',\s*(\d+)/g)) {
    server.set(m[1], Number(m[2]));
  }
  assert.equal(server.size, PROFILE_TASK_DEFS.length);
  for (const def of PROFILE_TASK_DEFS) {
    assert.equal(server.get(def.id), def.points, `points mismatch for ${def.id}`);
  }
});

test('task points add up to exactly the 100-point score maximum', () => {
  assert.equal(PROFILE_TASK_TOTAL, 100);
  assert.equal(PROFILE_TASK_TOTAL, PROFILE_SCORE_MAX);
});

test('the twelve existing tasks total 50 and the three AI/video tasks total 50', () => {
  const newIds = new Set(['aiCv', 'aiAnalysis', 'video']);
  const newTotal = PROFILE_TASK_DEFS.filter((d) => newIds.has(d.id)).reduce((s, d) => s + d.points, 0);
  assert.equal(PROFILE_TASK_DEFS.length, 15);
  assert.equal(newTotal, 50);
  assert.equal(PROFILE_TASK_TOTAL - newTotal, 50);
});

test('task ids are unique', () => {
  const ids = PROFILE_TASK_DEFS.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('a breakdown is parsed and clamped to 0-100', () => {
  const parsed = parseScoreBreakdown({ score: 140, tasks: [{ id: 'name', points: 5, done: true }] });
  assert.deepEqual(parsed, { score: 100, tasks: [{ id: 'name', points: 5, done: true }] });
  assert.equal(parseScoreBreakdown({ score: -4, tasks: [] })?.score, 0);
});

test('a malformed breakdown is rejected instead of being guessed', () => {
  assert.equal(parseScoreBreakdown(null), null);
  assert.equal(parseScoreBreakdown({ score: '56', tasks: [] }), null);
  assert.equal(parseScoreBreakdown({ score: 10 }), null);
  assert.equal(parseScoreBreakdown({ score: 10, tasks: [{ id: 'name', points: 5, done: 'yes' }] }), null);
});

test('rows follow the definition order and use only server done flags', () => {
  const rows = buildProfileTaskRows({
    score: 5,
    tasks: [{ id: 'video', points: 20, done: false }, { id: 'name', points: 5, done: true }],
  });
  assert.equal(rows.length, PROFILE_TASK_DEFS.length);
  assert.equal(rows[0].id, 'name');
  assert.equal(rows[0].done, true);
  assert.equal(rows.find((r) => r.id === 'video')?.done, false);
  // Sunucunun hiç göndermediği görev tamamlanmış sayılmaz.
  assert.equal(rows.find((r) => r.id === 'aiCv')?.done, false);
});
