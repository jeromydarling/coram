import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fields = [
  { key: 'crmCost', label: 'CRM' },
  { key: 'emailToolCost', label: 'Email marketing' },
  { key: 'volunteerToolCost', label: 'Volunteer tools' },
  { key: 'projectToolCost', label: 'Project management' },
  { key: 'automationToolCost', label: 'Automation / integrations' },
  { key: 'otherCost', label: 'Other tools' },
] as const;

type CostKey = typeof fields[number]['key'];

export default function CostSavingsCalculator() {
  const [costs, setCosts] = useState<Record<CostKey, number>>({
    crmCost: 0,
    emailToolCost: 0,
    volunteerToolCost: 0,
    projectToolCost: 0,
    automationToolCost: 0,
    otherCost: 0,
  });

  const total = useMemo(() => Object.values(costs).reduce((s, v) => s + v, 0), [costs]);
  const minSavings = Math.round(total * 0.3);
  const maxSavings = Math.round(total * 0.6);

  const update = (key: CostKey, raw: string) => {
    const v = parseInt(raw, 10);
    setCosts(prev => ({ ...prev, [key]: isNaN(v) || v < 0 ? 0 : v }));
  };

  return (
    <section id="savings-calculator" className="mt-20 scroll-mt-24">
      <div className="max-w-2xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] text-center mb-2"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          What Are You Paying Now?
        </h2>
        <p className="text-center text-sm text-[hsl(var(--marketing-navy)/0.5)] mb-8 max-w-lg mx-auto">
          Estimate your current stack — then see how simplifying your tools could reduce complexity.
        </p>

        <div className="bg-[hsl(var(--marketing-surface))] rounded-2xl border border-[hsl(var(--marketing-border))] p-6 sm:p-8">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 mb-8">
            {fields.map(f => (
              <div key={f.key}>
                <Label
                  htmlFor={f.key}
                  className="text-xs text-[hsl(var(--marketing-navy)/0.6)] mb-1 block"
                >
                  {f.label}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--marketing-navy)/0.35)]">$</span>
                  <Input
                    id={f.key}
                    type="number"
                    min={0}
                    placeholder="0"
                    className="pl-7 bg-white border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-navy))]"
                    value={costs[f.key] || ''}
                    onChange={e => update(f.key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Results */}
          <div className="border-t border-[hsl(var(--marketing-border))] pt-6">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm text-[hsl(var(--marketing-navy)/0.6)]">Your estimated monthly stack cost</span>
              <span className="text-2xl font-bold text-[hsl(var(--marketing-navy))]">
                ${total.toLocaleString()}<span className="text-sm font-normal text-[hsl(var(--marketing-navy)/0.4)]">/mo</span>
              </span>
            </div>

            {total > 0 && (
              <div className="mt-4 bg-white rounded-xl border border-[hsl(var(--marketing-border)/0.5)] p-4">
                <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] mb-2">
                  Estimated simplification range
                </p>
                <p className="text-lg font-bold text-[hsl(var(--marketing-blue))]">
                  ${minSavings.toLocaleString()} – ${maxSavings.toLocaleString()}
                  <span className="text-xs font-normal text-[hsl(var(--marketing-navy)/0.4)]"> potential savings/mo</span>
                </p>
                <p
                  className="text-xs text-[hsl(var(--marketing-navy)/0.45)] mt-3 leading-relaxed italic"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                  Many organizations reduce overlapping software costs by 30–60% when moving to a unified relationship platform. Your actual results will vary — but the real gain is clarity.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
