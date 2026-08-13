export const DarkTheme = {
  bg: '#050505',
  bg2: '#0D0D0D',
  card: '#0D0D0D',
  card2: '#121212',
  text: '#FFFFFF',
  textMuted: '#CFCFCF',
  textSecondary: '#666666',
  border: '#1a1a1a',
  gold: '#E8B820',
  goldLight: '#F7D96A',
  goldDark: '#C48F0C',
  success: '#3ddc84',
  error: '#f87171',
  tabBar: 'rgba(13,13,13,0.97)',
};

export const LightTheme = {
  bg: '#F5F5F5',
  bg2: '#FFFFFF',
  card: '#FFFFFF',
  card2: '#F0F0F0',
  text: '#111111',
  textMuted: '#444444',
  textSecondary: '#888888',
  border: '#E0E0E0',
  gold: '#C48F0C',
  goldLight: '#E8B820',
  goldDark: '#9A6D00',
  success: '#1a9e5c',
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
