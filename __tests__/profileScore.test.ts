/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfileCompletion } from '../lib/profileScore';

test('an empty profile scores 0', () => {
  assert.equal(calculateProfileCompletion({}), 0);
});

test('a full profile reaches the 50-point completeness cap without activity', () => {
  const full = {
    full_name: 'A',
    position: 'Forvet',
    age: 25,
    height: 180,
    weight: 75,
    city: 'Ankara',
    district: 'Çankaya',
    foot: 'Sağ Ayak',
    club: 'X',
  };
  assert.equal(calculateProfileCompletion(full), 50);
});

test('activity is added on top of completeness and the total is capped at 100', () => {
  const full = { full_name: 'A', position: 'P', age: 1, height: 1, weight: 1, city: 'C', district: 'D', foot: 'F', club: 'K' };
  assert.equal(calculateProfileCompletion({ ...full, activity_score: 30 }), 80);
  assert.equal(calculateProfileCompletion({ ...full, activity_score: 90 }), 100);
});
