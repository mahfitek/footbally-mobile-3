import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { createChunkedStorage } from './chunkedStorage';

// Yalnızca anon/publishable anahtar istemcide bulunur; service_role asla mobil pakete girmez.
const supabaseUrl = 'https://mohsosllyfgevvvpbkkn.supabase.co';
const supabaseKey = 'sb_publishable_oRwQr0jfXtjCyqChBEwgBA_drlzRtRS';

// Oturum token'ları SecureStore'da (iOS Keychain / Android Keystore) tutulur.
// AFTER_FIRST_UNLOCK: arka planda token yenileme telefon kilitliyken de çalışsın diye WHEN_UNLOCKED değil.
// Okuma hatası oturumsuz kabul edilir (kullanıcı yeniden girer); uygulama çökmez.
const secureSessionStore = {
  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string) {
    return SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  },
  removeItem(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: createChunkedStorage(secureSessionStore, AsyncStorage),
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
