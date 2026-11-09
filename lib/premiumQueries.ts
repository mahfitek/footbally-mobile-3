import type { SupabaseClient } from '@supabase/supabase-js';

export type PremiumStatus = {
  active: boolean;
  until: string | null;
};

export const INACTIVE_PREMIUM: PremiumStatus = { active: false, until: null };

type PremiumClient = Pick<SupabaseClient, 'from'>;

// Premium durumunun tek kaynağı sunucudur: subscriptions tablosunda
// status = 'Active' ve expires_at henüz geçmemiş bir kayıt (web SubscriptionService
// ile aynı kural). auth user_metadata istemci tarafından yazılabildiği için
// Premium kararında ASLA kullanılmaz.
export function createPremiumQueries(client: PremiumClient) {
  return {
    async fetchPremiumStatus(userId: string, now: Date = new Date()): Promise<PremiumStatus> {
      const { data, error } = await client
        .from('subscriptions')
        .select('status, expires_at')
        .eq('user_id', userId)
        .ilike('status', 'active')
        .gt('expires_at', now.toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return INACTIVE_PREMIUM;
      return { active: true, until: (data as { expires_at?: string | null }).expires_at ?? null };
    },
  };
}
