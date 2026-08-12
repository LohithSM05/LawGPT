import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enNav from './locales/en/nav.json';
import enAuth from './locales/en/auth.json';
import knCommon from './locales/kn/common.json';
import knNav from './locales/kn/nav.json';
import knAuth from './locales/kn/auth.json';

/**
 * To add a new language: drop a new `locales/<code>/*.json` set, import it
 * above, add it to `resources`, and list it here. No component changes
 * needed — every component reads labels through `t()` keys, not hardcoded
 * strings.
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

const STORAGE_KEY = 'lawgpt-language';

function detectInitialLanguage() {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const browserLang = window.navigator.language?.slice(0, 2);
  return SUPPORTED_LANGUAGES.some((l) => l.code === browserLang) ? browserLang : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, nav: enNav, auth: enAuth },
    kn: { common: knCommon, nav: knNav, auth: knAuth },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  ns: ['common', 'nav', 'auth'],
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
  returnEmptyString: false,
});

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, lng);
  }
});

export default i18n;
