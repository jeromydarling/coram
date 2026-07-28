/**
 * ExpansionInsightsCard — Operator Console expansion signal overview.
 *
 * WHAT: Shows aggregate expansion signal and moment counts across all tenants.
 * WHERE: Operator Console → Ecosystem page.
 * WHY: Gives operators visibility into organic expansion patterns.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Zap, Sparkles, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function ExpansionInsightsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-expansion-insights'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [signalsRes, momentsRes, civitasRes] = await Promise.all([
        supabase
          .from('expansion_signals')
          .select('tenant_id', { count: 'exact', head: false })
          .gte('created_at', thirtyDaysAgo),
        supabase
          .from('expansion_moments')
          .select('tenant_id, acknowledged')
          .eq('acknowledged', false),
        supabase
          .from('tenants')
          .select('id, civitas_enabled'),
      ]);

      // Unique tenants with signals
      const signalTenants = new Set((signalsRes.data || []).map((s: any) => s.tenant_id));
      const activeMoments = momentsRes.data || [];
      const momentTenants = new Set(activeMoments.map((m: any) => m.tenant_id));

      const allTenants = civitasRes.data || [];
      const civitasEnabled = allTenants.filter((t: any) => t.civitas_enabled).length;
      const activationRate = allTenants.length > 0
        ? Math.round((civitasEnabled / allTenants.length) * 100)
        : 0;

      return {
        tenantsWithSignals: signalTenants.size,
        tenantsWithMoments: momentTenants.size,
        civitasActivationRate: activationRate,
        totalSignals: signalsRes.count ?? 0,
      };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-40" />;
  }

  const metrics = [
    { label: 'Tenants with Signals', value: data?.tenantsWithSignals ?? 0, icon: Zap },
    { label: 'Active Expansion Moments', value: data?.tenantsWithMoments ?? 0, icon: Sparkles },
    { label: 'Civitas Activation Rate', value: `${data?.civitasActivationRate ?? 0}%`, icon: ArrowUpRight },
  ];

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Expansion Insights
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  <strong>What:</strong> Aggregated expansion signals and moments across tenants.<br />
                  <strong>Where:</strong> expansion_signals + expansion_moments tables.<br />
                  <strong>Why:</strong> Track organic multi-community growth patterns.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center space-y-1">
              <Icon className="h-4 w-4 mx-auto text-primary" />
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
