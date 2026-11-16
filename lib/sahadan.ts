// Sahadan akışı (tribun_messages): saf kurallar. Ana sayfa önizlemesi ve tam ekran aynı kuralları kullanır.
//
// Kaynak: tribun_messages (herkes okur). Sunucuda engel ve kaldırılmış medya filtresi için
// get_sahadan_messages RPC'si migration olarak yazıldı (supabase/migrations/20261116100000_sahadan_moderated_feed.sql)
// ama henüz uygulanmadı. RPC yokken istemci yalnızca kendi engel listesiyle süzer ve medyayı
// doğrulanamadığı için gizler (önizleme). Tam ekran medyayı mevcut davranışıyla gösterir (bkz. rapor).

export type SahadanMediaType = 'image' | 'video';

export type SahadanMessage = {
  id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: SahadanMediaType | null;
  created_at: string;
};

export const SAHADAN_PREVIEW_COUNT = 5;

/** Engellediklerim (ve beni engelleyenler) listelerde görünmez. Kendi mesajlarım her zaman görünür. */
export function filterSahadanMessages(
  rows: SahadanMessage[],
  blockedIds: ReadonlySet<string>,
  ownUserId: string | null,
): SahadanMessage[] {
  return rows.filter((row) => row.sender_id === ownUserId || !blockedIds.has(row.sender_id));
}

/** Önizleme: en yeni `count` mesaj, eskiden yeniye sıralı. */
export function sahadanPreview(rows: SahadanMessage[], count: number = SAHADAN_PREVIEW_COUNT): SahadanMessage[] {
  return rows.slice(Math.max(0, rows.length - count));
}

/**
 * Medyası doğrulanamayan mesajlar için güvenli görünüm: medya kaldırılır. Yalnızca medyası olan
 * mesaj tamamen çıkarılır (yönetici kaldırmış olabilir).
 */
export function withoutUnverifiedMedia(rows: SahadanMessage[]): SahadanMessage[] {
  const out: SahadanMessage[] = [];
  for (const row of rows) {
    if (!row.media_url) {
      out.push(row);
      continue;
    }
    if (row.content && row.content.trim()) {
      out.push({ ...row, media_url: null, media_type: null });
    }
  }
  return out;
}

/** Gönderenin adına/avatarına dokunulunca açılacak profil (kişi veya takım). */
export function sahadanSenderRoute(
  kind: 'player' | 'team',
  senderUserId: string,
): { screen: 'profile' | 'teamProfile'; params: { userId: string } } {
  return { screen: kind === 'team' ? 'teamProfile' : 'profile', params: { userId: senderUserId } };
}
