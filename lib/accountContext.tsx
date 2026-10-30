import { createContext, useContext } from 'react';
import type { AccountAccessResult } from './accountAccessRules';

export interface AccountAccessValue {
  /** null: kontrol henüz bitmedi. Bu durumda korunan yazmalar kapalıdır (fail closed). */
  access: AccountAccessResult | null;
  /** Hesap durumunu sunucudan yeniden sorar (Ayarlar'daki "Tekrar dene" için). */
  refresh: () => Promise<void>;
}

// Login, App ve Ayarlar aynı hesap durumunu bu bağlam üzerinden okur; her ekran kendi sorgusunu yapmaz.
export const AccountAccessContext = createContext<AccountAccessValue>({
  access: null,
  refresh: async () => {},
});

export function useAccountAccess(): AccountAccessValue {
  return useContext(AccountAccessContext);
}

/** Profil yazması için izin. Kontrol bitmediyse ya da doğrulanamadıysa false. */
export function canWriteProfile(access: AccountAccessResult | null): boolean {
  return !!access && access.profileWriteAllowed;
}

/** Takım yazması için izin. Doğrulanmış temiz durum ve aktif takım yasağı yokluğu gerekir. */
export function canWriteTeam(access: AccountAccessResult | null): boolean {
  return !!access && access.teamWriteAllowed;
}
