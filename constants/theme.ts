// "Under the Lights" — gece maçı / floodlight ruh hali. Yön A referans paleti.
export const DarkTheme = {
  bg: '#060A12',
  bg2: '#0E1524',
  card: '#0E1524',
  card2: '#121A2C',
  text: '#EDEFF5',
  textMuted: '#8A93A6',
  textSecondary: '#717A8E',
  border: '#1C2536',
  gold: '#FFB347',
  goldLight: '#FFC670',
  goldDark: '#D98F2B',
  // getfootbally.com'daki "scout'a görün" vurgusu ve ikincil rozet/avatar rengi.
  purple: '#8B7CF6',
  purpleLight: '#A99BFF',
  purpleDark: '#6C5CE0',
  success: '#2BAF66',
  error: '#F16063',
  tabBar: 'rgba(14,21,36,0.97)',
};

// Yön A gece temeline dayanıyor; ayrı bir "light mode" konsepti web tarafında yok.
// Kararımız: bg/card açık tonlarda kalır (mobilin native light/dark seçimini bozmuyoruz),
// ama accent (gold) aynı amber ailesinden, açık zeminde okunaklı koyu bir tona çekilir —
// "aynı marka, farklı parlaklık". Detay için görev sonuç raporuna bakın.
// 2026-10 "Modern Kartlar" görsel yenilemesi: beyaz zemin, zümrüt yeşili aksan,
// hafif border ve neredeyse görünmez gölge. `gold` anahtarı geriye dönük uyum için
// korunur; açık temada değeri artık birincil zümrüt yeşilidir.
export const LightTheme = {
  bg: '#FFFFFF',
  bg2: '#F6F8FA',
  card: '#FFFFFF',
  card2: '#F6F8FA',
  text: '#101820',
  textMuted: '#6B7280',
  textSecondary: '#6B7280',
  border: '#E6EBEF',
  gold: '#079667',
  goldLight: '#079667',
  goldDark: '#067A54',
  purple: '#079667',
  purpleLight: '#E8F7F0',
  purpleDark: '#067A54',
  success: '#079667',
  error: '#D92D20',
  tabBar: 'rgba(255,255,255,0.98)',
};

export type Theme = typeof DarkTheme;

// "Lisans Kartı" tasarım sistemi — 2026-08 yeniden tasarımı: resmi belge/scouting
// raporu estetiği, tek radius, tüm ekranlarda ortak kağıt paneli.
// 2026-09: getfootbally.com web tasarımıyla hizalamak için radius yumuşatıldı
// (sivri "belge" köşesinden web'in yuvarlak kart/pill diline geçiş) ve pill'ler
// için ayrı bir tam-yuvarlak sabit eklendi.
export const CARD_RADIUS = 18;
export const PILL_RADIUS = 999;
// Butonlar için 12–16 px aralığında sabit radius (pill yerine yumuşak dikdörtgen).
export const BUTTON_RADIUS = 14;
// Kartlarda neredeyse görünmez gölge; asıl ayrım hafif border ile sağlanır.
export const SOFT_SHADOW = {
  shadowColor: '#101820',
  shadowOpacity: 0.04,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};
export const Paper = {
  bg: '#FFFFFF',
  ink: '#101820',
  muted: '#6B7280',
  line: '#E6EBEF',
};

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
