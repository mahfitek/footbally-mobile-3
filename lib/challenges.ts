import { supabase } from './supabase';
import { notifyEvent } from './notify';

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

  notifyEvent({ kind: 'team_challenge_created', challengerTeamId: myTeamId, opponentTeamId });

  return { error: null };
}
