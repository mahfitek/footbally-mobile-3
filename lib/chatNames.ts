// Mesaj listesi için saf isim çözümü. Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.

export interface ConversationParticipants {
  participant_a: string | null;
  participant_b: string | null;
}

export interface PublicNameRow {
  user_id: string;
  full_name: string | null;
}

/**
 * Oturumdaki kullanıcının karşısındaki katılımcı. Kullanıcı konuşmanın tarafı değilse ya da
 * karşı taraf kimliği boşsa null döner; böyle bir konuşma listede gösterilmez.
 */
export function partnerIdFor(conversation: ConversationParticipants, userId: string): string | null {
  if (conversation.participant_a === userId) return conversation.participant_b || null;
  if (conversation.participant_b === userId) return conversation.participant_a || null;
  return null;
}

/**
 * Herkese açık profil satırlarından kullanıcı id → görünen ad haritası.
 * Boş ya da yalnızca boşluktan oluşan ad yok sayılır; böylece fallback devreye girer.
 * Sorgu hatasında (data null) harita boştur; çağıran fallback'e düşer, hata bir isim gibi gösterilmez.
 */
export function buildNameMap(rows: PublicNameRow[] | null | undefined): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of rows ?? []) {
    const name = row.full_name?.trim();
    if (name) names.set(row.user_id, name);
  }
  return names;
}

/** Haritada adı olmayan kullanıcı için fallback metni (ör. "Kullanıcı"). */
export function displayName(userId: string, names: Map<string, string>, fallback: string): string {
  return names.get(userId) ?? fallback;
}
