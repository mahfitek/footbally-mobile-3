import { supabase } from './supabase';
import { notifyUser } from './notify';

export async function sendMatchChallenge(
  myTeamId: string,
  myTeamName: string,
  opponentTeamId: string,
  opponentTeamName: string,
  date: string,
  time: string,
  location: string,
  format: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('match_challenges').insert({
    challenger_team_id: myTeamId,
    opponent_team_id: opponentTeamId,
    date,
    time,
    location,
    format,
    status: 'pending',
  });

  if (error) {
    if (__DEV__) console.log('Davet gönderilemedi:', error);
    return { error: error.message };
  }

  const { data: opponentTeam } = await supabase.from('teams').select('owner_id').eq('id', opponentTeamId).maybeSingle();
  if (opponentTeam?.owner_id) {
    notifyUser(
      opponentTeam.owner_id,
      '⚔️',
      `${myTeamName} takımı ${opponentTeamName} takımına maç daveti gönderdi`,
      'teamHome',
      'Yeni Maç Daveti'
    );
  }

  return { error: null };
}
