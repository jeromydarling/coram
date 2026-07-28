/**
 * RichnessSuggestionBanner — Gentle suggestion to enable richer view for a person.
 *
 * WHAT: Shows a calm banner when a person crosses engagement thresholds in institution-focused tenants.
 * WHERE: PersonDetail page (inside EntityDetailLayout).
 * WHY: Adaptive richness — relationships that grow deserve richer narrative tools, without forcing it.
 */

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRichnessEligibility } from '@/hooks/useRichnessEligibility';
import { useEntityRichness } from '@/hooks/useEntityRichness';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface Props {
  personId: string;
  personName?: string;
}

export function RichnessSuggestionBanner({ personId, personName }: Props) {
  const { data: eligibility } = useRichnessEligibility(personId);
  const { effectiveRichness, setOverride, isSettingOverride } = useEntityRichness('person', personId);

  // Don't show if already rich, not eligible, or no data yet
  if (!eligibility?.eligible || effectiveRichness >= 3) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3 mb-4">
      <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          This relationship has grown
          <HelpTooltip
            what="When a person accumulates many visits or life events, a richer narrative view becomes available."
            where="Person detail page"
            why="Adaptive richness ensures lightweight defaults while honoring deepened relationships."
          />
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {eligibility.reason}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        disabled={isSettingOverride}
        onClick={() => setOverride(3)}
      >
        Enable richer view
      </Button>
    </div>
  );
}
