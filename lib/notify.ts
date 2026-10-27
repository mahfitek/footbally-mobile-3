import { supabase } from './supabase';

// Olay tipleri supabase/functions/notify-event/rules.ts ile eşleşmelidir.
export type NotifyEvent =
  | { kind: 'chat_message'; messageId: number }
  | { kind: 'connection_request'; targetUserId: string }
  | { kind: 'connection_accepted'; requesterUserId: string }
  | { kind: 'match_join'; matchId: number }
  | { kind: 'team_challenge_created'; challengerTeamId: string; opponentTeamId: string }
  | { kind: 'team_challenge_responded'; challengeId: string }
  | { kind: 'team_joined'; teamId: string };

/**
 * Gerçekleşmiş bir olayı sunucuya bildirir. Alıcı, metin, push token'ı ve bildirim
 * tercihleri sunucuda belirlenir; istemci başka bir kullanıcının push_token'ını veya
 * tercihlerini okumaz ve keyfi bir alıcıya/metne bildirim gönderemez.
 * Başarısızlık sessizce yutulur (bildirim, kullanıcının işlemini engellememeli).
 */
export async function notifyEvent(event: NotifyEvent): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-event', { body: { event } });
    if (error && __DEV__) console.log('Bildirim gönderilemedi:', error);
  } catch (err) {
    if (__DEV__) console.log('Bildirim gönderilemedi:', err);
  }
}
