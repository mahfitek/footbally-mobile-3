import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, TranslationKey, t as translate } from '../lib/i18n';

const LANGUAGE_STORAGE_KEY = '@footbally/language';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'tr',
  setLang: () => {},
  t: (key) => translate(key, 'tr'),
});

export function useLanguage() {
  return useContext(LanguageContext);
}

interface Props {
  children: ReactNode;
}

export function LanguageProvider({ children }: Props) {
  const [lang, setLangState] = useState<Lang>('tr');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (stored === 'tr' || stored === 'en') setLangState(stored);
    });
  }, []);

  const setLang = (next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: (key) => translate(key, lang) }}>
      {children}
    </LanguageContext.Provider>
  );
}
