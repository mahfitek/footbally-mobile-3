// Supabase oturumu için parçalı (chunked) anahtar-değer depolama.
//
// SecureStore değer başına ~2048 bayt sınırına sahiptir; Supabase oturum JSON'u bunu aşabilir.
// Bu modül değeri güvenli sınırın altındaki parçalara böler. Ana depo (secure) ve eski depo
// (legacy, AsyncStorage) dışarıdan verilir; böylece mantık Node test runner'ında doğrulanabilir.
//
// Düzen: `key` → "chunks:N" manifesti; `key.0` ... `key.N-1` → parçalar.
// Manifest en son yazılır: yarım kalan bir yazma okunamaz bir oturum üretmez (eksik parça → null).

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// 600 karakter, UTF-8'de en fazla 1800 bayt eder; 2048 sınırının altında kalır.
export const CHUNK_SIZE = 600;

const MANIFEST_PREFIX = 'chunks:';

function chunkCount(manifest: string): number | null {
  if (!manifest.startsWith(MANIFEST_PREFIX)) return null;
  const n = Number(manifest.slice(MANIFEST_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function splitIntoChunks(value: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks;
}

export function createChunkedStorage(secure: KeyValueStore, legacy: KeyValueStore): KeyValueStore {
  const removeChunks = async (key: string, manifest: string | null) => {
    const count = manifest === null ? null : chunkCount(manifest);
    if (count !== null) {
      for (let i = 0; i < count; i++) await secure.removeItem(`${key}.${i}`);
    }
    await secure.removeItem(key);
  };

  const storage: KeyValueStore = {
    async getItem(key) {
      const manifest = await secure.getItem(key);
      if (manifest === null) {
        // Eski AsyncStorage değerini bir kez taşı, sonra eskisini sil.
        const legacyValue = await legacy.getItem(key);
        if (legacyValue === null) return null;
        await storage.setItem(key, legacyValue);
        await legacy.removeItem(key);
        return legacyValue;
      }

      const count = chunkCount(manifest);
      if (count === null) return manifest; // Parçalanmamış tek değer (düz SecureStore kaydı).

      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const part = await secure.getItem(`${key}.${i}`);
        if (part === null) return null; // Eksik parça: yarım yazılmış veri, oturum yok sayılır.
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      const previous = await secure.getItem(key);
      const chunks = splitIntoChunks(value);
      for (let i = 0; i < chunks.length; i++) await secure.setItem(`${key}.${i}`, chunks[i]);
      await secure.setItem(key, `${MANIFEST_PREFIX}${chunks.length}`);
      // Yeni manifest yazıldıktan sonra eski fazla parçalar temizlenir.
      const previousCount = previous === null ? null : chunkCount(previous);
      if (previousCount !== null) {
        for (let i = chunks.length; i < previousCount; i++) await secure.removeItem(`${key}.${i}`);
      }
    },

    async removeItem(key) {
      const manifest = await secure.getItem(key);
      await removeChunks(key, manifest);
      await legacy.removeItem(key);
    },
  };
  return storage;
}
