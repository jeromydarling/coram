/**
 * CROS™ i18n — Barrel Export
 *
 * Usage in your app entry point (main.tsx or App.tsx):
 *   import './i18n';
 *
 * Usage in components:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation('namespace');
 *   return <p>{t('key')}</p>;
 */

export { default } from './i18n';
export { SUPPORTED_LANGUAGES, NAMESPACES } from './i18n';
export type { SupportedLanguage, TranslationNamespace } from './i18n';
export { LanguageSwitcher } from '../components/LanguageSwitcher';
