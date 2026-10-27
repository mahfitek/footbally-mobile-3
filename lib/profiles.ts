import { supabase } from './supabase';
import { createProfileQueries } from './profileQueries';

// Uygulama genelinde kullanılan profil erişimi. Sorgu şekli profileQueries.ts içinde.
export const profiles = createProfileQueries(supabase);
