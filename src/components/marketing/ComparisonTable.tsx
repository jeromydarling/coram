import { Check, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ComparisonTable() {
  const { t } = useTranslation('marketing');

  const rows = [
    {
      capability: t('comparisonTable.rows.relationshipMemory.label'),
      crm: t('comparisonTable.rows.relationshipMemory.crm'),
      marketing: t('comparisonTable.rows.relationshipMemory.marketing'),
      cros: t('comparisonTable.rows.relationshipMemory.cros'),
    },
    {
      capability: t('comparisonTable.rows.communityAwareness.label'),
      crm: t('comparisonTable.rows.communityAwareness.crm'),
      marketing: t('comparisonTable.rows.communityAwareness.marketing'),
      cros: t('comparisonTable.rows.communityAwareness.cros'),
    },
    {
      capability: t('comparisonTable.rows.humanContext.label'),
      crm: t('comparisonTable.rows.humanContext.crm'),
      marketing: t('comparisonTable.rows.humanContext.marketing'),
      cros: t('comparisonTable.rows.humanContext.cros'),
    },
    {
      capability: t('comparisonTable.rows.migration.label'),
      crm: t('comparisonTable.rows.migration.crm'),
      marketing: t('comparisonTable.rows.migration.marketing'),
      cros: t('comparisonTable.rows.migration.cros'),
    },
    {
      capability: t('comparisonTable.rows.volunteer.label'),
      crm: t('comparisonTable.rows.volunteer.crm'),
      marketing: t('comparisonTable.rows.volunteer.marketing'),
      cros: t('comparisonTable.rows.volunteer.cros'),
    },
    {
      capability: t('comparisonTable.rows.expansion.label'),
      crm: t('comparisonTable.rows.expansion.crm'),
      marketing: t('comparisonTable.rows.expansion.marketing'),
      cros: t('comparisonTable.rows.expansion.cros'),
    },
    {
      capability: t('comparisonTable.rows.narrativeReporting.label'),
      crm: t('comparisonTable.rows.narrativeReporting.crm'),
      marketing: t('comparisonTable.rows.narrativeReporting.marketing'),
      cros: t('comparisonTable.rows.narrativeReporting.cros'),
    },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px] bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-4 border-b border-[hsl(var(--marketing-border))]">
          <div className="p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
              {t('comparisonTable.capabilityHeader')}
            </span>
          </div>
          {[t('comparisonTable.columns.crm'), t('comparisonTable.columns.marketing'), t('comparisonTable.columns.cros')].map((col, i) => (
            <div
              key={col}
              className={`p-4 sm:p-5 text-center border-l border-[hsl(var(--marketing-border)/0.5)] ${
                i === 2 ? 'bg-[hsl(var(--marketing-blue)/0.04)]' : ''
              }`}
            >
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  i === 2
                    ? 'text-[hsl(var(--marketing-blue))]'
                    : 'text-[hsl(var(--marketing-navy)/0.4)]'
                }`}
              >
                {col}
              </span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={r.capability}
            className={`grid grid-cols-4 ${
              i < rows.length - 1 ? 'border-b border-[hsl(var(--marketing-border)/0.4)]' : ''
            }`}
          >
            <div className="p-4 sm:p-5">
              <span
                className="text-sm font-semibold text-[hsl(var(--marketing-navy))]"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {r.capability}
              </span>
            </div>

            {/* Traditional CRM */}
            <div className="p-4 sm:p-5 border-l border-[hsl(var(--marketing-border)/0.3)] flex items-center gap-2 justify-center">
              <Minus className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.25)] shrink-0" />
              <span className="text-xs text-[hsl(var(--marketing-navy)/0.5)] text-center leading-relaxed">
                {r.crm}
              </span>
            </div>

            {/* Marketing Platform */}
            <div className="p-4 sm:p-5 border-l border-[hsl(var(--marketing-border)/0.3)] flex items-center gap-2 justify-center">
              <Minus className="h-3.5 w-3.5 text-[hsl(var(--marketing-navy)/0.25)] shrink-0" />
              <span className="text-xs text-[hsl(var(--marketing-navy)/0.5)] text-center leading-relaxed">
                {r.marketing}
              </span>
            </div>

            {/* CROS™ */}
            <div className="p-4 sm:p-5 border-l border-[hsl(var(--marketing-border)/0.3)] bg-[hsl(var(--marketing-blue)/0.04)] flex items-center gap-2 justify-center">
              <Check className="h-3.5 w-3.5 text-[hsl(142,71%,45%)] shrink-0" />
              <span className="text-xs text-[hsl(var(--marketing-navy)/0.75)] font-medium text-center leading-relaxed">
                {r.cros}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
