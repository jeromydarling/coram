/**
 * CommunioNetworkTrends — "Network Trends" tab for Communio.
 *
 * WHAT: Displays anonymized convergence patterns across Communio groups.
 * WHERE: Communio page → "Network Trends" tab.
 * WHY: Helps organizations sense shared narrative momentum without exposing CRM data.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, RefreshCw, Sprout } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface Props {
  groupIds: string[];
}

export function CommunioNetworkTrends({ groupIds }: Props) {
  const { data: trends, isLoading } = useQuery({
    queryKey: ['communio-trend-rollups', groupIds],
    queryFn: async () => {
      if (!groupIds.length) return [];
      const { data, error } = await supabase
        .from('communio_trend_rollups')
        .select('*')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: groupIds.length > 0,
  });

  // Also pull latest signal metrics for richer display
  const { data: metrics } = useQuery({
    queryKey: ['communio-signal-metrics-trends', groupIds],
    queryFn: async () => {
      if (!groupIds.length) return [];
      const { data, error } = await supabase
        .from('communio_signal_metrics')
        .select('*')
        .in('group_id', groupIds)
        .order('week_start', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: groupIds.length > 0,
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  // Aggregate by signal type
  const typeCounts: Record<string, number> = {};
  for (const t of trends || []) {
    typeCounts[t.signal_type] = (typeCounts[t.signal_type] || 0) + t.weekly_count;
  }

  // Get week-over-week from metrics
  const latestWeek = metrics?.[0]?.week_start;
  const prevWeeks = metrics?.filter((m) => m.week_start !== latestWeek) || [];
  const thisWeekMetrics = metrics?.filter((m) => m.week_start === latestWeek) || [];

  const thisWeekTotal = thisWeekMetrics.reduce(
    (s, m) => s + m.momentum_count + m.drift_count + m.reconnection_count + m.growth_count,
    0
  );
  const prevWeekTotal = prevWeeks
    .slice(0, thisWeekMetrics.length)
    .reduce((s, m) => s + m.momentum_count + m.drift_count + m.reconnection_count + m.growth_count, 0);

  const trendDirection = thisWeekTotal >= prevWeekTotal ? 'up' : 'down';

  const hasData = (trends && trends.length > 0) || thisWeekTotal > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold font-serif text-foreground">Network Trends</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Convergence patterns across your Communio groups.<br />
                <strong>Where:</strong> Aggregated from anonymized trend rollups.<br />
                <strong>Why:</strong> Communities are noticing shared rhythms — this view reflects that awareness.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!hasData ? (
        <Card className="rounded-xl">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground font-serif leading-relaxed max-w-md mx-auto">
              Network trends haven't emerged yet. As your groups share more narrative
              signals over time, convergence patterns will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Overall direction */}
          <Card className="rounded-xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {trendDirection === 'up' ? (
                  <TrendingUp className="h-6 w-6 text-primary" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-serif text-foreground">
                  {trendDirection === 'up'
                    ? 'Communities are noticing shared momentum this week.'
                    : 'The network is quieter this week — a natural rhythm.'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {thisWeekTotal} signals this week
                  {prevWeekTotal > 0 && ` · ${prevWeekTotal} last week`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Signal type breakdown */}
          {Object.keys(typeCounts).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([type, count]) => (
                  <Card key={type} className="rounded-xl">
                    <CardContent className="p-4 text-center space-y-1">
                      <Sprout className="h-4 w-4 mx-auto text-primary" />
                      <p className="text-lg font-bold text-foreground">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {type.replace(/_/g, ' ')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
