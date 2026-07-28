/**
 * PlatformHealthPanel — Platform-wide revenue and adoption metrics.
 *
 * WHAT: Shows MRR, archetype adoption, addon utilization in simple bars.
 * WHERE: Operator Console dashboard.
 * WHY: Gentle platform health metrics without trend alarms.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, DollarSign, Users, Puzzle, Sparkles } from 'lucide-react';

export function PlatformHealthPanel() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-health-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_tenant_stats')
        .select('monthly_revenue_cents, addon_count, guided_activation_count, expansion_count, archetype');
      if (error) throw error;

      const tenants = data ?? [];
      const totalMRR = tenants.reduce((s, t) => s + (t.monthly_revenue_cents ?? 0), 0);
      const totalAddons = tenants.reduce((s, t) => s + (t.addon_count ?? 0), 0);
      const totalActivation = tenants.filter(t => (t.guided_activation_count ?? 0) > 0).length;
      const totalExpansion = tenants.reduce((s, t) => s + (t.expansion_count ?? 0), 0);

      // Archetype distribution
      const archCounts: Record<string, number> = {};
      for (const t of tenants) {
        const arch = t.archetype ?? 'unknown';
        archCounts[arch] = (archCounts[arch] ?? 0) + 1;
      }
      const archetypes = Object.entries(archCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalMRR,
        totalTenants: tenants.length,
        totalAddons,
        totalActivation,
        totalExpansion,
        archetypes,
      };
    },
  });

  const formatMRR = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-5 w-5 text-primary" />
          Platform Health
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Revenue, adoption, and add-on metrics across all tenants.</p>
                <p><strong>Where:</strong> Aggregated from operator_tenant_stats.</p>
                <p><strong>Why:</strong> A calm view of platform health — no trend alarms.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-4">
              <MetricCard icon={DollarSign} label="Total MRR" value={formatMRR(stats.totalMRR)} />
              <MetricCard icon={Users} label="Active Tenants" value={String(stats.totalTenants)} />
              <MetricCard icon={Puzzle} label="Active Add-ons" value={String(stats.totalAddons)} />
              <MetricCard icon={Sparkles} label="Guided Activations" value={String(stats.totalActivation)} />
            </div>

            {/* Archetype adoption bars */}
            {stats.archetypes.length > 0 && (
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Archetype Adoption</p>
                <div className="space-y-3">
                  {stats.archetypes.map((arch) => {
                    const pct = stats.totalTenants > 0
                      ? Math.round((arch.count / stats.totalTenants) * 100)
                      : 0;
                    return (
                      <div key={arch.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="capitalize text-muted-foreground">{arch.name.replace(/_/g, ' ')}</span>
                          <span className="text-foreground font-medium">{arch.count} ({pct}%)</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
