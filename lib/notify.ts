import { supabase } from './supabase';

export async function createNotification(userId: string, icon: string, message: string, screen: string = 'notifications', title?: string) {
  if (!userId) return;
  const { error } = await supabase.from('notifications').insert({ user_id: userId, title: title ?? null, body: message, screen, read: false });
  if (error && __DEV__) console.log('Bildirim kaydedilemedi:', error);
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  category?: 'match' | 'message' | 'scout'
) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token, notify_all, notify_match, notify_message, notify_scout')
      .eq('user_id', userId)
      .maybeSingle();
    const token = profile?.push_token;
    if (!token) return;
    if (profile?.notify_all === false) return;
    if (category === 'match' && profile?.notify_match === false) return;
    if (category === 'message' && profile?.notify_message === false) return;
    if (category === 'scout' && profile?.notify_scout === false) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });
  } catch (err) {
    if (__DEV__) console.log('Push bildirimi gönderilemedi:', err);
  }
}

/** Records an in-app notification for `userId` and best-effort pushes it to their device. */
export async function notifyUser(
  userId: string,
  icon: string,
  message: string,
  screen: string,
  pushTitle?: string,
  category?: 'match' | 'message' | 'scout'
) {
  await Promise.all([
    createNotification(userId, icon, message, screen, pushTitle),
    sendPushToUser(userId, pushTitle ?? icon, message, { screen }, category),
  ]);
}
