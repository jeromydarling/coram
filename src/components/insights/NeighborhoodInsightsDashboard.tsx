import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, AlertTriangle } from 'lucide-react';
import { useRecentNeighborhoodInsights } from '@/hooks/useNeighborhoodInsights';
import { useUsageByWorkflow } from '@/hooks/useUsageData';
import { formatDistanceToNow, isPast } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export function NeighborhoodInsightsDashboard() {
  const { data: recent, isLoading } = useRecentNeighborhoodInsights(10);
  const { data: usage } = useUsageByWorkflow(7);

  const insightsUsage = usage?.find(u => u.workflow_key === 'neighborhood_insights');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Neighborhood Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const staleCount = (recent || []).filter(r => isPast(new Date(r.fresh_until))).length;
  const freshCount = (recent || []).length - staleCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Neighborhood Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold text-foreground">{recent?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Generated</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-success/10">
            <div className="text-lg font-bold text-success">{freshCount}</div>
            <div className="text-xs text-muted-foreground">Fresh</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-warning/10">
            <div className="text-lg font-bold text-warning">{staleCount}</div>
            <div className="text-xs text-muted-foreground">Stale</div>
          </div>
        </div>

        {/* Usage (last 7d) */}
        {insightsUsage && (
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Usage (7d)</span>
            <span>{insightsUsage.event_count} events • {insightsUsage.total_quantity} units</span>
          </div>
        )}

        {/* Recent activity */}
        {recent && recent.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Recent</h4>
            {recent.slice(0, 5).map(r => {
              const isStale = isPast(new Date(r.fresh_until));
              return (
                <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    {isStale ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-success shrink-0" />
                    )}
                    <span className="truncate">{r.location_key}</span>
                  </div>
                  <Badge variant={isStale ? 'destructive' : 'secondary'} className="text-xs shrink-0">
                    {formatDistanceToNow(new Date(r.generated_at))} ago
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No insights generated yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
