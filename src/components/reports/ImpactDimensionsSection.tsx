/**
 * ImpactDimensionsSection — Aggregated impact metrics for reports.
 *
 * WHAT: Shows top 6 active dimensions with aggregated totals.
 * WHERE: Reports page, Impact View tab.
 * WHY: Human-readable impact summary from tenant-defined structured metrics.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Loader2, Ruler } from 'lucide-react';
import { useAggregatedImpact } from '@/hooks/useImpactDimensions';
import { narrativePhrase } from '@/lib/impactNarrative';

export function ImpactDimensionsSection() {
  const { data: aggregated = [], isLoading } = useAggregatedImpact();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary" />
          Impact Dimensions
          <HelpTooltip
            what="Aggregated totals from your custom impact metrics."
            where="Reports > Impact"
            why="Shows the cumulative effect of your work across all recorded activities."
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : aggregated.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 italic text-center py-4">
            No impact recorded yet. Values will appear as you capture them on events, activities, and provisions.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {aggregated.map(dim => (
              <div key={dim.dimension_id} className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-xl font-bold">{dim.total.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground">{dim.label}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
