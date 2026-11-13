/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_TASK_DEFS,
  PROFILE_TASK_TOTAL,
  PROFILE_SCORE_MAX,
  buildProfileTaskRows,
  parseScoreBreakdown,
} from '../lib/profileTasks';

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
