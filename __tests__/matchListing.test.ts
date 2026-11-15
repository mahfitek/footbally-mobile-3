import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LISTING_TYPES,
  listingTypeOf,
  formatOfListing,
  isPaidListing,
  filterListings,
  buildListingRow,
  type ListingDraft,
  type ListingRowLike,
} from '../lib/matchListing';
import { getFormationSlots, buildLineupEntries, autoFillLineup } from '../lib/formations';

const base: ListingDraft = {
  listingType: 'players',
  title: ' Akşam maçı ',
  date: '2026-12-01',
  time: '20:00',
  location: 'Saha A',
  city: 'İstanbul',
  district: 'Kadıköy',
  format: 7,
  category: 'Eğlence',
  description: '  Herkes davetli  ',
  positions: ['Defans', 'Forvet', 'Defans'],
  missingPlayers: 2,
  teamId: null,
  formation: '2-3-1',
  lineup: [],
  isPaid: false,
  feePerPerson: null,
  feeNote: '',
  creatorId: 'u-1',
};

test('listing types are the three agreed values', () => {
  assert.deepEqual([...LISTING_TYPES], ['individual', 'opponent', 'players']);
});

test('legacy rows without listing_type behave as players and format is read from type text', () => {
  assert.equal(listingTypeOf({ listing_type: null }), 'players');
  assert.equal(listingTypeOf({ listing_type: 'unknown' }), 'players');
  assert.equal(listingTypeOf({ listing_type: 'opponent' }), 'opponent');
  assert.equal(formatOfListing({ type: '7v7', match_format: null }), 7);
  assert.equal(formatOfListing({ type: '11v11' }), 11);
  assert.equal(formatOfListing({ type: '4v4' }), null, 'out of range');
  assert.equal(formatOfListing({ type: 'Antrenman' }), null);
  assert.equal(formatOfListing({ type: '5v7', match_format: null }), null, 'mismatched text is not a format');
  assert.equal(formatOfListing({ type: '5v5', match_format: 9 }), 9, 'match_format wins over type text');
});

test('paid detection uses the per-person fee column', () => {
  assert.equal(isPaidListing({ team_payment: 0 }), false);
  assert.equal(isPaidListing({ team_payment: null }), false);
  assert.equal(isPaidListing({ team_payment: '150' }), true);
  assert.equal(isPaidListing({ team_payment: 75 }), true);
});

const rows: (ListingRowLike & { id: number })[] = [
  { id: 1, type: '7v7' },
  { id: 2, type: '7v7', listing_type: 'opponent', match_format: 7 },
  { id: 3, type: '11v11', listing_type: 'individual', match_format: 11 },
  { id: 4, type: '5v5', listing_type: 'players', match_format: 5 },
];

test('filters by listing type and format, and keeps legacy rows visible when "all" is chosen', () => {
  assert.equal(filterListings(rows, { listingType: 'all', format: 'all' }).length, 4);
  assert.deepEqual(filterListings(rows, { listingType: 'players', format: 'all' }).map((r) => r.id), [1, 4]);
  assert.deepEqual(filterListings(rows, { listingType: 'all', format: 7 }).map((r) => r.id), [1, 2]);
  assert.deepEqual(filterListings(rows, { listingType: 'opponent', format: 7 }).map((r) => r.id), [2]);
  assert.deepEqual(filterListings(rows, { listingType: 'individual', format: 5 }).map((r) => r.id), []);
});

test('players listing: positions and missing count are required and stored as agreed', () => {
  const result = buildListingRow(base);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const row = result.row;
  assert.equal(row.listing_type, 'players');
  assert.equal(row.match_format, 7);
  assert.equal(row.type, '7v7', 'legacy type text is kept for the web');
  assert.equal(row.required_players, 2, 'required_players = missing players');
  assert.deepEqual(row.needed_positions, ['Defans', 'Forvet'], 'positions de-duplicated');
  assert.equal(row.city, 'İstanbul, Kadıköy');
  assert.equal(row.title, 'Akşam maçı', 'title trimmed');
  assert.equal(row.description, 'Herkes davetli');
  assert.equal(row.formation, '2-3-1');
  assert.equal(row.team_payment, 0);
  assert.equal(row.fee_note, null);
  assert.equal('team_id' in row, false, 'personal listing sends no team_id');
  assert.equal('lineup' in row, false);
});

