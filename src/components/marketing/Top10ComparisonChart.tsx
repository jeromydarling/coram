import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/* ── Platform column definitions ── */
const platforms = [
  'CROS™',
  'HubSpot',
  'Salesforce',
  'Bloomerang',
  'Blackbaud (Raiser\'s Edge)',
  'Neon CRM',
  'DonorPerfect',
  'Kindful',
  'NationBuilder',
  'Zoho CRM',
  'Pipedrive',
] as const;

type Val = 'yes' | 'dot' | '';

interface Row {
  capability: string;
  values: Record<string, Val>;
}

/* Helper — builds a row with defaults then overrides */
function row(capability: string, overrides: Partial<Record<string, Val>>, fallback: Val = ''): Row {
  const values: Record<string, Val> = {};
  for (const p of platforms) values[p] = fallback;
  for (const [k, v] of Object.entries(overrides)) values[k] = v;
  return { capability, values };
}

const y: Val = 'yes';
const d: Val = 'dot';

/* ── CONVERGE row keys (baseline CRM) ── */
const convergeRowKeys = ['orgsAccounts', 'peopleContacts', 'activitiesNotes', 'tasks', 'emailLogging', 'importExport'] as const;
const convergeRowOverrides: Record<string, Partial<Record<string, Val>>> = {
  orgsAccounts: { HubSpot: y, Salesforce: y, Bloomerang: y, "Blackbaud (Raiser's Edge)": y, 'Neon CRM': y, DonorPerfect: y, Kindful: y, NationBuilder: y, 'Zoho CRM': y, Pipedrive: y, 'CROS™': y },
  peopleContacts: { HubSpot: y, Salesforce: y, Bloomerang: y, "Blackbaud (Raiser's Edge)": y, 'Neon CRM': y, DonorPerfect: y, Kindful: y, NationBuilder: y, 'Zoho CRM': y, Pipedrive: y, 'CROS™': y },
  activitiesNotes: { HubSpot: y, Salesforce: y, Bloomerang: y, "Blackbaud (Raiser's Edge)": y, 'Neon CRM': y, DonorPerfect: y, Kindful: y, NationBuilder: y, 'Zoho CRM': y, Pipedrive: y, 'CROS™': y },
  tasks: { HubSpot: y, Salesforce: y, Bloomerang: d, "Blackbaud (Raiser's Edge)": y, 'Neon CRM': d, DonorPerfect: d, Kindful: d, NationBuilder: d, 'Zoho CRM': y, Pipedrive: y, 'CROS™': y },
  emailLogging: { HubSpot: y, Salesforce: y, Bloomerang: d, "Blackbaud (Raiser's Edge)": d, 'Neon CRM': d, DonorPerfect: d, Kindful: d, NationBuilder: d, 'Zoho CRM': d, Pipedrive: d, 'CROS™': y },
  importExport: { HubSpot: y, Salesforce: y, Bloomerang: y, "Blackbaud (Raiser's Edge)": y, 'Neon CRM': y, DonorPerfect: y, Kindful: d, NationBuilder: d, 'Zoho CRM': y, Pipedrive: y, 'CROS™': y },
};

/* ── DIVERGE row keys (human + narrative) ── */
const divergeRowKeys = ['relationshipMemory', 'impulsus', 'signum', 'nriSignals', 'testimonium', 'migrationHarness', 'communio'] as const;
const divergeRowOverrides: Record<string, Partial<Record<string, Val>>> = {
  relationshipMemory: { 'CROS™': y },
  impulsus: { 'CROS™': y },
  signum: { 'CROS™': y },
  nriSignals: { 'CROS™': y },
  testimonium: { 'CROS™': y },
  migrationHarness: { 'CROS™': y },
  communio: { 'CROS™': y },
};

