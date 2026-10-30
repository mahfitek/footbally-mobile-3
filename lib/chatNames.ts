// Mesaj listesi için saf isim çözümü. Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.
//
// Ad önceliği (web ile aynı, bkz. docs/unified-account-mobile-contract.md §5):
//   profil adı → sahip olunan takımın adı → "Kullanıcı" (çağıranın verdiği yedek metin)

export interface ConversationParticipants {
  participant_a: string | null;
  participant_b: string | null;
}

export interface PublicNameRow {
  user_id: string;
  full_name: string | null;
}

export interface OwnedTeamNameRow {
  owner_id: string;
  name: string | null;
}

/**
 * Oturumdaki kullanıcının karşısındaki katılımcı.
 *  - Kullanıcı konuşmanın tarafı değilse null.
 *  - Karşı taraf boşsa null.
 *  - Karşı taraf kullanıcının kendisiyse null: kendi hesabı asla "karşı taraf" olarak gösterilmez
 *    (ör. participant_a = participant_b = kullanıcı olan bozuk bir konuşma).
 */
export function partnerIdFor(conversation: ConversationParticipants, userId: string): string | null {
  let partner: string | null = null;
  if (conversation.participant_a === userId) partner = conversation.participant_b;
  else if (conversation.participant_b === userId) partner = conversation.participant_a;
  if (!partner || partner === userId) return null;
  return partner;
}

/**
 * Herkese açık profil satırlarından kullanıcı id → görünen ad haritası.
 * Boş ya da yalnızca boşluktan oluşan ad yok sayılır; böylece sonraki kaynak (takım adı) devreye girer.
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

/** Sahip olunan takımlardan sahip id → takım adı haritası. Adı boş takımlar atlanır. */
export function buildOwnedTeamNameMap(rows: OwnedTeamNameRow[] | null | undefined): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of rows ?? []) {
    const name = row.name?.trim();
    if (name && !names.has(row.owner_id)) names.set(row.owner_id, name);
  }
  return names;
}

/** İki harita birleşir; önceliği `primary` (ör. profil adı) taşır. */
export function mergeNameMaps(primary: Map<string, string>, secondary: Map<string, string>): Map<string, string> {
  const merged = new Map<string, string>(secondary);
  for (const [id, name] of primary) merged.set(id, name);
  return merged;
}

/** Haritada adı olmayan kullanıcı için fallback metni (ör. "Kullanıcı"). */
export function displayName(userId: string, names: Map<string, string>, fallback: string): string {
  return names.get(userId) ?? fallback;
}
