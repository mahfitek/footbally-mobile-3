import { supabase } from './supabase';
import { notifyUser } from './notify';

export function extractTeamIdFromJoinUrl(url: string): string | null {
  const match = url.match(/join-team\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

export async function joinTeam(teamId: string, userId: string): Promise<{ error: string | null; alreadyMember: boolean }> {
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return { error: null, alreadyMember: true };
  }

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: userId, role: 'player' });

  if (error) {
    if (__DEV__) console.log('Takıma katılınamadı:', error);
    return { error: error.message, alreadyMember: false };
  }

  const [{ data: team }, { data: joiner }] = await Promise.all([
    supabase.from('teams').select('owner_id, name').eq('id', teamId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('user_id', userId).maybeSingle(),
  ]);
  if (team?.owner_id) {
    notifyUser(
      team.owner_id,
      '🏟️',
      `${joiner?.full_name || 'Yeni bir oyuncu'} ${team.name} takımına katıldı`,
      'teamSquad',
      'Takıma Katılım'
    );
  }

  return { error: null, alreadyMember: false };
}
