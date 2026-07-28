/**
 * TestimoniumChapter — A single narrative chapter card.
 *
 * WHAT: Renders a chapter title, summary, and signal indicators.
 * WHERE: TestimoniumReport detail page, stacked vertically.
 * WHY: Calm editorial storytelling — no charts, no dashboards.
 */

import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface TestimoniumChapterProps {
  title: string;
  summary: string;
  signals: string[];
  index: number;
}

export function TestimoniumChapter({
  title,
  summary,
  signals,
  index,
}: TestimoniumChapterProps) {
  return (
    <div className="space-y-3">
      {/* Chapter number + title */}
      <div className="flex items-baseline gap-3">
        <span className="text-xs text-muted-foreground font-mono">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="text-lg font-serif font-medium text-foreground">
          {title}
        </h2>
      </div>

      {/* Summary prose */}
      <p className="text-muted-foreground font-serif leading-relaxed pl-9">
        {summary}
      </p>

      {/* Signal indicators */}
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-9">
          {signals.map((signal, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-xs font-normal"
            >
              {signal}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
