import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliedOpportunityIds,
  matchesOpportunityFilter,
  normalizeOpportunities,
  normalizeOpportunity,
  type OpportunityRow,
} from '../lib/opportunities';

const op = (id: string, over: Partial<OpportunityRow> = {}): OpportunityRow => ({
  id,
  title: `Fırsat ${id}`,
  subtitle: '',
  badge: 'Akademi',
  badgeColor: '#000000',
  location: 'İstanbul, TR',
  age: '',
  deadline: '',
  ...over,
});

test('a database row needs an id and a title; missing text fields become empty strings', () => {
  assert.equal(normalizeOpportunity({ title: 'x' }), null, 'no id');
  assert.equal(normalizeOpportunity({ id: 'a', title: '   ' }), null, 'blank title');
  assert.equal(normalizeOpportunity(null), null);
  assert.deepEqual(normalizeOpportunity({ id: 7, title: 'Deneme' }), {
    id: '7',
    title: 'Deneme',
    subtitle: '',
    badge: '',
    badgeColor: '',
    location: '',
    age: '',
    deadline: '',
  });
});

test('database columns map to the screen model in the same order', () => {
  const rows = normalizeOpportunities([
    { id: 'b', title: 'İkinci', subtitle: 'alt', badge: 'Scout', badge_color: '#111', location: 'Ankara', age_range: '18-23', deadline: '01.12' },
    { title: 'kimliksiz' },
    { id: 'a', title: 'Birinci' },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ['b', 'a']);
  assert.equal(rows[0].badgeColor, '#111');
  assert.equal(rows[0].age, '18-23');
  assert.equal(rows[0].deadline, '01.12');
});

test('an application whose opportunity was deleted is skipped, not shown as applied', () => {
  const list = [op('kept')];
  const applied = appliedOpportunityIds(
    [{ opportunity_id: 'kept' }, { opportunity_id: 'deleted-one' }, { opportunity_id: null }],
    list,
  );
  assert.deepEqual([...applied], ['kept']);
});

test('no opportunities means no applied items, whatever the applications say', () => {
  assert.equal(appliedOpportunityIds([{ opportunity_id: 'x' }], []).size, 0);
});

test('numeric and text ids of the same opportunity match', () => {
  const applied = appliedOpportunityIds([{ opportunity_id: 5 }], [op('5')]);
  assert.deepEqual([...applied], ['5']);
});

test('filters: all, Türkiye and Avrupa use the location, a badge filter matches the badge', () => {
  const tr = op('1', { location: 'Bursa, TR', badge: 'Scout' });
  const eu = op('2', { location: 'Berlin, DE', badge: 'Akademi' });
  assert.equal(matchesOpportunityFilter(tr, 'Tümü'), true);
  assert.equal(matchesOpportunityFilter(tr, 'Türkiye'), true);
  assert.equal(matchesOpportunityFilter(eu, 'Türkiye'), false);
  assert.equal(matchesOpportunityFilter(eu, 'Avrupa'), true);
  assert.equal(matchesOpportunityFilter(tr, 'Avrupa'), false);
  assert.equal(matchesOpportunityFilter(eu, 'Akademi'), true);
  assert.equal(matchesOpportunityFilter(tr, 'Akademi'), false);
});
