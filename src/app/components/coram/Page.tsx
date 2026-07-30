/**
 * The furniture every screen shares, so no screen invents its own again.
 *
 * The previous version of this app had each module hand-rolling `rounded border
 * p-4` and the result was eleven slightly different greys. A page here declares
 * what it is — module, title, one sentence — and gets the same header, the same
 * rule in the module's colour, and the same spacing as every other page.
 */

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { toneVar, type ModuleDef } from '@/lib/modules';

export function PageHeader({
  module,
  title,
  description,
  actions,
}: {
  module?: ModuleDef;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8" style={module ? toneVar(module.tone) : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {module && (
            <p className="eyebrow mb-1.5">
              {module.latin} · §{module.section}
            </p>
          )}
          <h1 className="text-3xl leading-none sm:text-4xl">{title}</h1>
          {description && (
            <p className="mt-3 max-w-[46ch] text-[0.95rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {/* The site's section rule: the module's colour, fading right. */}
      <div className="tone-rule mt-6 h-px w-full" />
    </header>
  );
}

/** A titled block within a page. Sections stack; they do not nest. */
export function Section({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title?: string;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mb-10', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            {title && <h2 className="text-lg">{title}</h2>}
            {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * A figure, as on the marketing site: large serif numeral in the tone, small
 * spaced label beneath. Used wherever a screen leads with a number.
 */
export function Figure({
  value,
  label,
  note,
  className,
}: {
  value: ReactNode;
  label: string;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('paper px-5 py-4', className)}>
      <div className="figure">{value}</div>
      <div className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </div>
      {note && <div className="mt-1.5 text-sm text-muted-foreground">{note}</div>}
    </div>
  );
}

/**
 * A key/value pair. Definition lists are the honest markup for "this record
 * says X about Y" and they read correctly to a screen reader, which a grid of
 * divs does not.
 */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{children}</dl>;
}

export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {term}
      </dt>
      <dd className="mt-0.5 break-words text-[0.95rem]">{children}</dd>
    </div>
  );
}

/**
 * A note about how the product behaves, rendered where the behaviour happens.
 *
 * Coram's guarantees are only worth something if a person meets them at the
 * moment they matter — "we redact before the model sees this" belongs above the
 * drafting box, not in a policy page nobody opens.
 */
export function Guarantee({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-tone/60 py-1 pl-4 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
