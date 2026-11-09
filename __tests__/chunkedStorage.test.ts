/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChunkedStorage, splitIntoChunks, CHUNK_SIZE, KeyValueStore } from '../lib/chunkedStorage';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItem(key) {
      return data.has(key) ? (data.get(key) as string) : null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async removeItem(key) {
      data.delete(key);
    },
  };
}

const KEY = 'sb-test-auth-token';
const longSession = JSON.stringify({ access_token: 'x'.repeat(3000) + 'çğıöşü'.repeat(200), refresh_token: 'r' });

test('a long session round-trips intact through chunks', async () => {
  const secure = memoryStore();
  const storage = createChunkedStorage(secure, memoryStore());
  await storage.setItem(KEY, longSession);
  assert.equal(await storage.getItem(KEY), longSession);
});

test('every stored chunk stays under the SecureStore byte limit', () => {
  const sample = 'ğ'.repeat(10000); // 2 bayt/karakter
  for (const part of splitIntoChunks(sample)) {
    assert.ok(Buffer.byteLength(part, 'utf8') <= 2048, 'chunk too large');
  }
  assert.ok(Buffer.byteLength('ğ'.repeat(CHUNK_SIZE), 'utf8') <= 2048);
});

test('an existing AsyncStorage session is migrated once and the legacy copy removed', async () => {
  const secure = memoryStore();
  const legacy = memoryStore();
  await legacy.setItem(KEY, longSession);
  const storage = createChunkedStorage(secure, legacy);

  assert.equal(await storage.getItem(KEY), longSession);
  assert.equal(legacy.data.has(KEY), false, 'legacy value must be removed after migration');
  // Migrated session is now served from secure storage.
  assert.equal(await storage.getItem(KEY), longSession);
});

test('a half-written session (missing chunk) reads as no session', async () => {
  const secure = memoryStore();
  const storage = createChunkedStorage(secure, memoryStore());
  await storage.setItem(KEY, longSession);
  secure.data.delete(`${KEY}.1`);
  assert.equal(await storage.getItem(KEY), null);
});

test('removeItem clears the manifest and every chunk', async () => {
  const secure = memoryStore();
  const legacy = memoryStore();
  const storage = createChunkedStorage(secure, legacy);
  await storage.setItem(KEY, longSession);
  await storage.removeItem(KEY);
  assert.equal(secure.data.size, 0, 'no secure entries may remain after logout');
  assert.equal(await storage.getItem(KEY), null);
});

test('overwriting with a shorter session drops the surplus chunks', async () => {
  const secure = memoryStore();
  const storage = createChunkedStorage(secure, memoryStore());
  await storage.setItem(KEY, longSession);
  await storage.setItem(KEY, 'short');
  assert.equal(await storage.getItem(KEY), 'short');
  const leftover = [...secure.data.keys()].filter((k) => k.startsWith(`${KEY}.`));
  assert.equal(leftover.length, 1);
});

test('a plain non-manifest secure value is returned as-is', async () => {
  const secure = memoryStore();
  secure.data.set(KEY, 'plain');
  assert.equal(await createChunkedStorage(secure, memoryStore()).getItem(KEY), 'plain');
});
