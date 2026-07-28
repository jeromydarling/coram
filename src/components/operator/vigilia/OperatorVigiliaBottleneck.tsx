/**
 * OperatorVigiliaBottleneck — Aggregated Vigilia pattern feed for operators.
 *
 * WHAT: Shows signal patterns across tenants — never individual user data.
 * WHERE: /operator/nexus/friction (Signum page)
 * WHY: Operators see bottlenecks, not people. Calm Mode narrative language.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calmVariant } from '@/lib/calmMode';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const SIGNAL_LABELS: Record<string, string> = {
  visit_without_followup: 'Visits logged without follow-up reflections',
  partner_silence_gap: 'Partners that may benefit from reconnection',
  activity_dropoff: 'Communities with quieter activity recently',
  volunteer_gap: 'Volunteer engagement gaps noticed',
  reflection_without_action: 'Reflections added without next steps',
  event_followup_missing: 'Attended events without capture',
  friction_idle_detected: 'Idle moments on key pages',
  narrative_surge_detected: 'Narrative momentum building',
};

const TREND_ICONS: Record<string, React.ElementType> = {
  rising: TrendingUp,
  falling: TrendingDown,
  stable: Minus,
};

interface SummaryRow {
  tenant_id: string;
  signal_type: string;
  count_last_7d: number;
  count_last_30d: number;
  trend_direction: string;
}

export function OperatorVigiliaBottleneck() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-vigilia-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_vigilia_summary')
        .select('*');
      if (error) throw error;

      // Aggregate across tenants by signal_type
      const byType: Record<string, { count_7d: number; count_30d: number; tenants: number; trend: string }> = {};
      for (const row of (data as SummaryRow[]) ?? []) {
        if (!byType[row.signal_type]) {
          byType[row.signal_type] = { count_7d: 0, count_30d: 0, tenants: 0, trend: 'stable' };
        }
        byType[row.signal_type].count_7d += row.count_last_7d;
        byType[row.signal_type].count_30d += row.count_last_30d;
        byType[row.signal_type].tenants += 1;
        if (row.trend_direction === 'rising') byType[row.signal_type].trend = 'rising';
      }

      return Object.entries(byType)
        .sort(([, a], [, b]) => b.count_7d - a.count_7d)
        .map(([type, data]) => ({ type, ...data }));
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary/60" />
          <CardTitle className="text-base font-serif">Vigilia Patterns</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> Aggregated companion signal patterns across all tenants.</p>
                <p><strong>Where:</strong> vigilia_signals aggregation view.</p>
                <p><strong>Why:</strong> See where communities may need gentle guidance — never individual data.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Where the ecosystem may benefit from gentle attention</CardDescription>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) ? (
          <p className="text-sm text-muted-foreground italic">
            No companion patterns observed yet — everything is flowing calmly.
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((row) => {
              const TrendIcon = TREND_ICONS[row.trend] ?? Minus;
              return (
                <div key={row.type} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {SIGNAL_LABELS[row.type] ?? row.type}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.count_7d} this week across {row.tenants} {row.tenants === 1 ? 'community' : 'communities'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TrendIcon className={`w-3.5 h-3.5 ${row.trend === 'rising' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    <Badge variant={calmVariant(row.trend === 'rising' ? 'warning' : 'ok')} className="text-xs">
                      {row.trend}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
