import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

// ---------------------------------------------------------------------------
// App Store / Play Store puanlama sorusu
// ---------------------------------------------------------------------------
// Kullanıcıya, uygulamayı ilk açtığı tarihten belirli bir süre sonra bir kez
// "beğendin mi?" sorusu sorulur. Cevaplarsa (evet ya da hayır) bir daha hiç
// gösterilmez; sheet kapatılıp cevapsız geçilirse RETRY_AFTER_DAYS sonra
// tekrar denenir. Böylece kullanıcı rahatsız edilmeden, olumsuz deneyimi olan
// kullanıcılar mağazaya değil iç geri bildirime yönlendirilmiş olur.

const FIRST_LAUNCH_KEY = 'rating_first_launch_at';
const RESPONDED_KEY = 'rating_prompt_responded';
const LAST_SHOWN_KEY = 'rating_prompt_last_shown_at';

const DAYS_BEFORE_PROMPT = 3;
const RETRY_AFTER_DAYS = 7;

const daysBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

export async function shouldShowRatingPrompt(): Promise<boolean> {
  try {
    const responded = await AsyncStorage.getItem(RESPONDED_KEY);
    if (responded === 'true') return false;

    const firstLaunch = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (!firstLaunch) {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, new Date().toISOString());
      return false;
    }

    if (daysBetween(new Date(firstLaunch), new Date()) < DAYS_BEFORE_PROMPT) return false;

    const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    if (lastShown && daysBetween(new Date(lastShown), new Date()) < RETRY_AFTER_DAYS) return false;

    return true;
  } catch {
    return false;
  }
}

export async function markRatingPromptShown() {
  await AsyncStorage.setItem(LAST_SHOWN_KEY, new Date().toISOString());
}

export async function markRatingPromptResponded() {
  await AsyncStorage.setItem(RESPONDED_KEY, 'true');
}

export async function requestNativeReview() {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
      return;
    }
  } catch {
    // aşağıdaki mağaza linkine düş
  }

  if (Platform.OS === 'android') {
    Linking.openURL('market://details?id=com.footbally.app').catch(() => {});
  }
  // iOS için uygulama henüz App Store'da yayınlanmadan gerçek bir mağaza
  // linki verilemez; App Store ID atandığında burada itms-apps:// linki
  // eklenmeli.
}
