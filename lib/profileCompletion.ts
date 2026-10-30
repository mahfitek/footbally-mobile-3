// Profil tamamlama kuralları (saf fonksiyonlar). Supabase'e bağımlı değildir; birim testleri bu dosyayı kullanır.
//
// Tek doğruluk kaynağı sunucudur: tamamlanma zamanı `profiles.profile_completed_at` alanındadır ve yalnızca
// complete_my_player_profile() RPC'si yazar. Bu dosya yalnızca formu sunucunun kabul ettiği değerlere çevirir,
// eksik alanları listeler ve RPC sonucunu sınıflandırır. Sahte "tamamlandı" durumu üretmez.
import { isMissingRpc } from './reports';
import { FOOTBALL_POSITIONS } from '../constants/footballPositions';

/** Sunucunun (complete_my_player_profile) kabul ettiği mevki değerleri. Form yalnızca bunları gönderir. */
export const PROFILE_POSITIONS = ['Kaleci', 'Defans', 'Orta Saha', 'Kanat', 'Forvet'] as const;

/** Sunucunun kabul ettiği ayak değerleri. */
export const PROFILE_FOOT_OPTIONS = ['Sağ', 'Sol', 'Her İkisi'] as const;

export const PROFILE_RANGES = {
  age: { min: 10, max: 80 },
  height: { min: 100, max: 250 },
  weight: { min: 30, max: 250 },
} as const;

/** Sunucunun tamamlanma için zorunlu tuttuğu alanlar. */
export type RequiredProfileField = 'full_name' | 'position' | 'city' | 'district' | 'foot' | 'age' | 'height' | 'weight';

/**
 * Durum:
 *  - complete:   sunucu tamamlanma zamanı döndü (profile_completed_at dolu)
 *  - incomplete: sunucu alanı döndü ama tamamlanma zamanı boş
 *  - unknown:    sunucu yanıtında alan yok (eski sunucu sürümü); istemci tamamlandı diyemez
 */
export type ProfileCompletionState = 'complete' | 'incomplete' | 'unknown';

/** Kendi profil satırından durum. Satır sorgusunda alan yoksa (eski sunucu) unknown. */
export function completionStateOf(row: unknown): ProfileCompletionState {
  if (typeof row !== 'object' || row === null || !('profile_completed_at' in row)) return 'unknown';
  return row.profile_completed_at ? 'complete' : 'incomplete';
}

/** Ayrıntılı mevki (ör. "Ofansif Orta Saha (CAM)") ya da kategori adını sunucu değerine çevirir. Tanınmazsa null. */
export function toProfilePosition(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if ((PROFILE_POSITIONS as readonly string[]).includes(trimmed)) return trimmed;
  const category = FOOTBALL_POSITIONS.find((cat) => cat.positions.includes(trimmed));
  return category && (PROFILE_POSITIONS as readonly string[]).includes(category.category) ? category.category : null;
}

/** Eski ayak etiketlerini ("Sağ Ayak") sunucu değerine çevirir. Tanınmazsa null. */
export function toProfileFoot(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const legacy: Record<string, string> = { 'Sağ Ayak': 'Sağ', 'Sol Ayak': 'Sol' };
  const normalized = legacy[trimmed] ?? trimmed;
  return (PROFILE_FOOT_OPTIONS as readonly string[]).includes(normalized) ? normalized : null;
}

export interface ProfileFormValues {
  fullName: string;
  position: string;
  city: string;
  district: string;
  foot: string;
  age: string;
  height: string;
  weight: string;
  club: string;
}

/** Form metninden sayıya; boş ya da sayı değilse null. */
function toNumber(value: string): number | null {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Tamamlanma için eksik ya da geçersiz zorunlu alanlar. Boş liste: sunucuya gönderilebilir.
 * Aralık kontrolü sunucuyla aynıdır; yine de sunucu nihai karardır.
 */
export function missingRequiredFields(values: ProfileFormValues): RequiredProfileField[] {
  const missing: RequiredProfileField[] = [];
  if (!values.fullName.trim()) missing.push('full_name');
  if (!toProfilePosition(values.position)) missing.push('position');
  if (!values.city.trim()) missing.push('city');
  if (!values.district.trim()) missing.push('district');
  if (!toProfileFoot(values.foot)) missing.push('foot');
  const age = toNumber(values.age);
  if (age === null || age < PROFILE_RANGES.age.min || age > PROFILE_RANGES.age.max) missing.push('age');
  const height = toNumber(values.height);
  if (height === null || height < PROFILE_RANGES.height.min || height > PROFILE_RANGES.height.max) missing.push('height');
  const weight = toNumber(values.weight);
  if (weight === null || weight < PROFILE_RANGES.weight.min || weight > PROFILE_RANGES.weight.max) missing.push('weight');
  return missing;
}

/**
 * PATCH /rest/v1/profiles gövdesi. Boş alanlar null olur; istemci varsayılan değer atamaz.
 * profile_completed_at ve profile_completion_source burada YOKTUR (istemci yazamaz).
 */
export function buildProfilePatch(values: ProfileFormValues): Record<string, unknown> {
  return {
    full_name: values.fullName.trim() || null,
    position: toProfilePosition(values.position),
    city: values.city.trim() || null,
    district: values.district.trim() || null,
    foot: toProfileFoot(values.foot),
    age: toNumber(values.age),
    height: toNumber(values.height),
    weight: toNumber(values.weight),
    club: values.club.trim() || null,
  };
}

/** Kolon yok (migration uygulanmamış sunucu): PostgREST 42703. */
export function isMissingColumnError(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703';
}

export type CompletionOutcome =
  | { status: 'completed'; completedAt: string }
  | { status: 'unavailable' }
  | { status: 'incomplete' }
  | { status: 'restricted' }
  | { status: 'failed' };

/**
 * complete_my_player_profile sonucunu sınıflandırır.
 *  - RPC yoksa: unavailable (tamamlandı DEĞİL; kayıt başarılı gibi gösterilmez)
 *  - profile_incomplete / profile_invalid_value: incomplete
 *  - account_restricted: restricted (kişisel hesap kısıtlı)
 *  - başarı: completed (sunucudan gelen zaman damgası)
 */
export function classifyCompletionResult(
  result: { data: unknown; error: { code?: string; message?: string } | null },
): CompletionOutcome {
  const { data, error } = result;
  if (error) {
    if (isMissingRpc(error)) return { status: 'unavailable' };
    const message = error.message ?? '';
    if (message.includes('profile_incomplete') || message.includes('profile_invalid_value')) return { status: 'incomplete' };
    if (message.includes('account_restricted')) return { status: 'restricted' };
    return { status: 'failed' };
  }
  if (typeof data === 'string' && data.length > 0) return { status: 'completed', completedAt: data };
  return { status: 'failed' };
}
