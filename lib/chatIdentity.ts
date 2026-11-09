import { supabase } from './supabase';
import { profiles } from './profiles';

export type SenderKind = 'player' | 'team';

export type SenderIdentity = {
  name: string;
  kind: SenderKind;
};

/**
 * Auth user id'lerini görünen ad + oyuncu/takım etiketine çevirir.
 * Ad önceliği (web ile aynı): profil adı → sahip olunan takımın adı. İkisi de boşsa kimlik haritada yer almaz;
 * çağıran kendi "Kullanıcı" yedeğini uygular. Boş ad asla bir isim gibi gösterilmez.
 * Etiket: profil adıyla çözülen kullanıcı 'player', yalnızca takım adıyla çözülen 'team'.
 */
export async function resolveSenderIdentities(userIds: string[]): Promise<Map<string, SenderIdentity>> {
  const map = new Map<string, SenderIdentity>();
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (uniqueIds.length === 0) return map;

  const { data: playerProfiles } = await profiles.publicProfiles(uniqueIds, 'user_id, full_name');
  for (const p of playerProfiles ?? []) {
    const name = p.full_name?.trim();
    if (name) map.set(p.user_id, { name, kind: 'player' });
  }

  const remaining = uniqueIds.filter((id) => !map.has(id));
  if (remaining.length > 0) {
    const { data: teams } = await supabase
      .from('teams')
      .select('owner_id, name')
      .in('owner_id', remaining);
    for (const t of teams ?? []) {
      const name = t.name?.trim();
      if (name && !map.has(t.owner_id)) map.set(t.owner_id, { name, kind: 'team' });
    }
  }

  return map;
}
