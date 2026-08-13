import { supabase } from './supabase';

export async function createNotification(userId: string, icon: string, message: string, screen: string = 'notifications') {
  if (!userId) return;
  const { error } = await supabase.from('notifications').insert({ user_id: userId, icon, message, screen, read: false });
  if (error && __DEV__) console.log('Bildirim kaydedilemedi:', error);
}

export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    const { data: profile } = await supabase.from('profiles').select('push_token').eq('user_id', userId).maybeSingle();
    const token = profile?.push_token;
    if (!token) return;
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
export async function notifyUser(userId: string, icon: string, message: string, screen: string, pushTitle?: string) {
  await Promise.all([
    createNotification(userId, icon, message, screen),
    sendPushToUser(userId, pushTitle ?? icon, message, { screen }),
  ]);
}
