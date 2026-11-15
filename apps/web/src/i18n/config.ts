// Adapted from Void Protocol (© Guilhermy), apps/web/src/i18n/config.ts @ 218625d.
// Reused in ASTRIX Mission Studio under the project licence; see CREDITS.md.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { english, portuguese } from './resources';
i18n.use(LanguageDetector).use(initReactI18next).init({ resources: { en: { translation: english }, 'pt-BR': { translation: portuguese } }, supportedLngs: ['en', 'pt-BR'], fallbackLng: 'en', keySeparator: false, interpolation: { escapeValue: false }, detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'astrix.locale' } });
export default i18n;
