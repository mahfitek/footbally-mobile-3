/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_FOOT_OPTIONS, PROFILE_POSITIONS, profileFootLabelKey, profilePositionLabelKey } from '../lib/profileCompletion';
import { t } from '../lib/i18n';

test('every server position has a translated label in English and Turkish', () => {
  for (const value of PROFILE_POSITIONS) {
    const key = profilePositionLabelKey(value);
    assert.ok(key, `no label key for ${value}`);
    assert.notEqual(t(key, 'en'), key, `missing en label for ${value}`);
    assert.notEqual(t(key, 'tr'), key, `missing tr label for ${value}`);
  }
});

test('every server foot value has a translated label in English and Turkish', () => {
  for (const value of PROFILE_FOOT_OPTIONS) {
    const key = profileFootLabelKey(value);
    assert.ok(key, `no label key for ${value}`);
    assert.notEqual(t(key, 'en'), key, `missing en label for ${value}`);
    assert.notEqual(t(key, 'tr'), key, `missing tr label for ${value}`);
  }
});

test('English foot labels are English and Turkish labels keep the stored values', () => {
  assert.equal(t(profileFootLabelKey('Sağ')!, 'en'), 'Right');
  assert.equal(t(profileFootLabelKey('Sol')!, 'en'), 'Left');
  assert.equal(t(profileFootLabelKey('Her İkisi')!, 'en'), 'Both');
  assert.equal(t(profileFootLabelKey('Sağ')!, 'tr'), 'Sağ');
  assert.equal(t(profilePositionLabelKey('Orta Saha')!, 'en'), 'Midfielder');
  assert.equal(t(profilePositionLabelKey('Orta Saha')!, 'tr'), 'Orta Saha');
});

test('unknown or legacy values get no label key and are shown as stored', () => {
  assert.equal(profilePositionLabelKey('Ofansif Orta Saha (CAM)'), null);
  assert.equal(profileFootLabelKey('Sağ Ayak'), null);
  assert.equal(profilePositionLabelKey('constructor'), null);
  assert.equal(profileFootLabelKey(null), null);
});
