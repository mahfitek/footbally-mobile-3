// Davet sistemi: istemci tarafı kurallar ve RPC sarmalayıcıları. Kodu sunucu üretir ve doğrular;
// bu dosya yalnızca girdiyi temizler, sonucu gösterim için çevirir.
//
// Sunucu: get_or_create_my_referral_code, redeem_referral_code(p_code), get_my_referral_summary (20261115100100).

export const REFERRAL_CODE_LENGTH = 8;
/** Sunucu ile aynı alfabe: büyük harf ve rakam; 0, O, 1, I, L yok. */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_GROUP_SIZE = 7;
export const REFERRAL_INVITEE_PREMIUM_DAYS = 14;
export const REFERRAL_REWARD_PREMIUM_DAYS = 30;
export const REFERRAL_REDEEM_WINDOW_DAYS = 7;
export const REFERRAL_SHARE_URL = 'https://www.getfootbally.com';

const CODE_PATTERN = new RegExp(`^[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`);

/** Kullanıcı girdisini temizler: boşluk ve tireleri atar, büyük harfe çevirir. */
export function normalizeReferralCode(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase();
}

export function isValidReferralCodeFormat(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** Kullanıcıya gösterilecek ilerleme: geçerli davetlerin 7'lik grubundaki sırası (ör. 3/7). */
export function referralProgress(qualifiedCount: number): { done: number; target: number; remaining: number } {
  const safe = Number.isFinite(qualifiedCount) && qualifiedCount > 0 ? Math.floor(qualifiedCount) : 0;
  const done = safe % REFERRAL_GROUP_SIZE;
  return { done, target: REFERRAL_GROUP_SIZE, remaining: REFERRAL_GROUP_SIZE - done };
}

export type ReferralSummary = {
  code: string | null;
  invitedCount: number;
  qualifiedCount: number;
  progress: number;
  target: number;
  rewardMonthsTotal: number;
  redeemed: boolean;
  canRedeem: boolean;
};

const toCount = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** RPC yanıtını güvenli biçime çevirir. Eksik alan sıfır/boş kabul edilir. */
export function parseReferralSummary(raw: unknown): ReferralSummary {
  const data = (raw ?? {}) as Record<string, unknown>;
  const qualified = toCount(data.qualified_count);
  return {
    code: typeof data.code === 'string' && isValidReferralCodeFormat(data.code) ? data.code : null,
    invitedCount: toCount(data.invited_count),
    qualifiedCount: qualified,
    progress: referralProgress(qualified).done,
    target: REFERRAL_GROUP_SIZE,
    rewardMonthsTotal: toCount(data.reward_months_total),
    redeemed: data.redeemed === true,
    canRedeem: data.can_redeem === true,
  };
}

/** Sunucu hata mesajını sınıflandırır. Bilinmeyen hata 'unknown' döner. */
export type ReferralRedeemFailure =
  | 'own_code'
  | 'already_used'
  | 'too_old'
  | 'invalid_code'
  | 'restricted'
  | 'unknown';

const REDEEM_FAILURE_MARKERS: [string, ReferralRedeemFailure][] = [
  ['referral_own_code', 'own_code'],
  ['referral_already_used', 'already_used'],
  ['referral_account_too_old', 'too_old'],
  ['referral_invalid_code', 'invalid_code'],
  ['account_restricted', 'restricted'],
];

export function classifyRedeemError(error: { message?: string } | null | undefined): ReferralRedeemFailure {
  const message = error?.message ?? '';
  const match = REDEEM_FAILURE_MARKERS.find(([marker]) => message.includes(marker));
  return match ? match[1] : 'unknown';
}

/** Paylaşım metni (TR/EN). App Store bağlantısı yoktur; yalnızca web sitesi. */
export function buildShareMessage(lang: 'tr' | 'en', appName: string, code: string): string {
  if (lang === 'en') {
    return `Join me on ${appName}! Use my invite code ${code} when you sign up and get 14 days of Premium free.\n${REFERRAL_SHARE_URL}`;
  }
  return `${appName}'de beni takip et! Kayıt olurken davet kodum ${code} ile 14 günlük Premium kazan.\n${REFERRAL_SHARE_URL}`;
}

// ---------------------------------------------------------------------------------------------
// RPC sarmalayıcıları (Supabase istemcisi dışarıdan verilir; test edilebilirlik için).
// ---------------------------------------------------------------------------------------------

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export async function fetchReferralSummary(client: RpcClient): Promise<{ ok: true; summary: ReferralSummary } | { ok: false }> {
  const { data, error } = await client.rpc('get_my_referral_summary');
  if (error) return { ok: false };
  return { ok: true, summary: parseReferralSummary(data) };
}

export async function getOrCreateReferralCode(client: RpcClient): Promise<string | null> {
  const { data, error } = await client.rpc('get_or_create_my_referral_code');
  if (error || typeof data !== 'string' || !isValidReferralCodeFormat(data)) return null;
  return data;
}

export async function redeemReferralCode(
  client: RpcClient,
  input: string,
): Promise<{ ok: true } | { ok: false; reason: ReferralRedeemFailure }> {
  const code = normalizeReferralCode(input);
  if (!isValidReferralCodeFormat(code)) return { ok: false, reason: 'invalid_code' };
  const { error } = await client.rpc('redeem_referral_code', { p_code: code });
  if (error) return { ok: false, reason: classifyRedeemError(error) };
  return { ok: true };
}
