/**
 * NarrativeCompanionSettings — Settings card for Narrative Companion connections.
 *
 * WHAT: Displays connected ChMS systems with "Listening" / "Not Connected" status.
 * WHERE: Settings → Integrations section.
 * WHY: Tenants manage their silent companion connections without technical jargon.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Headphones, CheckCircle2, Circle, Pause } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { CHMS_CONNECTORS, getConnectorLabel } from '@/lib/connectors/chmsRegistry';
import { toast } from '@/components/ui/sonner';

export function NarrativeCompanionSettings() {
  const { tenant } = useTenant();
  const qc = useQueryClient();

  const { data: connections, isLoading } = useQuery({
    queryKey: ['companion-connections', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatio_companion_connections')
        .select('*')
        .eq('tenant_id', tenant!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['companion-settings', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_settings')
        .select('narrative_companion_enabled')
        .eq('tenant_id', tenant!.id)
        .maybeSingle();
      return data;
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('tenant_settings')
        .update({ narrative_companion_enabled: enabled })
        .eq('tenant_id', tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companion-settings', tenant?.id] });
      toast.success('Narrative Companion preference saved.');
    },
  });

  const pauseConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('relatio_companion_connections')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companion-connections', tenant?.id] });
      toast.success('Connection paused.');
    },
  });

  const resumeConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('relatio_companion_connections')
        .update({ status: 'listening', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companion-connections', tenant?.id] });
      toast.success('Connection resumed.');
    },
  });

  const statusIcon = (status: string) => {
    if (status === 'listening') return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
    if (status === 'paused') return <Pause className="h-3.5 w-3.5 text-muted-foreground" />;
    return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const statusLabel = (status: string) => {
    if (status === 'listening') return 'Listening';
    if (status === 'paused') return 'Paused';
    if (status === 'error') return 'Needs attention';
    return 'Not Connected';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Headphones className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Narrative Companion</CardTitle>
            <CardDescription>
              CROS listens alongside your existing system — never changes it.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Narrative Companion</Label>
            <p className="text-xs text-muted-foreground">
              Allow CROS to receive gentle signals from connected systems.
            </p>
          </div>
          <Switch
            checked={settings?.narrative_companion_enabled ?? false}
            onCheckedChange={(v) => toggleEnabled.mutate(v)}
          />
        </div>

        {connections && connections.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {connections.map((conn: any) => (
              <div key={conn.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {statusIcon(conn.status)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      Narrative Companion — {getConnectorLabel(conn.connector_key)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel(conn.status)}
                      {conn.records_ingested > 0 && ` · ${conn.records_ingested} signals received`}
                    </p>
                  </div>
                </div>
                {conn.status === 'listening' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => pauseConnection.mutate(conn.id)}
                    className="text-xs"
                  >
                    Pause
                  </Button>
                ) : conn.status === 'paused' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resumeConnection.mutate(conn.id)}
                    className="text-xs"
                  >
                    Resume
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {(!connections || connections.length === 0) && !isLoading && (
          <p className="text-sm text-muted-foreground italic py-2">
            No systems connected yet. Visit your Activation Guide to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
