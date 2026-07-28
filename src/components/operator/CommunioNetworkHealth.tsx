/**
 * CommunioNetworkHealth — Operator Console panel for Communio network health.
 *
 * WHAT: Shows group count, active tenants, and weekly shared signal volume.
 * WHERE: Operator Console > Overview and Communio tabs.
 * WHY: Lets leadership monitor network growth without exposing private data.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UsersRound, Radio, Calendar, Network } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

export function CommunioNetworkHealth() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-communio-network-health'],
    queryFn: async () => {
      const [groupsRes, membershipsRes, signalsRes, eventsRes] = await Promise.all([
        supabase.from('communio_groups').select('id', { count: 'exact', head: true }),
        supabase.from('communio_memberships').select('tenant_id'),
        supabase.from('communio_shared_signals')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('communio_shared_events')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);

      // Count unique tenants
      const uniqueTenants = new Set(membershipsRes.data?.map(m => m.tenant_id) || []);

      return {
        groupCount: groupsRes.count ?? 0,
        activeTenants: uniqueTenants.size,
        signalsWeekly: signalsRes.count ?? 0,
        eventsWeekly: eventsRes.count ?? 0,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Communio Network Health</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  <strong>What:</strong> Platform-wide Communio network metrics.<br />
                  <strong>Where:</strong> Aggregated from groups, memberships, and shared signals.<br />
                  <strong>Why:</strong> Monitor cooperative network growth across all tenants.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricItem icon={UsersRound} label="Groups" value={data?.groupCount ?? 0} />
          <MetricItem icon={UsersRound} label="Connected Tenants" value={data?.activeTenants ?? 0} />
          <MetricItem icon={Radio} label="Signals This Week" value={data?.signalsWeekly ?? 0} />
          <MetricItem icon={Calendar} label="Events Shared" value={data?.eventsWeekly ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
