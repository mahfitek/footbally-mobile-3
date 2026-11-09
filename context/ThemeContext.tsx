import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, LightTheme, Theme } from '../constants/theme';

const THEME_STORAGE_KEY = '@footbally/theme';

type ThemeContextValue = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: LightTheme,
  isDark: false,
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

interface Props {
  children: ReactNode;
}

export function ThemeProvider({ children }: Props) {
  // Varsayılan açık tema; kullanıcı daha önce koyu temayı seçtiyse AsyncStorage'dan geri yüklenir.
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light') setIsDark(false);
      else if (stored === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? DarkTheme : LightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
