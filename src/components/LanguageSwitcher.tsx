/**
 * CROS™ Language Switcher Component
 *
 * Drop this into your Header or Sidebar.
 * Uses i18next to switch between English and Spanish.
 *
 * Usage:
 *   import { LanguageSwitcher } from '@/components/LanguageSwitcher';
 *   <LanguageSwitcher />
 *   <LanguageSwitcher variant="minimal" />  // flag-only toggle
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n/i18n';

interface LanguageSwitcherProps {
  /** 'dropdown' shows a select menu; 'minimal' shows a compact toggle */
  variant?: 'dropdown' | 'minimal';
  /** Optional className for custom styling */
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'dropdown',
  className = '',
}) => {
  const { i18n, t } = useTranslation('common');

  const currentLang = (i18n.language?.substring(0, 2) || 'en') as SupportedLanguage;

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    // Update document lang attribute for accessibility
    document.documentElement.lang = lang;
  };

  if (variant === 'minimal') {
    const nextLang: SupportedLanguage = currentLang === 'en' ? 'es' : 'en';
    return (
      <button
        onClick={() => handleLanguageChange(nextLang)}
        className={`cros-lang-toggle ${className}`}
        aria-label={t('accessibility.languageSelector')}
        title={SUPPORTED_LANGUAGES[nextLang]}
        type="button"
      >
        <span className="cros-lang-toggle__current">
          {currentLang === 'en' ? 'EN' : 'ES'}
        </span>
      </button>
    );
  }

  return (
    <div className={`cros-lang-switcher ${className}`}>
      <label htmlFor="cros-language-select" className="sr-only">
        {t('accessibility.languageSelector')}
      </label>
      <select
        id="cros-language-select"
        value={currentLang}
        onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
        className="cros-lang-switcher__select"
        aria-label={t('accessibility.languageSelector')}
      >
        {(Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][]).map(
          ([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          )
        )}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
