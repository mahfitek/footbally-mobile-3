// Kayıt sırasında girilen ama henüz kullanılmamış davet kodunu saklar (e-posta doğrulaması bekleniyorsa).
// Yalnızca kişisel bir kolaylıktır: sunucu kuralları değişmez, kod davet ekranında yeniden girilebilir.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_REFERRAL_KEY = 'referral_pending_code';

export async function savePendingReferralCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
  } catch {
    // Depolama yoksa kod sadece bu oturumda kullanılabilir; hata kullanıcıya gösterilmez.
  }
}

export async function loadPendingReferralCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    // yoksay
  }
}
