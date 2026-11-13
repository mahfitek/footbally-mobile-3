// Profil görevleri: tek tanım listesi. Puanlar ve tamamlanma kuralları sunucudaki
// compute_profile_task_breakdown() ile aynıdır; skor yalnızca sunucuda hesaplanır
// (get_my_score_breakdown). İstemci görev durumunu kendisi hesaplamaz; yalnızca sunucu
// yanıtını bu tanımlarla eşleyip gösterir. Supabase'e bağımlı değildir (birim testleri kullanır).
import type { TranslationKey } from './i18n';

export type ProfileTaskId =
  | 'name'
  | 'position'
  | 'age'
  | 'height'
  | 'weight'
  | 'city'
  | 'district'
  | 'foot'
  | 'photo'
  | 'match'
  | 'apply'
  | 'premium'
  | 'aiCv'
  | 'aiAnalysis'
  | 'video';

export type ProfileTaskDef = {
  id: ProfileTaskId;
  points: number;
  screen: string;
  icon: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
};

/** Toplam skor üst sınırı. Tüm görevlerin puanları bu değere eşittir. */
export const PROFILE_SCORE_MAX = 100;

// Sıra ekranda gösterilen sıradır. Puanlar: mevcut 12 görev 50'ye ölçeklendi, yeni 3 görev 50.
export const PROFILE_TASK_DEFS: ProfileTaskDef[] = [
  { id: 'name', points: 5, screen: 'profile', icon: 'person-outline', titleKey: 'home_taskNameTitle', descKey: 'home_taskNameDesc' },
  { id: 'position', points: 5, screen: 'profile', icon: 'football-outline', titleKey: 'home_taskPositionTitle', descKey: 'home_taskPositionDesc' },
  { id: 'age', points: 3, screen: 'profile', icon: 'calendar-outline', titleKey: 'home_taskAgeTitle', descKey: 'home_taskAgeDesc' },
  { id: 'height', points: 3, screen: 'profile', icon: 'resize-outline', titleKey: 'home_taskHeightTitle', descKey: 'home_taskPhysicalDesc' },
  { id: 'weight', points: 2, screen: 'profile', icon: 'barbell-outline', titleKey: 'home_taskWeightTitle', descKey: 'home_taskPhysicalDesc' },
  { id: 'city', points: 3, screen: 'profile', icon: 'location-outline', titleKey: 'home_taskCityTitle', descKey: 'home_taskCityDesc' },
  { id: 'district', points: 2, screen: 'profile', icon: 'map-outline', titleKey: 'home_taskDistrictTitle', descKey: 'home_taskDistrictDesc' },
  { id: 'foot', points: 2, screen: 'profile', icon: 'footsteps-outline', titleKey: 'home_taskFootTitle', descKey: 'home_taskFootDesc' },
  { id: 'photo', points: 5, screen: 'profile', icon: 'camera-outline', titleKey: 'home_taskPhotoTitle', descKey: 'home_taskPhotoDesc' },
  { id: 'match', points: 8, screen: 'match', icon: 'football-outline', titleKey: 'home_taskMatchTitle', descKey: 'home_taskMatchDesc' },
  { id: 'apply', points: 5, screen: 'activities', icon: 'flag-outline', titleKey: 'home_taskApplyTitle', descKey: 'home_taskApplyDesc' },
  { id: 'premium', points: 7, screen: 'premium', icon: 'star-outline', titleKey: 'home_taskPremiumTitle', descKey: 'home_taskPremiumDesc' },
  { id: 'aiCv', points: 15, screen: 'ai', icon: 'document-text-outline', titleKey: 'home_taskAiCvTitle', descKey: 'home_taskAiCvDesc' },
  { id: 'aiAnalysis', points: 15, screen: 'ai', icon: 'hardware-chip-outline', titleKey: 'home_taskAiAnalysisTitle', descKey: 'home_taskAiAnalysisDesc' },
  { id: 'video', points: 20, screen: 'ai', icon: 'videocam-outline', titleKey: 'home_taskVideoTitle', descKey: 'home_taskVideoDesc' },
];

export const PROFILE_TASK_TOTAL = PROFILE_TASK_DEFS.reduce((sum, task) => sum + task.points, 0);

/** Sunucunun get_my_score_breakdown() yanıtındaki tek görev satırı. */
export type ProfileTaskState = { id: string; points: number; done: boolean };

export type ScoreBreakdown = { score: number; tasks: ProfileTaskState[] };

/** Sunucu yanıtını doğrular. Biçim bozuksa null: skor "bilinmiyor" kabul edilir, uydurulmaz. */
export function parseScoreBreakdown(raw: unknown): ScoreBreakdown | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { score, tasks } = raw as { score?: unknown; tasks?: unknown };
  if (typeof score !== 'number' || !Number.isFinite(score) || !Array.isArray(tasks)) return null;

  const parsed: ProfileTaskState[] = [];
  for (const row of tasks) {
    if (typeof row !== 'object' || row === null) return null;
    const { id, points, done } = row as { id?: unknown; points?: unknown; done?: unknown };
    if (typeof id !== 'string' || typeof points !== 'number' || typeof done !== 'boolean') return null;
    parsed.push({ id, points, done });
  }
  return { score: Math.min(PROFILE_SCORE_MAX, Math.max(0, Math.round(score))), tasks: parsed };
}

export type ProfileTaskRow = ProfileTaskDef & { done: boolean };

/**
 * Sunucu durumunu tanım sırasıyla eşler. Sunucuda olmayan tanım (eski sunucu) tamamlanmamış sayılır;
 * sunucunun bilmediği bir görev tamamlanmış gösterilmez.
 */
export function buildProfileTaskRows(breakdown: ScoreBreakdown): ProfileTaskRow[] {
  const doneById = new Map(breakdown.tasks.map((task) => [task.id, task.done]));
  return PROFILE_TASK_DEFS.map((def) => ({ ...def, done: doneById.get(def.id) === true }));
}
