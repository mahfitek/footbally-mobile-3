// Kullanıcının adına maç açabileceği takımlar: sahip olduğu ya da `team_members.role = 'admin'` olduğu takımlar.
// Sunucudaki yetki kararı matches_validate_scope'tadır; bu liste yalnızca seçim için bir ön filtredir.
// Takım ban kolonları istemcide okunmaz (bkz. docs/unified-account-mobile-contract.md §6); yasaklı takım seçilirse
// sunucu team_restricted döner ve ekran bunu gösterir.

export interface ManagedTeam {
  id: string;
  name: string;
  relation: 'owner' | 'manager';
}

interface TeamRow {
  id: string;
  name: string | null;
}

/**
 * Sahip ve yönetici takım satırlarını birleştirir. Aynı takım iki kez gelirse sahip ilişkisi kazanır.
 * Adı boş takımlar atlanmaz; ad yerine kısa bir yedek metin kullanılır (seçilebilir kalsın).
 */
export function mergeManagedTeams(owned: TeamRow[], managed: TeamRow[], fallbackName: string): ManagedTeam[] {
  const byId = new Map<string, ManagedTeam>();
  for (const row of managed) {
    byId.set(row.id, { id: row.id, name: row.name?.trim() || fallbackName, relation: 'manager' });
  }
  for (const row of owned) {
    byId.set(row.id, { id: row.id, name: row.name?.trim() || fallbackName, relation: 'owner' });
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
}

type TeamsClient = {
  from: (table: string) => any;
};

/**
 * Takımları iki sorguyla getirir: sahip olunanlar ve admin üyelikleri (id'ler sonra ad için okunur).
 * Herhangi bir sorgu hatası: ok false (liste eksik olabilir; ekran bunu belirtir).
 */
export async function fetchManagedTeams(client: TeamsClient, userId: string, fallbackName: string): Promise<{ teams: ManagedTeam[]; ok: boolean }> {
  const ownedRes = await client.from('teams').select('id, name').eq('owner_id', userId);
  const adminRes = await client.from('team_members').select('team_id').eq('user_id', userId).eq('role', 'admin');
  if (ownedRes.error || adminRes.error) return { teams: [], ok: false };

  const owned: TeamRow[] = ownedRes.data ?? [];
  const adminIds: string[] = (adminRes.data ?? []).map((row: { team_id: string }) => row.team_id);
  const ownedIds = new Set(owned.map((row) => row.id));
  const extraIds = adminIds.filter((id) => !ownedIds.has(id));

  let managed: TeamRow[] = [];
  if (extraIds.length > 0) {
    const managedRes = await client.from('teams').select('id, name').in('id', extraIds);
    if (managedRes.error) return { teams: [], ok: false };
    managed = managedRes.data ?? [];
  }
  return { teams: mergeManagedTeams(owned, managed, fallbackName), ok: true };
}
