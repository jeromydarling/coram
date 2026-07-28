/**
 * CommunioNarrativePulse — Shared Pulse view for Communio groups.
 *
 * WHAT: Weekly anonymized narrative pulse metrics for groups the tenant belongs to.
 * WHERE: "Shared Pulse" tab on the Communio page.
 * WHY: Lets organizations sense shared momentum without exposing private CRM data.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, RefreshCw, HeartHandshake, Sprout, Calendar } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface Props {
  groupIds: string[];
}

export function CommunioNarrativePulse({ groupIds }: Props) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['communio-signal-metrics', groupIds],
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

  // Aggregate latest week across all groups
  const latestWeek = metrics?.[0]?.week_start;
  const thisWeek = metrics?.filter((m) => m.week_start === latestWeek) || [];

  const totals = {
    momentum: thisWeek.reduce((s, m) => s + m.momentum_count, 0),
    reconnection: thisWeek.reduce((s, m) => s + m.reconnection_count, 0),
    growth: thisWeek.reduce((s, m) => s + m.growth_count, 0),
    events: thisWeek.reduce((s, m) => s + m.shared_event_count, 0),
    tenants: thisWeek.reduce((s, m) => s + m.tenant_count, 0),
  };

  const hasAny = Object.values(totals).some((v) => v > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold font-serif text-foreground">Shared Pulse</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Anonymized narrative heartbeat across your Communio groups.<br />
                <strong>Where:</strong> Aggregated from weekly community signals.<br />
                <strong>Why:</strong> Listen to what's moving in the shared network — no private data exposed.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!hasAny ? (
        <Card className="rounded-xl">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground font-serif leading-relaxed max-w-md mx-auto">
              The shared pulse is quiet this week. As organizations in your groups generate
              narrative signals, the rhythm will emerge here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PulseCard
            icon={TrendingUp}
            label="Momentum"
            value={totals.momentum}
            description="Forward movement signals"
          />
          <PulseCard
            icon={RefreshCw}
            label="Reconnection"
            value={totals.reconnection}
            description="Relationships reawakened"
          />
          <PulseCard
            icon={Sprout}
            label="Growth"
            value={totals.growth}
            description="Community deepening"
          />
          <PulseCard
            icon={Calendar}
            label="Shared Events"
            value={totals.events}
            description="Collaborative presence"
          />
        </div>
      )}

      {latestWeek && (
        <p className="text-xs text-muted-foreground text-center">
          Week of {latestWeek} · {totals.tenants} organizations listening
        </p>
      )}
    </div>
  );
}

function PulseCard({
  icon: Icon,
  label,
  value,
  description,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 text-center space-y-2">
        <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <div>
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
