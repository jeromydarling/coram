/**
 * RelatioPositioningMatrixCard — Lightweight positioning matrix.
 *
 * WHAT: Three-column quiet comparison: Traditional CRM vs CROS vs Bridge Mode.
 * WHERE: Homepage, below the Imagine / See People narrative cards.
 * WHY: Clarifies CROS positioning without aggressive sales language.
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ColumnTone = 'muted' | 'accent';

const columnKeys: { key: 'crm' | 'cros' | 'bridge'; tone: ColumnTone }[] = [
  { key: 'crm', tone: 'muted' },
  { key: 'cros', tone: 'accent' },
  { key: 'bridge', tone: 'muted' },
];

export default function RelatioPositioningMatrixCard() {
  const { t } = useTranslation('marketing');
  return (
    <section
      aria-label="How CROS relates to your existing tools"
      className="max-w-[960px] mx-auto px-4 sm:px-6 py-10 sm:py-14"
    >
      <div className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))] p-6 sm:p-10">
        <p
          className="text-center text-sm text-[hsl(var(--marketing-navy)/0.45)] uppercase tracking-wider mb-8"
        >
          {t('relatioPositioningMatrix.eyebrow')}
        </p>

        <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
          {columnKeys.map(({ key, tone }) => (
            <div key={key} className="space-y-3">
              <h3
                className={`text-base font-semibold ${
                  tone === 'accent'
                    ? 'text-[hsl(var(--marketing-blue))]'
                    : 'text-[hsl(var(--marketing-navy)/0.55)]'
                }`}
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {t(`relatioPositioningMatrix.columns.${key}.heading`)}
              </h3>
              <ul className="space-y-2">
                {(['p1', 'p2', 'p3'] as const).map((pt) => (
                  <li
                    key={pt}
                    className="text-sm text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed"
                  >
                    {t(`relatioPositioningMatrix.columns.${key}.${pt}`)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p
          className="text-center text-sm text-[hsl(var(--marketing-navy)/0.5)] mt-8 max-w-lg mx-auto leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {t('relatioPositioningMatrix.footnote')}
        </p>

        <div className="text-center mt-6">
          <Link
            to="/integrations"
            className="inline-flex items-center text-sm text-[hsl(var(--marketing-blue))] hover:underline"
          >
            {t('relatioPositioningMatrix.seeIntegrations')} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
