import { supabase } from './supabase';
import { profiles } from './profiles';

export type SenderKind = 'player' | 'team';

export type SenderIdentity = {
  name: string;
  kind: SenderKind;
};

/**
 * Resolves a batch of auth user ids to a display name + player/team tag.
 * A user is a "team" account when they own a row in `teams` (owner_id);
 * otherwise they're treated as a player, matching the profiles/teams
 * fallback pattern in lib/accountAccess.ts.
 */
export async function resolveSenderIdentities(userIds: string[]): Promise<Map<string, SenderIdentity>> {
  const map = new Map<string, SenderIdentity>();
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (uniqueIds.length === 0) return map;

  const { data: playerProfiles } = await profiles.publicProfiles(uniqueIds, 'user_id, full_name');
  for (const p of playerProfiles ?? []) {
    map.set(p.user_id, { name: p.full_name || 'Oyuncu', kind: 'player' });
  }

  const remaining = uniqueIds.filter((id) => !map.has(id));
  if (remaining.length > 0) {
    const { data: teams } = await supabase
      .from('teams')
      .select('owner_id, name')
      .in('owner_id', remaining);
    for (const t of teams ?? []) {
      map.set(t.owner_id, { name: t.name || 'Takım', kind: 'team' });
    }
  }

  return map;
}
