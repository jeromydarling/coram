/**
 * CROS™ i18n Configuration
 *
 * Internationalization infrastructure using react-i18next.
 * Supports English (en) and Spanish (es) with namespace-based translation files.
 *
 * Latin module names (Civitas, Signum, Relatio, Voluntārium, Prōvīsiō, etc.)
 * are intentionally NOT translated — they are part of the CROS brand identity.
 *
 * Installation:
 *   npm install i18next react-i18next i18next-browser-languagedetector
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English namespaces
import commonEn from './locales/en/common.json';
import navigationEn from './locales/en/navigation.json';
import dashboardEn from './locales/en/dashboard.json';
import relationshipsEn from './locales/en/relationships.json';
import eventsEn from './locales/en/events.json';
import volunteersEn from './locales/en/volunteers.json';
import provisionsEn from './locales/en/provisions.json';
import settingsEn from './locales/en/settings.json';
import marketingEn from './locales/en/marketing.json';
import operatorEn from './locales/en/operator.json';
import helpEn from './locales/en/help.json';
import narrativeEn from './locales/en/narrative.json';
import activitiesEn from './locales/en/activities.json';
import calendarEn from './locales/en/calendar.json';
import grantsEn from './locales/en/grants.json';
import intelligenceEn from './locales/en/intelligence.json';
import metrosEn from './locales/en/metros.json';
import reportsEn from './locales/en/reports.json';
import projectsEn from './locales/en/projects.json';

// Spanish namespaces
import commonEs from './locales/es/common.json';
import navigationEs from './locales/es/navigation.json';
import dashboardEs from './locales/es/dashboard.json';
import relationshipsEs from './locales/es/relationships.json';
import eventsEs from './locales/es/events.json';
import volunteersEs from './locales/es/volunteers.json';
import provisionsEs from './locales/es/provisions.json';
import settingsEs from './locales/es/settings.json';
import marketingEs from './locales/es/marketing.json';
import operatorEs from './locales/es/operator.json';
import helpEs from './locales/es/help.json';
import narrativeEs from './locales/es/narrative.json';
import activitiesEs from './locales/es/activities.json';
import calendarEs from './locales/es/calendar.json';
import grantsEs from './locales/es/grants.json';
import intelligenceEs from './locales/es/intelligence.json';
import metrosEs from './locales/es/metros.json';
import reportsEs from './locales/es/reports.json';
import projectsEs from './locales/es/projects.json';

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Español',
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

export const NAMESPACES = [
  'common',
  'navigation',
  'dashboard',
  'relationships',
  'events',
  'volunteers',
  'provisions',
  'settings',
  'marketing',
  'operator',
  'help',
  'narrative',
  'activities',
  'calendar',
  'grants',
  'intelligence',
  'metros',
  'reports',
  'projects',
] as const;

export type TranslationNamespace = (typeof NAMESPACES)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEn,
        navigation: navigationEn,
        dashboard: dashboardEn,
        relationships: relationshipsEn,
        events: eventsEn,
        volunteers: volunteersEn,
        provisions: provisionsEn,
        settings: settingsEn,
        marketing: marketingEn,
        operator: operatorEn,
        help: helpEn,
        narrative: narrativeEn,
        activities: activitiesEn,
        calendar: calendarEn,
        grants: grantsEn,
        intelligence: intelligenceEn,
        metros: metrosEn,
        reports: reportsEn,
        projects: projectsEn,
      },
      es: {
        common: commonEs,
        navigation: navigationEs,
        dashboard: dashboardEs,
        relationships: relationshipsEs,
        events: eventsEs,
        volunteers: volunteersEs,
        provisions: provisionsEs,
        settings: settingsEs,
        marketing: marketingEs,
        operator: operatorEs,
        help: helpEs,
        narrative: narrativeEs,
        activities: activitiesEs,
        calendar: calendarEs,
        grants: grantsEs,
        intelligence: intelligenceEs,
        metros: metrosEs,
        reports: reportsEs,
        projects: projectsEs,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [...NAMESPACES],

    detection: {
      // Priority: URL query > localStorage > browser language
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'cros-language',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false, // React already escapes
    },

    react: {
      useSuspense: true,
    },
  });

export default i18n;
