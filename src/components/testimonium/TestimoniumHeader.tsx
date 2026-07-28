/**
 * TestimoniumHeader — Warm editorial banner for a Testimonium report.
 *
 * WHAT: Displays the report headline, themes, and period.
 * WHERE: Top of TestimoniumReport detail page.
 * WHY: Sets the narrative tone — calm, reflective, human.
 */

import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface TestimoniumHeaderProps {
  headline: string;
  themes: string[];
  periodStart: string;
  periodEnd: string;
  driftSummary?: string | null;
}

export function TestimoniumHeader({
  headline,
  themes,
  periodStart,
  periodEnd,
  driftSummary,
}: TestimoniumHeaderProps) {
  return (
    <div className="space-y-6 pb-6 border-b border-border/40">
      {/* Period label */}
      <p className="text-sm text-muted-foreground tracking-wide uppercase">
        {periodStart} — {periodEnd}
      </p>

      {/* Headline */}
      <h1 className="text-2xl sm:text-3xl font-serif font-medium text-foreground leading-snug max-w-2xl">
        {headline}
      </h1>

      {/* Themes */}
      {themes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {themes.map((theme) => (
            <Badge
              key={theme}
              variant="secondary"
              className="text-xs font-normal px-3 py-1 rounded-full"
            >
              {theme}
            </Badge>
          ))}
        </div>
      )}

      {/* Drift observation */}
      {driftSummary && (
        <div className="flex items-start gap-2 bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground font-serif italic">
          <span className="shrink-0 mt-0.5">↗</span>
          <span>{driftSummary}</span>
        </div>
      )}
    </div>
  );
}
