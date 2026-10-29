import type { SupabaseClient } from '@supabase/supabase-js';

// Şifre sıfırlama akışının saf parçaları. Ağ çağrıları dışarıdan verilen istemciyle yapılır.
//
// Akış: "Şifremi unuttum" → Supabase e-postası → bağlantı `footbally://reset-password#access_token=...&type=recovery`
// açar → uygulama tokenları alır, oturumu kurar, yeni şifre ekranını gösterir.

export const PASSWORD_RESET_REDIRECT = 'footbally://reset-password';
export const MIN_PASSWORD_LENGTH = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export type ResetRequestOutcome = { status: 'sent' } | { status: 'invalid_email' } | { status: 'failed' };

// Başarı, yalnızca Supabase hata döndürmediğinde bildirilir. E-posta var olsun ya da olmasın aynı mesaj
// gösterilir (hesap varlığı sızdırılmaz); ancak hata olduğunda kullanıcıya bildirilir.
export async function requestPasswordReset(
  client: Pick<SupabaseClient, 'auth'>,
  email: string,
): Promise<ResetRequestOutcome> {
  if (!isValidEmail(email)) return { status: 'invalid_email' };
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: PASSWORD_RESET_REDIRECT });
  return error ? { status: 'failed' } : { status: 'sent' };
}

export interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
}

// Kurtarma bağlantısının fragment kısmını okur. type=recovery ve iki token yoksa null döner.
export function parseRecoveryUrl(url: string | null | undefined): RecoveryTokens | null {
  if (!url || !url.startsWith(PASSWORD_RESET_REDIRECT)) return null;
  const hashIndex = url.indexOf('#');
  if (hashIndex < 0) return null;

  const params: Record<string, string> = {};
  for (const pair of url.slice(hashIndex + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }

  if (params.type !== 'recovery' || !params.access_token || !params.refresh_token) return null;
  return { accessToken: params.access_token, refreshToken: params.refresh_token };
}

export type PasswordValidation = 'too_short' | 'mismatch' | null;

export function validateNewPassword(password: string, confirm: string): PasswordValidation {
  if (password.length < MIN_PASSWORD_LENGTH) return 'too_short';
  if (password !== confirm) return 'mismatch';
  return null;
}
