/**
 * ImpulsusCard — a single scrapbook entry card.
 *
 * WHAT: Renders title, narrative, tags, and timestamp for one Impulsus entry.
 * WHERE: Used inside ImpulsusTimeline.
 * WHY: Provides a warm, paper-like visual for each journal moment.
 */

import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ImpulsusEntry } from '@/hooks/useImpulsusEntries';
import { useTenantPath } from '@/hooks/useTenantPath';

const KIND_EMOJI: Record<string, string> = {
  reflection: '💭',
  email: '✉️',
  campaign: '📣',
  ai_suggestion: '✨',
  event: '📍',
  journey: '🧭',
  task: '✅',
};

interface ImpulsusCardProps {
  entry: ImpulsusEntry;
}

export function ImpulsusCard({ entry }: ImpulsusCardProps) {
  const emoji = KIND_EMOJI[entry.kind] || '📝';
  const relativeTime = formatDistanceToNow(new Date(entry.occurred_at), { addSuffix: true });
  const { tenantPath } = useTenantPath();

  return (
    <div className="bg-accent/10 dark:bg-card/60 border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow break-inside-avoid mb-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{emoji}</span>
          <h3 className="font-medium text-sm truncate">{entry.title}</h3>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
          {relativeTime}
        </span>
      </div>

      {/* Narrative */}
      <p className="text-sm text-muted-foreground font-serif leading-relaxed mb-3">
        {entry.narrative}
      </p>

      {/* Footer: tags + link */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-xs font-normal bg-muted text-muted-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>
        {entry.opportunity_id && (
          <Link
            to={tenantPath(`/opportunities/${entry.opportunity_id}`)}
            className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"
          >
            Open page <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

