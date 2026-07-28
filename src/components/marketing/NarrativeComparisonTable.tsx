/**
 * NarrativeComparisonTable — Calm comparison table for archetype comparison pages.
 *
 * WHAT: Side-by-side table comparing traditional approach vs CROS for each dimension.
 * WHERE: /compare/:slug pages.
 * WHY: SEO-rich structured comparison without aggressive competitor bashing.
 */

import { useTranslation } from 'react-i18next';

interface ComparisonRow {
  dimension: string;
  traditional: string;
  cros: string;
}

interface NarrativeComparisonTableProps {
  rows: ComparisonRow[];
}

export default function NarrativeComparisonTable({ rows }: NarrativeComparisonTableProps) {
  const { t } = useTranslation('marketing');
  return (
    <div className="rounded-2xl border border-[hsl(var(--marketing-border))] overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-3 bg-[hsl(var(--marketing-surface))] border-b border-[hsl(var(--marketing-border))]">
        <div className="px-4 sm:px-5 py-3">
          <span className="text-xs font-semibold text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider">
            {t('narrativeComparisonTable.dimensionHeader')}
          </span>
        </div>
        <div className="px-4 sm:px-5 py-3 border-l border-[hsl(var(--marketing-border))]">
          <span className="text-xs font-semibold text-[hsl(var(--marketing-navy)/0.4)] uppercase tracking-wider">
            {t('narrativeComparisonTable.traditionalHeader')}
          </span>
        </div>
        <div className="px-4 sm:px-5 py-3 border-l border-[hsl(var(--marketing-border))]">
          <span className="text-xs font-semibold text-[hsl(var(--marketing-blue))] uppercase tracking-wider">
            {t('narrativeComparisonTable.crosHeader')}
          </span>
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-3 border-b border-[hsl(var(--marketing-border))] last:border-b-0"
        >
          <div className="px-4 sm:px-5 py-3.5">
            <span className="text-sm font-medium text-[hsl(var(--marketing-navy))]">
              {row.dimension}
            </span>
          </div>
          <div className="px-4 sm:px-5 py-3.5 border-l border-[hsl(var(--marketing-border))]">
            <span className="text-sm text-[hsl(var(--marketing-navy)/0.5)]">
              {row.traditional}
            </span>
          </div>
          <div className="px-4 sm:px-5 py-3.5 border-l border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-blue)/0.02)]">
            <span className="text-sm text-[hsl(var(--marketing-navy)/0.7)] font-medium">
              {row.cros}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
