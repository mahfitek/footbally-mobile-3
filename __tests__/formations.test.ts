import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_FORMATS,
  FORMATIONS,
  parseFormation,
  isFormationForFormat,
  getFormationSlots,
  preferredRolesFor,
  autoFillLineup,
  buildLineupEntries,
  roleLabel,
  type LineupCandidate,
} from '../lib/formations';

const REQUIRED: Record<number, string[]> = {
  5: ['1-2-1', '2-2', '1-1-2', '2-1-1'],
  6: ['2-2-1', '2-1-2', '3-1-1', '1-3-1'],
  7: ['2-3-1', '3-2-1', '3-1-2', '2-2-2', '1-3-2'],
  8: ['3-3-1', '2-3-2', '3-2-2', '2-4-1', '3-1-3'],
  9: ['3-3-2', '3-2-3', '2-4-2', '4-3-1', '3-4-1'],
  10: ['3-3-3', '4-3-2', '3-4-2', '4-4-1', '3-5-1'],
  11: ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '5-3-2', '4-1-4-1', '4-5-1'],
};

test('every format 5..11 is offered and includes the required formations', () => {
  assert.deepEqual([...MATCH_FORMATS], [5, 6, 7, 8, 9, 10, 11]);
  for (const format of MATCH_FORMATS) {
    for (const formation of REQUIRED[format]) {
      assert.ok(FORMATIONS[format].includes(formation), `${format}v${format} is missing ${formation}`);
    }
  }
});

test('outfield players plus goalkeeper equal the format for every formation', () => {
  for (const format of MATCH_FORMATS) {
    for (const formation of FORMATIONS[format]) {
      const lines = parseFormation(formation);
      assert.ok(lines, `${formation} is not parseable`);
      const outfield = lines.reduce((sum, n) => sum + n, 0);
      assert.equal(outfield + 1, format, `${format}v${format} ${formation}: ${outfield} outfield + GK`);
      assert.equal(getFormationSlots(format, formation).length, format, `${formation} slot count`);
    }
  }
});

test('every slot list starts with one goalkeeper and has unique keys', () => {
  for (const format of MATCH_FORMATS) {
    for (const formation of FORMATIONS[format]) {
      const slots = getFormationSlots(format, formation);
      assert.equal(slots[0].role, 'GK');
      assert.equal(slots.filter((s) => s.role === 'GK').length, 1);
      assert.equal(new Set(slots.map((s) => s.key)).size, slots.length, `${formation} keys unique`);
      for (const slot of slots) {
        assert.ok(slot.x >= 0 && slot.x <= 100 && slot.y >= 0 && slot.y <= 100, `${formation} coords in range`);
      }
    }
  }
});

test('4-2-3-1 uses DEF, DM, ATT, FWD lines and 4-1-4-1 uses DM and MID', () => {
  const roles = (formation: string) => [...new Set(getFormationSlots(11, formation).map((s) => s.role))];
  assert.deepEqual(roles('4-2-3-1'), ['GK', 'DEF', 'DM', 'ATT', 'FWD']);
  assert.deepEqual(roles('4-1-4-1'), ['GK', 'DEF', 'DM', 'MID', 'FWD']);
  assert.equal(getFormationSlots(11, '4-4-2').filter((s) => s.role === 'DEF').length, 4);
});

test('invalid combinations are rejected', () => {
  assert.equal(parseFormation('abc'), null);
  assert.equal(parseFormation('4-4-'), null);
  assert.equal(isFormationForFormat(7, '4-4-2'), false, '4-4-2 is not a 7v7 formation');
  assert.equal(isFormationForFormat(4, '2-1-1'), false, 'format 4 is out of range');
  assert.deepEqual(getFormationSlots(7, '4-4-2'), []);
});

const member = (user_id: string, position: string | null): LineupCandidate => ({ user_id, name: `P${user_id}`, position });

