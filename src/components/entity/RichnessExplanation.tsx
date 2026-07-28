/**
 * RichnessExplanation — Explains why the current richness view is active.
 *
 * WHAT: Shows effective richness source (tenant default vs entity override) with reset action.
 * WHERE: PersonDetail, OpportunityDetail — Steward/Shepherd only.
 * WHY: Makes richness overrides transparent, reversible, and auditable.
 */

import { useState } from 'react';
import { useEntityRichness } from '@/hooks/useEntityRichness';
import { useRelationalOrientation } from '@/hooks/useRelationalOrientation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Eye, RotateCcw, Loader2 } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/help-tooltip';

interface Props {
  entityType: 'person' | 'partner';
  entityId: string;
}

export function RichnessExplanation({ entityType, entityId }: Props) {
  const { effectiveRichness, hasOverride, setOverride, isSettingOverride, clearOverride, isClearingOverride } = useEntityRichness(entityType, entityId);
  const { orientation, peopleRichness, partnerRichness } = useRelationalOrientation();
  const [open, setOpen] = useState(false);

  const defaultRichness = entityType === 'person' ? peopleRichness : partnerRichness;
  const viewLabel = effectiveRichness >= 3 ? 'Narrative (rich)' : 'Operational (flat)';
  const sourceLabel = hasOverride ? 'Entity override' : 'Tenant default';

  const orientationLabel = orientation === 'human_focused' ? 'Human-Focused'
    : orientation === 'institution_focused' ? 'Institution-Focused'
    : 'Hybrid';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground h-7 px-2">
          <Eye className="w-3.5 h-3.5" />
          View: {viewLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm space-y-3" align="end">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground">View Explanation</p>
          <HelpTooltip
            what="Shows why this entity displays in its current layout mode."
            where="Entity detail page"
            why="Richness overrides should be transparent and reversible."
          />
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Effective richness</span>
            <span className="font-medium">{effectiveRichness}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Source</span>
            <span className="font-medium">{sourceLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tenant orientation</span>
            <span className="font-medium">{orientationLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tenant default</span>
            <span className="font-medium">{defaultRichness}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1 border-t border-border">
          {hasOverride && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1"
              disabled={isClearingOverride}
              onClick={async () => {
                await clearOverride();
                setOpen(false);
              }}
            >
              {isClearingOverride ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Reset to default
            </Button>
          )}
          {effectiveRichness < 3 && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              disabled={isSettingOverride}
              onClick={async () => {
                await setOverride(3);
                setOpen(false);
              }}
            >
              {isSettingOverride && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Switch to narrative
            </Button>
          )}
          {effectiveRichness >= 3 && !hasOverride && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              disabled={isSettingOverride}
              onClick={async () => {
                await setOverride(1);
                setOpen(false);
              }}
            >
              {isSettingOverride && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              Switch to flat
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
