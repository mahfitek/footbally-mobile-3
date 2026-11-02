import type { SupabaseClient } from '@supabase/supabase-js';

// AI video analizi için açık rıza. Görüntü, analiz amacıyla üçüncü taraf (Google Gemini) servisine gönderilir.
//
// DURUM: TASLAK. Hukuki onay bekliyor (legalReviewed: false). Metin değiştiğinde documentVersion artırılmalı,
// böylece eski rızalar yeni metne bağlanmaz.
//
// Kayıt: user_consents tablosu, record_user_consent RPC'si üzerinden (istemcinin doğrudan INSERT izni yok).
// RPC canlıda yoksa kayıt başarısız olur ve analiz başlatılmaz (fail-closed).

export const AI_VIDEO_CONSENT = {
  consentType: 'ai_video_analysis_gemini',
  documentVersion: 'draft-2026-11-02',
  legalReviewed: false,
  text: {
    tr: 'Yüklediğim görüntünün performans analizi amacıyla Google\'ın Gemini yapay zekâ servisine gönderilmesini ve görüntünün Footbally sunucularında saklanmasını kabul ediyorum. Rızamı info@getfootbally.com üzerinden geri çekebilirim.',
    en: 'I agree that the image I upload will be sent to Google\'s Gemini AI service for performance analysis, and that the image will be stored on Footbally servers. I can withdraw this consent by writing to info@getfootbally.com.',
  },
} as const;

// Rıza kaydı başarılıysa true. Hata veya RPC eksikliğinde false döner; çağıran analizi durdurmalıdır.
export async function recordAiVideoConsent(client: Pick<SupabaseClient, 'rpc'>): Promise<boolean> {
  try {
    const { error } = await client.rpc('record_user_consent', {
      p_app: 'mobile',
      p_consent_type: AI_VIDEO_CONSENT.consentType,
      p_document_version: AI_VIDEO_CONSENT.documentVersion,
      p_granted: true,
    });
    return !error;
  } catch {
    return false;
  }
}
