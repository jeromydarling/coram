/**
 * ActivationMovementCard — Operator Console expansion movement overview.
 *
 * WHAT: Shows tenants entering new metros, activation stage distribution, first presence counts.
 * WHERE: Operator Console → Ecosystem page.
 * WHY: Gives operators visibility into organic expansion movement patterns.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, Sprout, Users, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const STAGE_LABELS: Record<string, string> = {
  considering: 'Considering',
  scouting: 'Scouting',
  first_presence: 'First Presence',
  early_relationships: 'Early Relationships',
  community_entry: 'Community Entry',
};

export function ActivationMovementCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['operator-activation-movement'],
    queryFn: async () => {
      const { data: states, error } = await supabase
        .from('metro_activation_states')
        .select('tenant_id, metro_id, activation_stage');
      if (error) throw error;

      const rows = (states || []) as Array<{
        tenant_id: string;
        metro_id: string;
        activation_stage: string;
      }>;

      const expandingTenants = new Set(rows.map(r => r.tenant_id));
      const expandingMetros = new Set(rows.map(r => r.metro_id));
      const firstPresenceCount = rows.filter(r => r.activation_stage === 'first_presence').length;

      const distribution: Record<string, number> = {};
      for (const r of rows) {
        distribution[r.activation_stage] = (distribution[r.activation_stage] || 0) + 1;
      }

      return {
        expandingTenantCount: expandingTenants.size,
        expandingMetroCount: expandingMetros.size,
        firstPresenceCount,
        distribution,
      };
    },
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sprout className="h-4 w-4" />
          Expansion Movement
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  <strong>What:</strong> Activation stage distribution across all tenants.<br />
                  <strong>Where:</strong> metro_activation_states table.<br />
                  <strong>Why:</strong> Track organic community entry patterns.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center space-y-1">
            <Users className="h-4 w-4 mx-auto text-primary" />
            <p className="text-xl font-bold text-foreground">{data?.expandingTenantCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Expanding Tenants</p>
          </div>
          <div className="text-center space-y-1">
            <MapPin className="h-4 w-4 mx-auto text-primary" />
            <p className="text-xl font-bold text-foreground">{data?.expandingMetroCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Active Metros</p>
          </div>
          <div className="text-center space-y-1">
            <Sprout className="h-4 w-4 mx-auto text-primary" />
            <p className="text-xl font-bold text-foreground">{data?.firstPresenceCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">First Presence</p>
          </div>
        </div>

        {/* Stage distribution */}
        {data?.distribution && Object.keys(data.distribution).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Stage Distribution</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STAGE_LABELS).map(([key, label]) => {
                const count = data.distribution[key] || 0;
                if (count === 0) return null;
                return (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {label}: {count}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
