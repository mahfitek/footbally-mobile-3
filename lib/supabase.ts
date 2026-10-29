import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Yalnızca anon/publishable anahtar istemcide bulunur; service_role asla mobil pakete girmez.
const supabaseUrl = 'https://mohsosllyfgevvvpbkkn.supabase.co';
const supabaseKey = 'sb_publishable_oRwQr0jfXtjCyqChBEwgBA_drlzRtRS';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase RN rehberi: token yenileme yalnızca uygulama öndeyken çalışsın; arka plandan dönünce yeniden başlasın.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
