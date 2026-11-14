// Profil maç videosu yükleme kuralları (web sitesiyle aynı). Yan etkisi yok; birim testleri kullanır.
// Video, 'profile-media' (herkese açık) deposuna yüklenir; profiles.video_urls listesine açık bağlantı (publicUrl) yazılır.

/** Herkese açık depo. Depo politikası yolun ilk klasörünün auth.uid() olmasını şart koşar. */
export const PROFILE_VIDEO_BUCKET = 'profile-media';

/** Depo sınırıyla aynı: 200 MB. */
export const PROFILE_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

const CONTENT_TYPE_TO_EXT = new Map<string, string>([
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
  ['video/webm', 'webm'],
  ['video/x-m4v', 'm4v'],
]);

const EXT_TO_CONTENT_TYPE = new Map<string, string>(
  Array.from(CONTENT_TYPE_TO_EXT, ([type, ext]) => [ext, type] as const),
);

export type ProfileVideoType = { contentType: string; ext: string };

/**
 * Yüklenecek videonun türü. Seçicinin verdiği mimeType öncelikli; yoksa dosya uzantısına bakılır.
 * Desteklenmeyen tür için null.
 */
export function resolveProfileVideoType(
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
): ProfileVideoType | null {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime) {
    const ext = CONTENT_TYPE_TO_EXT.get(mime);
    return ext ? { contentType: mime, ext } : null;
  }
  const ext = (fileName?.split('.').pop() ?? '').toLowerCase();
  const contentType = EXT_TO_CONTENT_TYPE.get(ext);
  return contentType ? { contentType, ext } : null;
}

/** Depo yolu: <uid>/videos/<zaman>.<uzantı>. Yol her zaman kullanıcı kimliğiyle başlar. */
export function profileVideoPath(userId: string, nowMs: number, ext: string): string {
  return `${userId}/videos/${nowMs}.${ext}`;
}

export type ProfileVideoRejection = 'too_large' | 'bad_type';

/** Yüklemeden önce kontrol. Boyut bilinmiyorsa (fileSize yok) null geçer; yükleme sonrası byteLength tekrar kontrol edilir. */
export function checkProfileVideo(input: {
  mimeType: string | null | undefined;
  fileName: string | null | undefined;
  fileSize?: number | null;
}): { ok: true; type: ProfileVideoType } | { ok: false; reason: ProfileVideoRejection } {
  const type = resolveProfileVideoType(input.mimeType, input.fileName);
  if (!type) return { ok: false, reason: 'bad_type' };
  if (input.fileSize != null && input.fileSize > PROFILE_VIDEO_MAX_BYTES) return { ok: false, reason: 'too_large' };
  return { ok: true, type };
}
