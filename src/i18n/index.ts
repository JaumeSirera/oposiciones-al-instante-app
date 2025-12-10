import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './locales/es.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import de from './locales/de.json';
import zh from './locales/zh.json';

const resources = {
  es: { translation: es },
  en: { translation: en },
  fr: { translation: fr },
  pt: { translation: pt },
  de: { translation: de },
  zh: { translation: zh },
};

// Update HTML lang attribute when language changes
const updateHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'zh' ? 'ltr' : 'ltr'; // All languages are LTR
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

// Set initial lang attribute
updateHtmlLang(i18n.language || 'es');

// Listen for language changes
i18n.on('languageChanged', updateHtmlLang);

export default i18n;
