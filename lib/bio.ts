// Hakkımda (profiles.bio). En fazla 500 karakter; kayıttan önce kişisel veri ve zararlı kod filtresi uygulanır
// (lib/security.ts). Sınır istemcide uygulanır: aynı sütuna web sitesi CV metni yazdığından sunucuya uzunluk
// kısıtı eklenmedi (bkz. rapor). Karakter sayımı kod noktasıyla yapılır; veritabanının char_length sayımıyla aynıdır.
import { moderateMessage } from './security';

export const BIO_MAX_LENGTH = 500;

export type BioReasonKey = 'bio_tooLong' | 'moderation_personalData' | 'moderation_maliciousCode';

export type BioCheck = { ok: true; value: string | null } | { ok: false; reasonKey: BioReasonKey };

export function bioLength(text: string): number {
  return Array.from(text).length;
}

/** Kaydetmeden önce: kırpılır, uzunluk ve moderasyon denetlenir. Boş metin null olarak kaydedilir. */
export function checkBio(input: string): BioCheck {
  const value = input.trim();
  if (bioLength(value) > BIO_MAX_LENGTH) return { ok: false, reasonKey: 'bio_tooLong' };
  if (value) {
    const verdict = moderateMessage(value);
    if (!verdict.allowed) {
      return {
        ok: false,
        reasonKey: verdict.reasonKey === 'moderation_personalData' ? 'moderation_personalData' : 'moderation_maliciousCode',
      };
    }
  }
  return { ok: true, value: value || null };
}

export type BioView = { mode: 'hidden' } | { mode: 'owner_empty' } | { mode: 'text'; text: string };

/**
 * Profilde ne gösterilecek. Kendi profilimde boşsa ipucu ve "Ekle" düğmesi çıkar. Başkasının profilinde
 * boşsa bölüm hiç gösterilmez. Engellediğim kişinin hakkında bölümü her durumda gizlidir.
 */
export function bioView(input: { isOwn: boolean; bio: string | null | undefined; blocked: boolean }): BioView {
  if (input.blocked) return { mode: 'hidden' };
  const text = (input.bio ?? '').trim();
  if (text) return { mode: 'text', text };
  return input.isOwn ? { mode: 'owner_empty' } : { mode: 'hidden' };
}

export type BioSave =
  | { ok: true; send: false }
  | { ok: true; send: true; value: string | null }
  | { ok: false; reasonKey: BioReasonKey };

/**
 * Profil kaydında bio: yalnızca DEĞİŞTİYSE denetlenir ve gönderilir. Değişmediyse sınır uygulanmaz ve sütun
 * aynen kalır; böylece web sitesinin yazdığı uzun CV metni profil kaydını engellemez ve üzerine yazılmaz.
 */
export function bioSaveFor(draft: string, saved: string | null | undefined): BioSave {
  if (draft.trim() === (saved ?? '').trim()) return { ok: true, send: false };
  const check = checkBio(draft);
  if (!check.ok) return { ok: false, reasonKey: check.reasonKey };
  return { ok: true, send: true, value: check.value };
}
