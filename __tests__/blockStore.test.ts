import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBlockedSnapshot,
  markBlocked,
  markUnblocked,
  resetBlockedSnapshot,
  setBlockedSnapshot,
  subscribeBlocked,
} from '../lib/blockStore';

test('an unknown list stays unknown until the server list is written', () => {
  resetBlockedSnapshot();
  assert.equal(getBlockedSnapshot(), null);
  markBlocked('u-1');
  assert.equal(getBlockedSnapshot(), null, 'a block cannot be applied to an unknown list');
  setBlockedSnapshot(null);
  assert.equal(getBlockedSnapshot(), null, 'a failed read keeps the unknown state');
});

test('a block or unblock is visible to every subscriber immediately', () => {
  resetBlockedSnapshot();
  setBlockedSnapshot(new Set(['a']));
  let notified = 0;
  const unsubscribe = subscribeBlocked(() => {
    notified += 1;
  });

  markBlocked('b');
  assert.deepEqual([...(getBlockedSnapshot() ?? [])].sort(), ['a', 'b']);
  markUnblocked('a');
  assert.deepEqual([...(getBlockedSnapshot() ?? [])], ['b']);
  assert.equal(notified, 2, 'each change notifies once');

  unsubscribe();
  markBlocked('c');
  assert.equal(notified, 2, 'unsubscribed listeners are not called');
});

test('repeating the same change does not notify or replace the snapshot', () => {
  resetBlockedSnapshot();
  setBlockedSnapshot(new Set(['a']));
  const before = getBlockedSnapshot();
  let notified = 0;
  const unsubscribe = subscribeBlocked(() => {
    notified += 1;
  });
  markBlocked('a');
  markUnblocked('zzz');
  assert.equal(getBlockedSnapshot(), before, 'same reference so React does not re-render');
  assert.equal(notified, 0);
  unsubscribe();
});

test('the snapshot is copied, so later mutations of the caller set do not leak in', () => {
  resetBlockedSnapshot();
  const source = new Set(['a']);
  setBlockedSnapshot(source);
  source.add('b');
  assert.deepEqual([...(getBlockedSnapshot() ?? [])], ['a']);
});

test('reset clears the list when the session changes', () => {
  setBlockedSnapshot(new Set(['a']));
  resetBlockedSnapshot();
  assert.equal(getBlockedSnapshot(), null);
});
