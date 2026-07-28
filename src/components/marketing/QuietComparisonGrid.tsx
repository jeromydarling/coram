/**
 * QuietComparisonGrid — Before / With CROS narrative comparison.
 *
 * WHAT: Side-by-side reflective comparison rendered as cards, not an aggressive table.
 * WHERE: /imagine-this page, "A Quiet Comparison" section.
 * WHY: Gently reveals the limits of traditional tools without competitive callouts.
 */
import { useTranslation } from 'react-i18next';
import { quietComparison } from '@/content/imagineThis';

export default function QuietComparisonGrid() {
  const { t } = useTranslation('marketing');
  return (
    <section className="max-w-[900px] mx-auto px-4 sm:px-6 py-16 sm:py-24" data-testid="quiet-comparison">
      <div className="text-center mb-12">
        <h2
          className="text-2xl sm:text-3xl text-[hsl(var(--marketing-navy))] mb-3"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          {quietComparison.heading}
        </h2>
        <p className="text-base text-[hsl(var(--marketing-navy)/0.55)] max-w-lg mx-auto">
          {quietComparison.subtext}
        </p>
      </div>

      {/* Column headers (desktop) */}
      <div className="hidden sm:grid sm:grid-cols-2 gap-6 mb-4 px-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)]">
          {t('quietComparisonGrid.beforeLabel')}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))]">
          {t('quietComparisonGrid.withCrosLabel')}
        </span>
      </div>

      <div className="space-y-4">
        {quietComparison.rows.map((row, i) => (
          <div
            key={i}
            className="grid sm:grid-cols-2 gap-4 sm:gap-6 rounded-2xl border border-[hsl(var(--marketing-border))] overflow-hidden"
          >
            {/* Before */}
            <div className="p-5 sm:p-6 bg-[hsl(var(--marketing-surface))]">
              <span className="sm:hidden text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-2 block">
                {t('quietComparisonGrid.beforeLabel')}
              </span>
              <p
                className="text-sm sm:text-base text-[hsl(var(--marketing-navy)/0.5)] leading-relaxed"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {row.before}
              </p>
            </div>
            {/* With CROS */}
            <div className="p-5 sm:p-6 bg-white">
              <span className="sm:hidden text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-2 block">
                {t('quietComparisonGrid.withCrosLabel')}
              </span>
              <p
                className="text-sm sm:text-base text-[hsl(var(--marketing-navy)/0.75)] leading-relaxed"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {row.withCros}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