function CellContent({ val }: { val: Val }) {
  if (val === 'yes') return <Check className="h-4 w-4 text-[hsl(142,71%,45%)] mx-auto" />;
  if (val === 'dot') return <span className="block w-2 h-2 rounded-full bg-[hsl(var(--marketing-navy)/0.2)] mx-auto" />;
  return null;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={platforms.length + 1}
        className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.5)] bg-[hsl(var(--marketing-surface))] border-b border-[hsl(var(--marketing-border)/0.5)]"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {label}
      </td>
    </tr>
  );
}

export default function Top10ComparisonChart() {
  const { t } = useTranslation('marketing');
  const scrollTo = () => {
    const el = document.getElementById('diverge-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const convergeRows: Row[] = convergeRowKeys.map((key) =>
    row(t(`top10ComparisonChart.rows.${key}`), convergeRowOverrides[key] ?? {})
  );
  const divergeRows: Row[] = divergeRowKeys.map((key) =>
    row(t(`top10ComparisonChart.rows.${key}`), divergeRowOverrides[key] ?? {})
  );

  return (
    <div>
      {/* Jump link */}
      <div className="flex justify-end mb-3">
        <button
          onClick={scrollTo}
          className="text-xs text-[hsl(var(--marketing-blue))] hover:underline font-medium"
        >
          {t('top10ComparisonChart.jumpLink')}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[hsl(var(--marketing-border))] bg-white">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 960 }}>
          <thead>
            <tr className="border-b border-[hsl(var(--marketing-border))]">
              <th className="sticky left-0 z-10 bg-[hsl(var(--marketing-surface))] text-left px-4 py-3 font-semibold text-[hsl(var(--marketing-navy)/0.5)] uppercase tracking-wider min-w-[180px]">
                {t('top10ComparisonChart.capabilityHeader')}
              </th>
              {platforms.map((p) => (
                <th
                  key={p}
                  className={`px-3 py-3 text-center font-semibold uppercase tracking-wider min-w-[80px] ${
                    p === 'CROS™'
                      ? 'bg-[hsl(var(--marketing-blue)/0.06)] text-[hsl(var(--marketing-blue))]'
                      : 'text-[hsl(var(--marketing-navy)/0.45)]'
                  }`}
                >
                  <span className="block leading-tight">{p}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <SectionHeader label={t('top10ComparisonChart.convergeHeader')} />
            {convergeRows.map((r, i) => (
              <tr
                key={r.capability}
                className={i < convergeRows.length - 1 ? 'border-b border-[hsl(var(--marketing-border)/0.3)]' : 'border-b border-[hsl(var(--marketing-border)/0.5)]'}
              >
                <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-[hsl(var(--marketing-navy))]">
                  {r.capability}
                </td>
                {platforms.map((p) => (
                  <td
                    key={p}
                    className={`px-3 py-3 text-center ${p === 'CROS™' ? 'bg-[hsl(var(--marketing-blue)/0.04)]' : ''}`}
                  >
                    <CellContent val={r.values[p]} />
                  </td>
                ))}
              </tr>
            ))}

            <SectionHeader label={t('top10ComparisonChart.divergeHeader')} />
            <tr id="diverge-section" className="h-0" />
            {divergeRows.map((r, i) => (
              <tr
                key={r.capability}
                className={i < divergeRows.length - 1 ? 'border-b border-[hsl(var(--marketing-border)/0.3)]' : ''}
              >
                <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-[hsl(var(--marketing-navy))]">
                  {r.capability}
                </td>
                {platforms.map((p) => (
                  <td
                    key={p}
                    className={`px-3 py-3 text-center ${p === 'CROS™' ? 'bg-[hsl(var(--marketing-blue)/0.04)]' : ''}`}
                  >
                    <CellContent val={r.values[p]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footnote */}
      <p className="mt-4 text-[10px] text-[hsl(var(--marketing-navy)/0.4)] text-center leading-relaxed max-w-2xl mx-auto">
        <span className="inline-block w-2 h-2 rounded-full bg-[hsl(var(--marketing-navy)/0.2)] align-middle mr-1" />
        {t('top10ComparisonChart.footnote')}
      </p>
    </div>
  );
}
