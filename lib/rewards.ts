import { profiles } from './profiles';
import { TranslationKey } from './i18n';

type T = (key: TranslationKey) => string;

export type LevelColorKey = 'error' | 'gold' | 'goldLight' | 'success' | 'purple';
export type LevelBand = { label: string; min: number; colorKey: LevelColorKey };

const LEVEL_MINS: { min: number; colorKey: LevelColorKey; labelKey: TranslationKey }[] = [
  { min: 0, colorKey: 'error', labelKey: 'rewards_levelStarting' },
  { min: 31, colorKey: 'gold', labelKey: 'rewards_levelImproving' },
  { min: 61, colorKey: 'gold', labelKey: 'rewards_levelGood' },
  { min: 81, colorKey: 'goldLight', labelKey: 'rewards_levelElite' },
  { min: 100, colorKey: 'purple', labelKey: 'rewards_levelPerfect' },
];

export const getLevel = (score: number, t: T): LevelBand => {
  let current = LEVEL_MINS[0];
  for (const band of LEVEL_MINS) {
    if (score >= band.min) current = band;
  }
  return { label: t(current.labelKey), min: current.min, colorKey: current.colorKey };
};

export type Badge = {
  key: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  rewardDays: number;
};

export const MAX_REWARD_PREMIUM_DAYS_PER_MONTH = 7;

export const getBadges = (score: number, hasProfileBasics: boolean, isPremiumActive: boolean, t: T): Badge[] => [
  { key: 'basics', icon: 'person-outline', title: t('rewards_badgeBasicsTitle'), desc: t('rewards_badgeBasicsDesc'), unlocked: hasProfileBasics, rewardDays: 1 },
  { key: 'gelisiyor', icon: 'trending-up-outline', title: t('rewards_levelImproving'), desc: t('rewards_badgeGelisiyorDesc'), unlocked: score >= 31, rewardDays: 1 },
  { key: 'iyi', icon: 'ribbon-outline', title: t('rewards_levelGood'), desc: t('rewards_badgeIyiDesc'), unlocked: score >= 61, rewardDays: 2 },
  { key: 'elit', icon: 'star-outline', title: t('rewards_levelElite'), desc: t('rewards_badgeElitDesc'), unlocked: score >= 81, rewardDays: 2 },
  { key: 'mukemmel', icon: 'trophy-outline', title: t('rewards_levelPerfect'), desc: t('rewards_badgeMukemmelDesc'), unlocked: score >= 100, rewardDays: 3 },
  { key: 'premium', icon: 'diamond-outline', title: t('rewards_badgePremiumTitle'), desc: t('rewards_badgePremiumDesc'), unlocked: isPremiumActive, rewardDays: 0 },
];

// Ay anahtarı sunucuyla (award_due_profile_badges) aynı saat diliminde hesaplanır: Europe/Istanbul.
// Türkiye yaz saati uygulamadığı için sabit UTC+3 kullanılır; cihazın yerel saat dilimi etkilemez.
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
export const currentMonthKey = (d: Date = new Date()): string => {
  const istanbul = new Date(d.getTime() + ISTANBUL_OFFSET_MS);
  return `${istanbul.getUTCFullYear()}-${String(istanbul.getUTCMonth() + 1).padStart(2, '0')}`;
};

export type RewardProgress = {
  claimedBadgeKeys: string[];
  daysClaimedThisMonth: number;
  monthKey: string | null;
};

export const loadRewardProgress = async (userId: string): Promise<RewardProgress> => {
  const { data } = await profiles.ownProfile('claimed_badge_keys, reward_premium_days_this_month, reward_premium_month_key');

  const monthKey = currentMonthKey();
  const sameMonth = data?.reward_premium_month_key === monthKey;
  return {
    claimedBadgeKeys: data?.claimed_badge_keys ?? [],
    daysClaimedThisMonth: sameMonth ? data?.reward_premium_days_this_month ?? 0 : 0,
    monthKey: data?.reward_premium_month_key ?? null,
  };
};