test('preferred roles understand profile and legacy position values', () => {
  assert.deepEqual(preferredRolesFor('Kaleci'), ['GK']);
  assert.deepEqual(preferredRolesFor('Defans'), ['DEF', 'DM']);
  assert.equal(preferredRolesFor('Orta Saha')[0], 'DM');
  assert.deepEqual(preferredRolesFor('Forvet'), ['FWD', 'ATT']);
  assert.deepEqual(preferredRolesFor('Kanat'), ['MID', 'ATT', 'FWD']);
  assert.deepEqual(preferredRolesFor('Stoper'), ['DEF', 'DM']);
  assert.deepEqual(preferredRolesFor('CAM'), ['ATT', 'MID']);
  assert.deepEqual(preferredRolesFor(''), []);
  assert.deepEqual(preferredRolesFor(null), []);
});

test('auto fill places the goalkeeper first, then matching positions, then leftovers', () => {
  const slots = getFormationSlots(7, '2-3-1');
  const squad = [
    member('a', 'Forvet'),
    member('b', 'Kaleci'),
    member('c', 'Defans'),
    member('d', 'Defans'),
    member('e', 'Orta Saha'),
    member('f', null),
    member('g', 'Kanat'),
  ];
  const assigned = autoFillLineup(squad, slots);
  assert.equal(assigned.length, 7);
  assert.equal(assigned[0]?.user_id, 'b', 'goalkeeper in GK slot');
  const ids = assigned.filter(Boolean).map((m) => m!.user_id);
  assert.equal(new Set(ids).size, ids.length, 'no player appears twice');
  assert.equal(ids.length, 7, 'seven players placed for seven slots');
  assert.equal(assigned.findIndex((m) => m?.user_id === 'a'), slots.findIndex((s) => s.role === 'FWD'), 'forward in FWD');
  assert.ok(ids.includes('f'), 'player without position fills a leftover slot');
});

test('a second goalkeeper goes to an outfield slot, not a fake keeper slot', () => {
  const slots = getFormationSlots(5, '1-2-1');
  const squad = [member('k1', 'Kaleci'), member('k2', 'Kaleci'), member('x', 'Forvet'), member('y', 'Forvet'), member('z', 'Forvet')];
  const assigned = autoFillLineup(squad, slots);
  assert.equal(assigned[0]?.user_id, 'k1');
  assert.equal(assigned.filter((m) => m?.user_id === 'k2').length, 1, 'second keeper placed once');
  assert.equal(assigned.filter(Boolean).length, 5, 'five slots filled from five players');
});

test('with fewer players than slots, the rest stay empty and no goalkeeper is faked', () => {
  const slots = getFormationSlots(11, '4-4-2');
  const assigned = autoFillLineup([member('a', 'Forvet'), member('b', 'Defans')], slots);
  assert.equal(assigned[0], null, 'no goalkeeper available: GK slot stays empty');
  assert.equal(assigned.filter(Boolean).length, 2);
});

test('lineup entries follow slot order and reject a duplicated player', () => {
  const slots = getFormationSlots(5, '2-1-1');
  const assigned = autoFillLineup([member('k', 'Kaleci'), member('d', 'Defans'), member('m', 'Orta Saha')], slots);
  const entries = buildLineupEntries(slots, assigned);
  assert.deepEqual(entries.map((e) => e.slot), slots.filter((_, i) => assigned[i]).map((s) => s.key));
  assert.equal(entries[0].user_id, 'k');
  assert.ok(entries.every((e) => typeof e.name === 'string' && e.name.length > 0));

  const dup = [member('x', 'Defans'), member('x', 'Defans'), null, null, null];
  assert.throws(() => buildLineupEntries(getFormationSlots(5, '2-1-1'), dup), /duplicate_lineup_player/);
});

test('role labels follow the chosen language', () => {
  assert.equal(roleLabel('GK', 'tr'), 'KAL');
  assert.equal(roleLabel('GK', 'en'), 'GK');
  assert.equal(roleLabel('ATT', 'tr'), 'ATK');
});
