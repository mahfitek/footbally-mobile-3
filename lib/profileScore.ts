// Profil tamamlanma puanı (0-100). Yalnızca istemcide, profil alanlarına bakarak hesaplanır.
// Bu puan doğrulanmış futbol yetenek puanı (overall_rating / AI analizi) DEĞİLDİR; ikisi
// ekranlarda karıştırılmaz. profiles.score kolonu bu değerle yazılmaz (bkz. refresh_my_score).

export type ProfileCompletionInput = {
  full_name?: string | null;
  position?: string | null;
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  city?: string | null;
  district?: string | null;
  foot?: string | null;
  club?: string | null;
  activity_score?: number | null;
};

export const calculateProfileCompletion = (profile: ProfileCompletionInput): number => {
  let score = 0;

  // Profil tamamlanması (50 puan)
  if (profile.full_name) score += 10;
  if (profile.position) score += 10;
  if (profile.age) score += 5;
  if (profile.height) score += 5;
  if (profile.weight) score += 5;
  if (profile.city) score += 5;
  if (profile.district) score += 3;
  if (profile.foot) score += 3;
  if (profile.club) score += 4;

  // Aktivite (50 puan) — şimdilik sabit; maç/başvuru verisi gelince gerçek değer okunacak
  score += profile.activity_score || 0;

  return Math.min(score, 100);
};
