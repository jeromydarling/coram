/**
 * SyncSettingsPanel — Dedicated settings panel for bi-directional sync.
 *
 * WHAT: Shows sync direction, conflict resolution strategy, and pending conflicts.
 * WHERE: OperatorIntegrationsPage (new tab or expandable section).
 * WHY: Shepherds need a calm, centralized place to manage sync behavior and resolve conflicts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeftRight, ShieldCheck, AlertTriangle, Check } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { SyncDirectionToggle } from './SyncDirectionToggle';
import { HelpTooltip } from '@/components/ui/help-tooltip';

const BI_DIRECTIONAL_CONNECTORS = [
  { key: 'salesforce', label: 'Salesforce' },
  { key: 'dynamics365', label: 'Microsoft Dynamics 365' },
  { key: 'hubspot', label: 'HubSpot' },
  { key: 'blackbaud', label: 'Blackbaud RE NXT' },
];

interface SyncConfig {
  connector_key: string;
  sync_direction: string;
  conflict_resolution: string;
  enabled: boolean;
  last_outbound_at: string | null;
}

export function SyncSettingsPanel() {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isShepherd = profile?.ministry_role === 'shepherd' || profile?.ministry_role === 'steward';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: configs = [] } = useQuery({
    queryKey: ['sync-configs', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await sb
        .from('relatio_sync_config')
        .select('*')
        .eq('tenant_id', tenant!.id);
      return (data || []) as SyncConfig[];
    },
  });

  const { data: conflictCount = 0 } = useQuery({
    queryKey: ['sync-conflict-count', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { count } = await sb
        .from('sync_conflicts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id)
        .eq('resolution', 'pending');
      return count || 0;
    },
  });

  const updateResolution = useMutation({
    mutationFn: async ({ connectorKey, resolution }: { connectorKey: string; resolution: string }) => {
      const { error } = await sb
        .from('relatio_sync_config')
        .upsert(
          {
            tenant_id: tenant!.id,
            connector_key: connectorKey,
            conflict_resolution: resolution,
            updated_by: profile?.id,
          },
          { onConflict: 'tenant_id,connector_key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-configs'] });
      toast.success('Conflict resolution strategy updated');
    },
    onError: () => toast.error('Could not update resolution strategy'),
  });

  const getConfigFor = (key: string): SyncConfig | undefined =>
    configs.find((c) => c.connector_key === key);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Bi-Directional Sync
            <HelpTooltip
              what="Controls which connectors write CROS data back to external CRMs"
              where="Relatio Sync Settings"
              why="Shepherds manage sync direction and conflict resolution for enterprise CRM integrations"
            />
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            When enabled, changes in CROS flow back to your external system — with conflict safeguards.
          </p>
        </div>
        {conflictCount > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {conflictCount} conflict{conflictCount !== 1 ? 's' : ''} pending
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {BI_DIRECTIONAL_CONNECTORS.map(({ key, label }) => {
          const config = getConfigFor(key);
          const direction = (config?.sync_direction || 'inbound') as 'inbound' | 'bidirectional';
          const resolution = config?.conflict_resolution || 'flag_for_review';

          return (
            <Card key={key} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{label}</CardTitle>
                  {direction === 'bidirectional' && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      <ArrowLeftRight className="h-3 w-3 mr-1" />
                      Two-way
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {direction === 'bidirectional'
                    ? 'CROS writes changes back to this system'
                    : 'Read-only — CROS listens but never writes'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SyncDirectionToggle
                  connectorKey={key}
                  currentDirection={direction}
                  supportsTwoWay={true}
                  onDirectionChange={() =>
                    queryClient.invalidateQueries({ queryKey: ['sync-configs'] })
                  }
                />

                {direction === 'bidirectional' && isShepherd && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      When conflicts arise
                    </label>
                    <Select
                      value={resolution}
                      onValueChange={(val) =>
                        updateResolution.mutate({ connectorKey: key, resolution: val })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flag_for_review">
                          Flag for review (safest)
                        </SelectItem>
                        <SelectItem value="cros_wins">
                          CROS always wins
                        </SelectItem>
                        <SelectItem value="remote_wins">
                          External system always wins
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {config?.last_outbound_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Last outbound: {new Date(config.last_outbound_at).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!isShepherd && (
        <p className="text-xs text-muted-foreground italic text-center pt-2">
          Only Shepherds and Stewards can modify sync direction and conflict resolution settings.
        </p>
      )}
    </div>
  );
}
