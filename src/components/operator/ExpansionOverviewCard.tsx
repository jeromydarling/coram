/**
 * ExpansionOverviewCard — Operator visibility into tenant expansion metrics.
 *
 * WHAT: Shows active metros, expansion plans, addon quantity, readiness distribution.
 * WHERE: Operator Tenant Detail Page.
 * WHY: Operator needs to see expansion posture at a glance.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sprout, Loader2 } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  research: 'Research',
  relationships: 'Relationships',
  pilot: 'Pilot',
  launching: 'Launching',
  active: 'Active',
  paused: 'Paused',
};

const STATUS_COLORS: Record<string, string> = {
  research: 'bg-muted text-muted-foreground',
  relationships: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  pilot: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  launching: 'bg-primary/10 text-primary',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  paused: 'bg-destructive/10 text-destructive',
};

interface Props {
  tenantId: string;
}

export function ExpansionOverviewCard({ tenantId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-expansion-overview', tenantId],
    queryFn: async () => {
      // Expansion plans
      const { data: plans, error: plansErr } = await supabase
        .from('metro_expansion_plans')
        .select('id, status, metro_id')
        .eq('tenant_id', tenantId);
      if (plansErr) throw plansErr;

      // Unique metros from plans
      const metroIds = new Set((plans ?? []).map((p: any) => p.metro_id));

      // Status distribution
      const dist: Record<string, number> = {};
      for (const p of plans ?? []) {
        dist[p.status] = (dist[p.status] || 0) + 1;
      }

      return {
        planCount: (plans ?? []).length,
        activeMetros: metroIds.size,
        statusDistribution: dist,
      };
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sprout className="h-4 w-4" /> Expansion Overview
        </CardTitle>
        <CardDescription>Metro expansion posture for this tenant</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-muted-foreground text-xs">Active Metros</p>
            <p className="text-lg font-semibold text-foreground">{data?.activeMetros ?? 0}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Expansion Plans</p>
            <p className="text-lg font-semibold text-foreground">{data?.planCount ?? 0}</p>
          </div>
        </div>

        {data?.statusDistribution && Object.keys(data.statusDistribution).length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Readiness Distribution</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.statusDistribution).map(([status, count]) => (
                <Badge key={status} className={`text-[10px] ${STATUS_COLORS[status] ?? ''}`}>
                  {STATUS_LABELS[status] ?? status}: {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(!data || data.planCount === 0) && (
          <p className="text-muted-foreground text-xs italic">No expansion plans yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
