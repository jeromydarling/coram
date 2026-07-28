/**
 * ElementBadge — Periodic-table-style badge for NRI, CROS, Profunda.
 *
 * WHAT: Renders a brand keyword in a compact "element" card with a symbol and subtitle.
 * WHERE: Navigation, feature sections, any marketing reference to the three pillars.
 * WHY: Gives NRI / CROS / PROFUNDA a distinctive, recognisable visual identity.
 */

import { useTranslation } from 'react-i18next';

const elementBase: Record<string, { symbol: string; number: string; subtitleKey: string }> = {
  NRI:      { symbol: 'Nr', number: '01', subtitleKey: 'elementBadge.nriSubtitle' },
  CROS:     { symbol: 'Cr', number: '02', subtitleKey: 'elementBadge.crosSubtitle' },
  Profunda: { symbol: 'Pf', number: '03', subtitleKey: 'elementBadge.profundaSubtitle' },
};

interface ElementBadgeProps {
  name: 'NRI' | 'CROS' | 'Profunda';
  /** 'sm' for nav items, 'md' default, 'lg' for hero cards */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ElementBadge({ name, size = 'md', className = '' }: ElementBadgeProps) {
  const { t } = useTranslation('marketing');
  const elBase = elementBase[name];
  if (!elBase) return <span>{name}</span>;
  const el = { ...elBase, subtitle: t(elBase.subtitleKey) };

  const sizes = {
    sm: 'w-10 h-12 text-[10px]',
    md: 'w-14 h-16 text-xs',
    lg: 'w-20 h-24 text-sm',
  };

  const symbolSizes = {
    sm: 'text-base font-bold',
    md: 'text-xl font-bold',
    lg: 'text-3xl font-bold',
  };

  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-lg border-2 border-[hsl(var(--marketing-navy)/0.15)] bg-white ${sizes[size]} ${className}`}
    >
      <span className="text-[8px] text-[hsl(var(--marketing-navy)/0.35)] leading-none mt-0.5">
        {el.number}
      </span>
      <span className={`${symbolSizes[size]} text-[hsl(var(--marketing-navy))] leading-none`}>
        {el.symbol}
      </span>
      <span className="text-[7px] uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.45)] leading-none mb-0.5">
        {el.subtitle}
      </span>
    </div>
  );
}

/** Inline variant for use in nav links — shows element + full name side by side */
export function ElementNavLabel({ name }: { name: 'NRI' | 'CROS' | 'Profunda' }) {
  const { t } = useTranslation('marketing');
  const elBase = elementBase[name];
  if (!elBase) return <span>{name}</span>;
  const el = { ...elBase, subtitle: t(elBase.subtitleKey) };

  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="inline-flex flex-col items-center justify-center w-8 h-9 rounded border border-[hsl(var(--marketing-navy)/0.15)] bg-[hsl(var(--marketing-surface))]">
        <span className="text-[6px] text-[hsl(var(--marketing-navy)/0.3)] leading-none">{el.number}</span>
        <span className="text-xs font-bold text-[hsl(var(--marketing-navy))] leading-none">{el.symbol}</span>
      </span>
      <span className="flex flex-col">
        <span className="font-semibold text-[hsl(var(--marketing-navy))]">{name}</span>
        <span className="text-[10px] text-[hsl(var(--marketing-navy)/0.45)]">{el.subtitle}</span>
      </span>
    </span>
  );
}
