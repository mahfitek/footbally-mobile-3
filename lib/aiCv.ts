// Deterministik AI CV metni: profil verilerinden üretilir, yapay zeka çağrısı yapmaz. Aynı girdi her zaman
// aynı metni verir. Etiketler ve değer çevirileri çağıranın verdiği t() ile seçili dilde üretilir.
import type { TranslationKey } from './i18n';
import { profileFootLabelKey, profilePositionLabelKey } from './profileCompletion';

/** save_my_ai_cv RPC'sinin kabul ettiği en fazla uzunluk. */
export const AI_CV_MAX_LENGTH = 4000;

export type AiCvInput = {
  fullName: string | null;
  position: string | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  city: string | null;
  district: string | null;
  club: string | null;
  foot: string | null;
  bio: string | null;
  /** Profil tamamlanma puanı (sunucu, 0-100). */
  score: number | null;
  /** AI analiz genel puanı (profiles.overall_rating), varsa. */
  overallRating: number | null;
  /** Son tamamlanmış AI analizindeki güçlü yönler, varsa. */
  strengths: string[];
};

type T = (key: TranslationKey) => string;

const clean = (value: string | null | undefined): string => (value ?? '').trim();

const labelled = (label: string, value: string): string => `${label}: ${value}`;

/** CV metnini üretir. Boş alanlar atlanır; sonuç en fazla AI_CV_MAX_LENGTH karakterdir. */
export function buildAiCvText(input: AiCvInput, t: T): string {
  const lines: string[] = [];

  const name = clean(input.fullName);
  lines.push(name || t('aiCv_title'));
  lines.push(t('aiCv_title'));

  const position = clean(input.position);
  if (position) {
    const key = profilePositionLabelKey(position);
    lines.push(labelled(t('aiCv_position'), key ? t(key) : position));
  }
  if (input.age) lines.push(labelled(t('aiCv_age'), String(input.age)));
  if (input.height) lines.push(labelled(t('aiCv_height'), `${input.height} cm`));
  if (input.weight) lines.push(labelled(t('aiCv_weight'), `${input.weight} kg`));

  const foot = clean(input.foot);
  if (foot) {
    const key = profileFootLabelKey(foot);
    lines.push(labelled(t('aiCv_foot'), key ? t(key) : foot));
  }

  const city = clean(input.city);
  const district = clean(input.district);
  const location = [city, district].filter(Boolean).join(', ');
  if (location) lines.push(labelled(t('aiCv_location'), location));

  const club = clean(input.club);
  if (club) lines.push(labelled(t('aiCv_club'), club));

  if (input.score !== null) lines.push(labelled(t('aiCv_profileScore'), `${input.score}/100`));
  if (input.overallRating !== null) lines.push(labelled(t('aiCv_aiRating'), `${input.overallRating}/100`));

  const strengths = input.strengths.map((s) => s.trim()).filter(Boolean);
  if (strengths.length > 0) lines.push(labelled(t('aiCv_strengths'), strengths.join(', ')));

  const bio = clean(input.bio);
  if (bio) lines.push(labelled(t('aiCv_about'), bio));

  return lines.join('\n').slice(0, AI_CV_MAX_LENGTH);
}
