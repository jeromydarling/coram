/**
 * ColdStartNRIHint — Gentle prompt shown when NRI has too little context to narrate.
 *
 * WHAT: Replaces an empty AI narrative panel with a one-line invitation
 *       ("Add a Person to begin") when the tenant has fewer than ~5 entities.
 * WHERE: Wrap any AI-narrative surface; render this instead of the empty engine output.
 * WHY: Wave 4 — Scenario 8. NRI must never display blank space that looks broken.
 */
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenantNavigate, useTenantPath } from '@/hooks/useTenantPath';

interface Props {
  entityCount: number;
  threshold?: number;
  /** Override the default suggestion ("Add a Person to begin"). */
  ctaLabel?: string;
  /** Tenant-relative path the CTA navigates to. */
  ctaPath?: string;
  message?: string;
}

export function ColdStartNRIHint({
  entityCount,
  threshold = 5,
  ctaLabel = 'Add your first Person',
  ctaPath = '/people',
  message,
}: Props) {
  const navigate = useTenantNavigate();
  const { slug } = useTenantPath();

  if (entityCount >= threshold) return null;

  const remaining = Math.max(0, threshold - entityCount);
  const defaultMsg =
    entityCount === 0
      ? 'Narrative intelligence listens to your relationships. Add a Person to begin.'
      : `A few more relationships and the narrative will start to take shape — about ${remaining} more.`;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3">
      <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm text-foreground">{message ?? defaultMsg}</p>
        {entityCount === 0 && slug && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => navigate(ctaPath)}
          >
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
