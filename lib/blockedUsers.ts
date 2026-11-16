// Engellenen Kullanıcılar listesi (Ayarlar). Sunucu RPC'si get_my_blocked_users yalnızca oturum açanın kendi
// engellerini döndürür. Kısıtlı veya silinmiş hesaplarda ad, avatar ve takım adı null gelir; istemci nötr
// "Kullanıcı" etiketini gösterir. Saf kurallar burada; RPC çağrısı istemci parametresiyle yapılır (test edilebilir).
import { playerProfileRoute } from './discovery';

export type BlockedUserRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  team_name: string | null;
  blocked_at: string;
};

export type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export type BlockedListOutcome = { ok: true; rows: BlockedUserRow[] } | { ok: false };

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

/** Sunucu satırını güvenli biçime getirir. Kimliği ya da tarihi olmayan satır atılır. */
export function normalizeBlockedRow(raw: unknown): BlockedUserRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.user_id !== 'string' || !row.user_id) return null;
  if (typeof row.blocked_at !== 'string' || !row.blocked_at) return null;
  return {
    user_id: row.user_id,
    full_name: text(row.full_name),
    avatar_url: text(row.avatar_url),
    team_name: text(row.team_name),
    blocked_at: row.blocked_at,
  };
}

/** En yeni engel en üstte. Eşit tarihte kimliğe göre sabit sıra. */
export function sortNewestBlockedFirst(rows: BlockedUserRow[]): BlockedUserRow[] {
  return [...rows].sort(
    (a, b) => Date.parse(b.blocked_at) - Date.parse(a.blocked_at) || a.user_id.localeCompare(b.user_id),
  );
}

/**
 * Engel önbelleğine göre görünür satırlar. Önbellekte olmayan satır (engeli kaldırılmış) anında gizlenir.
 * Önbellek bilinmiyorsa (null) satırlar olduğu gibi kalır.
 */
export function visibleBlockedRows(rows: BlockedUserRow[], blockedIds: ReadonlySet<string> | null): BlockedUserRow[] {
  if (!blockedIds) return rows;
  return rows.filter((row) => blockedIds.has(row.user_id));
}

/** Okunamayan liste hata olarak döner; boş liste ile karıştırılmaz ("Engellediğin kullanıcı yok" yanlış olmasın). */
export async function fetchMyBlockedUsers(client: RpcClient): Promise<BlockedListOutcome> {
  const { data, error } = await client.rpc('get_my_blocked_users');
  if (error || !Array.isArray(data)) return { ok: false };
  const rows = data
    .map((raw) => normalizeBlockedRow(raw))
    .filter((row): row is BlockedUserRow => row !== null);
  return { ok: true, rows: sortNewestBlockedFirst(rows) };
}

/** Satıra dokunulunca açılacak profil (kişi profili). */
export function blockedRowRoute(row: BlockedUserRow) {
  return playerProfileRoute(row.user_id);
}
