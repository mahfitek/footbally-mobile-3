// Keşfet verisi: yayınlanabilir oyuncular, engellenen kullanıcılar ve listeleme filtreleri.
// Supabase istemcisi dışarıdan verilir; böylece sorgu şekli ve filtreler birim testinde doğrulanabilir.
//
// Kaynaklar:
//   - list_discoverable_players RPC'si: yalnızca tamamlanmış ve kısıtlı olmayan (ban/pasif değil) profiller;
//     kendi profilini dönmez. Engellenenleri elemez; bu istemcinin işidir.
//   - user_blocks: kullanıcı yalnızca kendi engellediklerini okuyabilir (blocker_id = auth.uid()).

export type DiscoverablePlayer = {
  user_id: string;
  full_name: string | null;
  position: string | null;
  city: string | null;
  district: string | null;
  age: number | null;
  foot: string | null;
  avatar_url: string | null;
  score: number | null;
  club: string | null;
};

export type PlayerFilters = {
  city: string;
  district: string;
  positions: string[];
};

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

type BlocksClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
    };
  };
};

export async function fetchDiscoverablePlayers(
  client: RpcClient,
  options: { city?: string | null; limit?: number } = {},
): Promise<{ ok: true; players: DiscoverablePlayer[] } | { ok: false }> {
  const { data, error } = await client.rpc('list_discoverable_players', {
    p_city: options.city ? options.city : null,
    p_limit: options.limit ?? 100,
    p_offset: 0,
  });
  if (error) return { ok: false };
  const rows = Array.isArray(data) ? (data as DiscoverablePlayer[]) : [];
  return { ok: true, players: rows.filter((row) => typeof row.user_id === 'string') };
}

/**
 * Oturum açan kullanıcının engellediği kişilerin kimlikleri. Okunamazsa null: çağıran listeyi göstermez (fail closed).
 */
export async function fetchBlockedUserIds(client: BlocksClient, ownUserId: string): Promise<Set<string> | null> {
  const { data, error } = await client.from('user_blocks').select('blocked_id').eq('blocker_id', ownUserId);
  if (error) return null;
  const rows = Array.isArray(data) ? (data as { blocked_id: string | null }[]) : [];
  return new Set(rows.map((row) => row.blocked_id).filter((id): id is string => typeof id === 'string'));
}

/** Oyuncu listesini filtreler: kendi profili, engellenenler, şehir, ilçe ve pozisyon (çoklu). */
export function applyPlayerFilters(
  players: DiscoverablePlayer[],
  filters: PlayerFilters,
  blockedIds: ReadonlySet<string>,
  ownUserId: string | null,
): DiscoverablePlayer[] {
  return players.filter((player) => {
    if (ownUserId && player.user_id === ownUserId) return false;
    if (blockedIds.has(player.user_id)) return false;
    if (filters.city && player.city !== filters.city) return false;
    if (filters.district && player.district !== filters.district) return false;
    if (filters.positions.length > 0 && !filters.positions.includes(player.position ?? '')) return false;
    return true;
  });
}

/** Takım listesinde bir takımın engellenip engellenmediği: takımın sahibi engellenmiş mi? */
export function isTeamBlocked(ownerId: string | null | undefined, blockedIds: ReadonlySet<string>): boolean {
  return !!ownerId && blockedIds.has(ownerId);
}

/** Profil rotası: başka bir kullanıcının oyuncu profili (App.tsx 'profile' ekranı params.userId ile açar). */
export function playerProfileRoute(userId: string): { screen: 'profile'; params: { userId: string } } {
  return { screen: 'profile', params: { userId } };
}

/** Takım profili rotası: takım sahibinin kimliği (App.tsx 'teamProfile' ekranı params.userId ile açar). */
export function teamProfileRoute(ownerId: string): { screen: 'teamProfile'; params: { userId: string } } {
  return { screen: 'teamProfile', params: { userId: ownerId } };
}
