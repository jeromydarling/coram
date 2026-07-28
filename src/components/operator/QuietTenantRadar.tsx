/**
 * QuietTenantRadar — Cross-tenant drift visibility widget.
 *
 * WHAT: Shows tenants with no recent activity, flagged as quiet or drifting.
 * WHERE: Operator Dashboard (Overview page).
 * WHY: Helps operator spot tenants that may need attention before they churn.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type TenantStatus = 'stable' | 'quiet' | 'drifting';

interface QuietTenant {
  tenant_id: string;
  archetype: string;
  last_activity_at: string | null;
  status: TenantStatus;
}

export function QuietTenantRadar() {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['quiet-tenant-radar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_tenant_stats')
        .select('tenant_id, archetype, last_activity_at, active_users')
        .order('last_activity_at', { ascending: true, nullsFirst: true });
      if (error) throw error;

      const now = Date.now();
      const DAY = 86400000;
      return (data ?? []).map((t): QuietTenant => {
        const lastAct = t.last_activity_at ? new Date(t.last_activity_at).getTime() : 0;
        const daysSince = lastAct ? (now - lastAct) / DAY : 999;
        const status: TenantStatus =
          daysSince > 21 ? 'drifting' : daysSince > 14 ? 'quiet' : 'stable';
        return {
          tenant_id: t.tenant_id,
          archetype: t.archetype || 'unknown',
          last_activity_at: t.last_activity_at,
          status,
        };
      }).filter((t) => t.status !== 'stable');
    },
  });

  const statusBadge = (s: TenantStatus) => {
    const variant = s === 'drifting' ? 'destructive' : 'secondary';
    return <Badge variant={variant} className="text-[10px] capitalize">{s}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          Quiet Tenants
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs space-y-1">
                <p><strong>What:</strong> Tenants with no recent activity (14+ days).</p>
                <p><strong>Where:</strong> Operator Dashboard.</p>
                <p><strong>Why:</strong> Early drift detection before support escalation.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !tenants?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">All tenants are active. 🎉</p>
        ) : (
          <div className="space-y-2">
            {tenants.slice(0, 10).map((t) => (
              <div key={t.tenant_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{t.tenant_id.slice(0, 8)}…</p>
                  <p className="text-xs text-muted-foreground capitalize">{t.archetype.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {t.last_activity_at
                      ? formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true })
                      : 'Never'}
                  </span>
                  {statusBadge(t.status)}
                </div>
              </div>
            ))}
            {tenants.length > 10 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                +{tenants.length - 10} more quiet tenants
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
