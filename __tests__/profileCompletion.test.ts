/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfilePatch,
  classifyCompletionResult,
  completionStateOf,
  isMissingColumnError,
  missingRequiredFields,
  toProfileFoot,
  toProfilePosition,
  type ProfileFormValues,
} from '../lib/profileCompletion';

const COMPLETE_FORM: ProfileFormValues = {
  fullName: 'Ayşe Yılmaz',
  position: 'Forvet',
  city: 'İzmir',
  district: 'Konak',
  foot: 'Sağ',
  age: '24',
  height: '168',
  weight: '60',
  club: '',
};

const EMPTY_FORM: ProfileFormValues = {
  fullName: '',
  position: '',
  city: '',
  district: '',
  foot: '',
  age: '',
  height: '',
  weight: '',
  club: '',
};

test('a row without the completion column is unknown, never complete', () => {
  assert.equal(completionStateOf({ user_id: 'x', full_name: 'Ayşe' }), 'unknown');
  assert.equal(completionStateOf(null), 'unknown');
});

test('the server decides completion: a null timestamp is incomplete, a timestamp is complete', () => {
  assert.equal(completionStateOf({ profile_completed_at: null }), 'incomplete');
  assert.equal(completionStateOf({ profile_completed_at: '2026-10-31T12:00:00+00:00' }), 'complete');
});

test('legacy detailed positions map to the server category', () => {
  assert.equal(toProfilePosition('Ofansif Orta Saha (CAM)'), 'Orta Saha');
  assert.equal(toProfilePosition('Santrafor (ST)'), 'Forvet');
  assert.equal(toProfilePosition('Sol Kanat (LW)'), 'Kanat');
  assert.equal(toProfilePosition('Kaleci'), 'Kaleci');
  assert.equal(toProfilePosition('Yönetim'), null);
  assert.equal(toProfilePosition('  '), null);
});

test('legacy foot labels map to the server values', () => {
  assert.equal(toProfileFoot('Sağ Ayak'), 'Sağ');
  assert.equal(toProfileFoot('Sol Ayak'), 'Sol');
  assert.equal(toProfileFoot('Her İkisi'), 'Her İkisi');
  assert.equal(toProfileFoot('Ambidextrous'), null);
});

test('an empty form lists every required field and invents no default', () => {
  assert.deepEqual(missingRequiredFields(EMPTY_FORM), [
    'full_name',
    'position',
    'city',
    'district',
    'foot',
    'age',
    'height',
    'weight',
  ]);
});

test('a complete form has no missing fields', () => {
  assert.deepEqual(missingRequiredFields(COMPLETE_FORM), []);
});

test('values outside the server ranges are reported as missing', () => {
  assert.deepEqual(missingRequiredFields({ ...COMPLETE_FORM, age: '9', height: '251', weight: '29' }), ['age', 'height', 'weight']);
});

test('the patch sends blanks as null and never sends completion columns', () => {
  const patch = buildProfilePatch({ ...EMPTY_FORM, fullName: '  Ayşe  ' });
  assert.equal(patch.full_name, 'Ayşe');
  assert.equal(patch.position, null);
  assert.equal(patch.age, null);
  assert.equal(patch.club, null);
  assert.equal('profile_completed_at' in patch, false);
  assert.equal('profile_completion_source' in patch, false);
});

test('the patch uses server position and foot values', () => {
  const patch = buildProfilePatch({ ...COMPLETE_FORM, position: 'Ofansif Orta Saha (CAM)', foot: 'Sağ Ayak' });
  assert.equal(patch.position, 'Orta Saha');
  assert.equal(patch.foot, 'Sağ');
  assert.equal(patch.age, 24);
});

test('a missing completion RPC is unavailable, never complete', () => {
  const outcome = classifyCompletionResult({
    data: null,
    error: { code: 'PGRST202', message: 'Could not find the function public.complete_my_player_profile' },
  });
  assert.deepEqual(outcome, { status: 'unavailable' });
});

test('server validation errors map to incomplete and restricted accounts map to restricted', () => {
  assert.deepEqual(classifyCompletionResult({ data: null, error: { code: '22023', message: 'profile_incomplete' } }), { status: 'incomplete' });
  assert.deepEqual(classifyCompletionResult({ data: null, error: { code: '22023', message: 'profile_invalid_value' } }), { status: 'incomplete' });
  assert.deepEqual(classifyCompletionResult({ data: null, error: { code: '42501', message: 'account_restricted' } }), { status: 'restricted' });
});

test('a timestamp result is completed; an empty or unknown failure is not', () => {
  assert.deepEqual(classifyCompletionResult({ data: '2026-10-31T12:00:00+00:00', error: null }), {
    status: 'completed',
    completedAt: '2026-10-31T12:00:00+00:00',
  });
  assert.deepEqual(classifyCompletionResult({ data: null, error: null }), { status: 'failed' });
  assert.deepEqual(classifyCompletionResult({ data: null, error: { code: 'XX000', message: 'boom' } }), { status: 'failed' });
});

test('a missing profile column is recognised by its PostgREST code', () => {
  assert.equal(isMissingColumnError({ code: '42703' }), true);
  assert.equal(isMissingColumnError({ code: '42501' }), false);
  assert.equal(isMissingColumnError(null), false);
});
