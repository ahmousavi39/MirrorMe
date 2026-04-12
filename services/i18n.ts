import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '@/locales/en.json';
import zhHans from '@/locales/zh-Hans.json';
import ja from '@/locales/ja.json';
import de from '@/locales/de.json';
import fr from '@/locales/fr.json';
import es from '@/locales/es.json';

export const LANGUAGE_KEY = '@app_language';
export const SUPPORTED_LANGUAGES = [
  { code: 'en',      labelKey: 'settings.langEn' },
  { code: 'zh-Hans', labelKey: 'settings.langZhHans' },
  { code: 'ja',      labelKey: 'settings.langJa' },
  { code: 'de',      labelKey: 'settings.langDe' },
  { code: 'fr',      labelKey: 'settings.langFr' },
  { code: 'es',      labelKey: 'settings.langEs' },
] as const;

function detectDeviceLanguage(): string {
  const locale = Localization.getLocales()[0];
  const tag = locale?.languageTag ?? 'en';
  // zh-Hans covers Simplified Chinese (mainland China, Singapore)
  // zh-Hant (Taiwan TW, Hong Kong HK, Macao MO) falls back to English for now
  if (tag.startsWith('zh')) {
    if (
      tag.includes('Hant') ||
      tag.includes('-TW') ||
      tag.includes('-HK') ||
      tag.includes('-MO')
    ) {
      return 'en';
    }
    return 'zh-Hans';
  }
  if (tag.startsWith('ja')) return 'ja';
  if (tag.startsWith('de')) return 'de';
  if (tag.startsWith('fr')) return 'fr';
  if (tag.startsWith('es')) return 'es';
  return 'en';
}

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    'zh-Hans': { translation: zhHans },
    ja: { translation: ja },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
  },
  interpolation: {
    escapeValue: false,
  },
});

// Restore user's manual language preference (if any) as soon as possible.
AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
  if (saved && saved !== i18n.language) {
    i18n.changeLanguage(saved);
  }
});

/** Change language, persist the choice, and apply it immediately. */
export async function changeLanguage(code: string): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, code);
  await i18n.changeLanguage(code);
}

export default i18n;
