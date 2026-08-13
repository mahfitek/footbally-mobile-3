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
  success: '#2BAF66',
  error: '#F16063',
  tabBar: 'rgba(14,21,36,0.97)',
};

// Yön A gece temeline dayanıyor; ayrı bir "light mode" konsepti web tarafında yok.
// Kararımız: bg/card açık tonlarda kalır (mobilin native light/dark seçimini bozmuyoruz),
// ama accent (gold) aynı amber ailesinden, açık zeminde okunaklı koyu bir tona çekilir —
// "aynı marka, farklı parlaklık". Detay için görev sonuç raporuna bakın.
export const LightTheme = {
  bg: '#F5F5F5',
  bg2: '#FFFFFF',
  card: '#FFFFFF',
  card2: '#F0F0F0',
  text: '#111111',
  textMuted: '#444444',
  textSecondary: '#888888',
  border: '#E0E0E0',
  gold: '#C97F1E',
  goldLight: '#FFB347',
  goldDark: '#8F5710',
  success: '#1E8F52',
  error: '#dc2626',
  tabBar: 'rgba(255,255,255,0.97)',
};

export type Theme = typeof DarkTheme;

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
