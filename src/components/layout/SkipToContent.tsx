/**
 * SkipToContent — "Skip to main content" link for keyboard/screen reader users.
 *
 * WHAT: First focusable element on every page, visually hidden until focused.
 * WHERE: Top of MainLayout, before sidebar.
 * WHY: WCAG 2.4.1 — Bypass Blocks. Lets keyboard users skip navigation.
 */
import { useTranslation } from 'react-i18next';

export function SkipToContent() {
  const { t } = useTranslation('navigation');
  return (
    <a
      href="#main-content"
      className="
        sr-only focus:not-sr-only
        focus:fixed focus:top-2 focus:left-2 focus:z-[9999]
        focus:px-4 focus:py-2 focus:rounded-md
        focus:bg-primary focus:text-primary-foreground
        focus:text-sm focus:font-semibold
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
      "
    >
      {t('accessibility.skipToContent')}
    </a>
  );
}
