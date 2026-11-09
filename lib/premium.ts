import { supabase } from './supabase';
import { createPremiumQueries } from './premiumQueries';

export { INACTIVE_PREMIUM } from './premiumQueries';
export type { PremiumStatus } from './premiumQueries';

// Uygulama genelinde kullanılan Premium durumu okuyucusu (sorgu şekli premiumQueries.ts içinde).
export const fetchPremiumStatus = (userId: string) => createPremiumQueries(supabase).fetchPremiumStatus(userId);
