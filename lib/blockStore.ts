// Engellediklerimin paylaşılan önbelleği. Tüm ekranlar aynı kümeyi okur: bir engel eklendiğinde veya
// kaldırıldığında açık olan bütün listeler ve profiller aynı anda güncellenir (useBlockedIds bunu abone olarak alır).
// null: liste henüz okunmadı (bilinmiyor). Bu modül React'e bağlı değildir; testte doğrudan kullanılabilir.

export type BlockedSnapshot = ReadonlySet<string> | null;

let snapshot: BlockedSnapshot = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getBlockedSnapshot(): BlockedSnapshot {
  return snapshot;
}

export function subscribeBlocked(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Sunucudan okunan tam listeyi yazar. null (okunamadı) önceki değeri korur. */
export function setBlockedSnapshot(ids: ReadonlySet<string> | null): void {
  if (ids === null) return;
  snapshot = new Set(ids);
  emit();
}

/** Başarılı engelleme sonrası: liste bilinmiyorsa dokunulmaz (bir sonraki okuma sunucudan alır). */
export function markBlocked(userId: string): void {
  if (!snapshot || snapshot.has(userId)) return;
  snapshot = new Set([...snapshot, userId]);
  emit();
}

/** Başarılı engel kaldırma sonrası: kişi her listede anında "engelsiz" olur. */
export function markUnblocked(userId: string): void {
  if (!snapshot || !snapshot.has(userId)) return;
  const next = new Set(snapshot);
  next.delete(userId);
  snapshot = next;
  emit();
}

/** Oturum kapanınca önceki kullanıcının listesi taşınmasın. */
export function resetBlockedSnapshot(): void {
  snapshot = null;
  emit();
}
