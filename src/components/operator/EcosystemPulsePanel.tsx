/**
 * EcosystemPulsePanel — Ecosystem health for Operator Console.
 *
 * WHAT: Displays aggregated ecosystem activity (reflections, events, communio shares).
 * WHERE: Operator Console → Overview tab.
 * WHY: Shows ecosystem health without querying heavy tables.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Calendar, UsersRound, FileText, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function EcosystemPulsePanel() {
  const { data: rollups, isLoading } = useQuery({
    queryKey: ['ecosystem-health-rollups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecosystem_health_rollups')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  // Aggregate latest week
  const latestWeek = rollups?.[0]?.week_start;
  const thisWeek = rollups?.filter((r) => r.week_start === latestWeek) || [];

  const totals = {
    reflections: thisWeek.reduce((s, r) => s + r.reflections_count, 0),
    events: thisWeek.reduce((s, r) => s + r.events_count, 0),
    communioShares: thisWeek.reduce((s, r) => s + r.communio_shares, 0),
    activeTenants: thisWeek.length,
    testimoniumFlags: thisWeek.reduce(
      (s, r) => s + (Array.isArray(r.testimonium_flags) ? r.testimonium_flags.length : 0),
      0
    ),
  };

  // Archetype breakdown
  const archetypeCounts: Record<string, number> = {};
  for (const r of thisWeek) {
    archetypeCounts[r.archetype] = (archetypeCounts[r.archetype] || 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          Ecosystem Pulse
        </h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Aggregated ecosystem activity across all tenants.<br />
                <strong>Where:</strong> ecosystem_health_rollups (weekly).<br />
                <strong>Why:</strong> See the living pulse of the platform without heavy queries.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <PulseMetric icon={FileText} label="Reflections" value={totals.reflections} />
        <PulseMetric icon={Calendar} label="Events" value={totals.events} />
        <PulseMetric icon={UsersRound} label="Communio Shares" value={totals.communioShares} />
        <PulseMetric icon={Sparkles} label="Narrative Flags" value={totals.testimoniumFlags} />
        <PulseMetric icon={TrendingUp} label="Active Tenants" value={totals.activeTenants} />
      </div>

      {Object.keys(archetypeCounts).length > 0 && (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Participation by Archetype</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {Object.entries(archetypeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([arch, count]) => (
                <span
                  key={arch}
                  className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                >
                  {arch.replace(/_/g, ' ')} · {count}
                </span>
              ))}
          </CardContent>
        </Card>
      )}

      {latestWeek && (
        <p className="text-xs text-muted-foreground">
          Week of {latestWeek}
        </p>
      )}
    </div>
  );
}

function PulseMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-3 text-center space-y-1">
        <Icon className="h-4 w-4 mx-auto text-primary" />
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
