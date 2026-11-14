/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_VIDEO_BUCKET,
  PROFILE_VIDEO_MAX_BYTES,
  checkProfileVideo,
  profileVideoPath,
  resolveProfileVideoType,
} from '../lib/profileVideo';

test('the bucket and size limit match the web site: profile-media, 200 MB', () => {
  assert.equal(PROFILE_VIDEO_BUCKET, 'profile-media');
  assert.equal(PROFILE_VIDEO_MAX_BYTES, 200 * 1024 * 1024);
});

test('allowed video types resolve to their content type and extension', () => {
  assert.deepEqual(resolveProfileVideoType('video/mp4', 'a.mov'), { contentType: 'video/mp4', ext: 'mp4' });
  assert.deepEqual(resolveProfileVideoType('video/quicktime', null), { contentType: 'video/quicktime', ext: 'mov' });
  assert.deepEqual(resolveProfileVideoType('video/webm', null), { contentType: 'video/webm', ext: 'webm' });
  assert.deepEqual(resolveProfileVideoType('video/x-m4v', null), { contentType: 'video/x-m4v', ext: 'm4v' });
});

test('an unsupported or unknown content type is rejected', () => {
  assert.equal(resolveProfileVideoType('image/jpeg', 'a.jpg'), null);
  assert.equal(resolveProfileVideoType('video/avi', null), null);
  assert.equal(resolveProfileVideoType('constructor', null), null);
  assert.equal(resolveProfileVideoType(null, 'clip.avi'), null);
  assert.equal(resolveProfileVideoType(null, null), null);
});

test('without a mime type the extension decides the type', () => {
  assert.deepEqual(resolveProfileVideoType(null, 'Maç.MP4'), { contentType: 'video/mp4', ext: 'mp4' });
});

test('the storage path starts with the user id and sits under videos/', () => {
  assert.equal(profileVideoPath('user-1', 1700000000000, 'mp4'), 'user-1/videos/1700000000000.mp4');
});

test('files over 200 MB are rejected before upload', () => {
  const base = { mimeType: 'video/mp4', fileName: 'a.mp4' };
  assert.deepEqual(checkProfileVideo({ ...base, fileSize: PROFILE_VIDEO_MAX_BYTES }).ok, true);
  assert.deepEqual(checkProfileVideo({ ...base, fileSize: PROFILE_VIDEO_MAX_BYTES + 1 }), { ok: false, reason: 'too_large' });
  // Boyut bilinmiyorsa türe göre geçer; boyut sonradan byteLength ile kontrol edilir.
  assert.equal(checkProfileVideo({ ...base, fileSize: null }).ok, true);
});

test('a wrong type is reported as bad_type even when the file is small', () => {
  assert.deepEqual(
    checkProfileVideo({ mimeType: 'image/png', fileName: 'x.png', fileSize: 10 }),
    { ok: false, reason: 'bad_type' },
  );
});