test('individual listing: one player, team never sent, positions required', () => {
  const result = buildListingRow({ ...base, listingType: 'individual', missingPlayers: null, teamId: 't-1', lineup: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.row.required_players, 1);
  assert.equal('team_id' in result.row, false, 'individual listings are never team listings');
  const noPositions = buildListingRow({ ...base, listingType: 'individual', positions: [] });
  assert.deepEqual(noPositions, { ok: false, error: 'positions_required' });
});

test('opponent listing requires an owned team and uses the format as required players', () => {
  const noTeam = buildListingRow({ ...base, listingType: 'opponent', teamId: null, positions: [] });
  assert.deepEqual(noTeam, { ok: false, error: 'team_required' });
  const ok = buildListingRow({ ...base, listingType: 'opponent', teamId: 't-9', positions: [], missingPlayers: null });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.row.team_id, 't-9');
  assert.equal(ok.row.required_players, 7);
  assert.deepEqual(ok.row.needed_positions, []);
});

test('missing player count must be between 1 and format minus one', () => {
  assert.deepEqual(buildListingRow({ ...base, missingPlayers: 0 }), { ok: false, error: 'missing_players_invalid' });
  assert.deepEqual(buildListingRow({ ...base, missingPlayers: 7 }), { ok: false, error: 'missing_players_invalid' });
  assert.deepEqual(buildListingRow({ ...base, missingPlayers: null }), { ok: false, error: 'missing_players_invalid' });
  assert.equal(buildListingRow({ ...base, missingPlayers: 6 }).ok, true);
});

test('format is required and must be 5..11', () => {
  assert.deepEqual(buildListingRow({ ...base, format: null }), { ok: false, error: 'format_required' });
  assert.deepEqual(buildListingRow({ ...base, format: 4 }), { ok: false, error: 'format_required' });
});

test('a diziliş must belong to the chosen format', () => {
  assert.deepEqual(buildListingRow({ ...base, formation: '4-4-2' }), { ok: false, error: 'formation_invalid' });
  const none = buildListingRow({ ...base, formation: null });
  assert.equal(none.ok, true);
  if (none.ok) assert.equal(none.row.formation, null);
});

test('paid listing needs a fee; the note is optional and bounded', () => {
  assert.deepEqual(buildListingRow({ ...base, isPaid: true, feePerPerson: null }), { ok: false, error: 'fee_required' });
  assert.deepEqual(buildListingRow({ ...base, isPaid: true, feePerPerson: 0 }), { ok: false, error: 'fee_required' });
  const ok = buildListingRow({ ...base, isPaid: true, feePerPerson: 150, feeNote: '  saha ücreti paylaşılacak ' });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.row.team_payment, 150);
    assert.equal(ok.row.fee_note, 'saha ücreti paylaşılacak');
  }
  const longNote = buildListingRow({ ...base, isPaid: true, feePerPerson: 10, feeNote: 'x'.repeat(121) });
  assert.deepEqual(longNote, { ok: false, error: 'fee_note_too_long' });
});

test('a free listing ignores a fee that was typed before switching', () => {
  const result = buildListingRow({ ...base, isPaid: false, feePerPerson: 999, feeNote: 'not' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.row.team_payment, 0);
    assert.equal(result.row.fee_note, null);
  }
});

test('lineup is stored only for a team listing and must match the formation slots', () => {
  const slots = getFormationSlots(7, '2-3-1');
  const squad = [
    { user_id: 'g', name: 'Kale', position: 'Kaleci' },
    { user_id: 'd1', name: 'Defans', position: 'Defans' },
    { user_id: 'f1', name: 'Forvet', position: 'Forvet' },
  ];
  const entries = buildLineupEntries(slots, autoFillLineup(squad, slots));
  const teamOk = buildListingRow({ ...base, listingType: 'players', teamId: 't-2', lineup: entries });
  assert.equal(teamOk.ok, true);
  if (teamOk.ok) {
    assert.equal(teamOk.row.team_id, 't-2');
    assert.deepEqual(teamOk.row.lineup, entries);
  }
  const personalWithLineup = buildListingRow({ ...base, teamId: null, lineup: entries });
  assert.deepEqual(personalWithLineup, { ok: false, error: 'lineup_requires_team' });
});

test('title, location, city and date are required', () => {
  assert.deepEqual(buildListingRow({ ...base, title: '  ' }), { ok: false, error: 'title_required' });
  assert.deepEqual(buildListingRow({ ...base, location: '' }), { ok: false, error: 'location_required' });
  assert.deepEqual(buildListingRow({ ...base, district: '' }), { ok: false, error: 'city_required' });
  assert.deepEqual(buildListingRow({ ...base, date: '' }), { ok: false, error: 'date_required' });
});
