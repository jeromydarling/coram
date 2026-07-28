import { Check, X } from 'lucide-react';

const rows = [
  { feature: 'Relationships', old: 'Scattered across CRM + notes', cros: 'Unified relationship memory' },
  { feature: 'Outreach', old: 'Email tools + spreadsheets', cros: 'Integrated outreach history' },
  { feature: 'Volunteers', old: 'Separate scheduling platform', cros: 'Voluntārium built-in' },
  { feature: 'Narrative Reporting', old: 'Manual reports', cros: 'Testimonium witness layer' },
  { feature: 'Community Signals', old: 'Not available', cros: 'Signum + Local Pulse' },
  { feature: 'Integrations', old: 'Zapier or manual work', cros: 'Relatio™ — HubSpot, Salesforce & Dynamics 365 two-way sync' },
  { feature: 'Cost Structure', old: 'Multiple subscriptions', cros: 'One relationship operating system' },
];

export default function PricingComparisonTable() {
  return (
    <section id="stack-comparison" className="mt-20 scroll-mt-24">
      <h2
        className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-10"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        Old Stack vs CROS™
      </h2>

      <div className="overflow-x-auto max-w-4xl mx-auto">
        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 border-b border-[hsl(var(--marketing-border))]">
            <div className="p-4 sm:p-5">
              <span
                className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]"
              >
                Feature
              </span>
            </div>
            <div className="p-4 sm:p-5 text-center border-l border-[hsl(var(--marketing-border)/0.5)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.4)]">
                Old Stack
              </span>
            </div>
            <div className="p-4 sm:p-5 text-center border-l border-[hsl(var(--marketing-border)/0.5)]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))]">
                CROS™
              </span>
            </div>
          </div>

          {/* Rows */}
          {rows.map((r, i) => (
            <div
              key={r.feature}
              className={`grid grid-cols-3 ${
                i < rows.length - 1 ? 'border-b border-[hsl(var(--marketing-border)/0.4)]' : ''
              }`}
            >
              <div className="p-4 sm:p-5">
                <span
                  className="text-sm font-semibold text-[hsl(var(--marketing-navy))]"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  {r.feature}
                </span>
              </div>
              <div className="p-4 sm:p-5 border-l border-[hsl(var(--marketing-border)/0.3)] flex items-center justify-center">
                <span className="text-xs text-[hsl(var(--marketing-navy)/0.5)] text-center leading-relaxed">
                  {r.old}
                </span>
              </div>
              <div className="p-4 sm:p-5 border-l border-[hsl(var(--marketing-border)/0.3)] flex items-center justify-center">
                <span className="text-xs text-[hsl(var(--marketing-navy)/0.75)] font-medium text-center leading-relaxed">
                  {r.cros}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
