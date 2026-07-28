/**
 * OperatorEcosystemPage — Ecosystem intelligence overview.
 *
 * WHAT: Shows metros grouped by ecosystem_status (emerging, pipeline, dormant) with aggregated metrics.
 * WHERE: Operator Console → Ecosystem.
 * WHY: Gives the Operator awareness of ecosystem growth patterns without exposing tenant data.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Sprout, TrendingUp, Moon, MapPin } from 'lucide-react';
import { ExpansionWatchlist } from '@/components/operator/ExpansionWatchlist';
import { ExpansionInsightsCard } from '@/components/operator/ExpansionInsightsCard';
import { ActivationMovementCard } from '@/components/operator/ActivationMovementCard';

type EcosystemStatus = 'active' | 'emerging' | 'expansion_pipeline' | 'dormant';

interface MetroRow {
  id: string;
  metro: string;
  ecosystem_status: EcosystemStatus;
  expansion_priority: number;
}

interface MetroMetric {
  metro_id: string;
  tenant_count: number;
  expansion_interest_count: number;
  growth_velocity: number;
  communio_overlap_score: number;
}

const statusConfig: Record<EcosystemStatus, { label: string; icon: React.ElementType; color: string }> = {
  active: { label: 'Active', icon: MapPin, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  emerging: { label: 'Emerging', icon: Sprout, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  expansion_pipeline: { label: 'Expansion Pipeline', icon: TrendingUp, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  dormant: { label: 'Dormant', icon: Moon, color: 'bg-muted text-muted-foreground' },
};

export default function OperatorEcosystemPage() {
  const { data: metros, isLoading: metrosLoading } = useQuery({
    queryKey: ['operator-ecosystem-metros'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metros')
        .select('id, metro, ecosystem_status, expansion_priority')
        .order('expansion_priority', { ascending: false });
      if (error) throw error;
      return (data || []) as MetroRow[];
    },
  });

  const { data: metrics } = useQuery({
    queryKey: ['operator-metro-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_metro_metrics')
        .select('*');
      if (error) throw error;
      return (data || []) as MetroMetric[];
    },
  });

  const metricsMap = new Map((metrics || []).map(m => [m.metro_id, m]));

  const grouped: Record<EcosystemStatus, (MetroRow & { metric?: MetroMetric })[]> = {
    emerging: [],
    expansion_pipeline: [],
    dormant: [],
    active: [],
  };

  for (const m of metros || []) {
    const status = m.ecosystem_status as EcosystemStatus;
    if (!grouped[status]) grouped[status] = [];
    grouped[status].push({ ...m, metric: metricsMap.get(m.id) });
  }

  if (metrosLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const displayOrder: EcosystemStatus[] = ['emerging', 'expansion_pipeline', 'dormant', 'active'];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">Ecosystem Intelligence</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Aggregated metro-level ecosystem health.<br />
                <strong>Where:</strong> metros + operator_metro_metrics tables.<br />
                <strong>Why:</strong> See growth patterns and identify expansion opportunities without exposing tenant data.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {displayOrder.map(status => {
          const cfg = statusConfig[status];
          const Icon = cfg.icon;
          return (
            <Card key={status} className="rounded-xl">
              <CardContent className="p-3 text-center space-y-1">
                <Icon className="h-4 w-4 mx-auto text-primary" />
                <p className="text-xl font-bold text-foreground">{grouped[status]?.length || 0}</p>
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sections for each status */}
      {displayOrder.map(status => {
        const items = grouped[status] || [];
        if (items.length === 0) return null;
        const cfg = statusConfig[status];
        const Icon = cfg.icon;

        return (
          <Card key={status} className="rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {cfg.label} Metros
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {items.map(m => (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.metro}</p>
                      {m.expansion_priority > 0 && (
                        <p className="text-xs text-muted-foreground">Priority: {m.expansion_priority}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                      {m.metric && (
                        <>
                          <span>{m.metric.tenant_count} tenants</span>
                          <span>velocity: {Number(m.metric.growth_velocity).toFixed(1)}</span>
                          {m.metric.expansion_interest_count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {m.metric.expansion_interest_count} interested
                            </Badge>
                          )}
                        </>
                      )}
                      <Badge className={cfg.color}>{cfg.label}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Expansion Insights */}
      <ExpansionInsightsCard />

      {/* Activation Movement */}
      <ActivationMovementCard />

      {/* Expansion Watchlist */}
      <ExpansionWatchlist />
    </div>
  );
}
