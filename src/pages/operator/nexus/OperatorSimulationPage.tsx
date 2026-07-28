/**
 * OperatorSimulationPage — Simulation engine controls for demo tenants.
 *
 * WHAT: Toggle simulation mode, select tenants, run/pause movement generation.
 * WHERE: /operator/nexus/simulation
 * WHY: Allows operators to rehearse workflows with believable demo data.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Play, Pause, Trash2, Loader2, FlaskConical, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

/** Shows simulated connector sync events from simulation_events */
function ConnectorSyncSummary() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['sim-connector-syncs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('simulation_events')
        .select('id, occurred_at, action, internal_refs, outcome')
        .like('action', 'connector_sync:%')
        .order('occurred_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!events?.length) return <p className="text-sm text-muted-foreground">No simulated sync activity yet. Run the engine to generate connector data.</p>;

  const statusColor = (s: string): "default" | "secondary" | "outline" =>
    s === 'synced' ? 'default' : s === 'migration_ready' ? 'secondary' : 'outline';

  return (
    <div className="space-y-2">
      {events.map((e: any) => {
        const refs = e.internal_refs || {};
        return (
          <div key={e.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{refs.connector_name || refs.connector_key}</p>
              <p className="text-xs text-muted-foreground">
                {refs.coverage_mode === 'full' ? 'API Sync' : refs.coverage_mode === 'partial' ? 'Partial' : 'CSV Migration'}
                {refs.sync_direction === 'two-way' ? ' · ⇆ Two-Way' : ' · → Inbound'}
                {refs.contacts_imported ? ` · ${refs.contacts_imported} contacts` : ''}
              </p>
            </div>
            <Badge variant={statusColor(refs.sync_status)}>
              {refs.sync_status === 'synced' ? 'Demo Sync' : refs.sync_status === 'migration_ready' ? 'Migration Ready' : 'Needs Setup'}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

export default function OperatorSimulationPage() {
  const qc = useQueryClient();
  const [intensity, setIntensity] = useState<string>('low');

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['simulation-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('operator_simulation_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: runs } = useQuery({
    queryKey: ['simulation-runs-recent'],
    queryFn: async () => {
      const { data, error } = await supabase.from('simulation_runs')
        .select('*').order('started_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ['demo-tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demo_tenants')
        .select('id, tenant_id, name, seed_profile');
      if (error) throw error;
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      // Auto-populate allowed_tenant_ids from demo_tenants when enabling
      const tenantIds = tenants?.map((t: any) => t.tenant_id) || [];
      if (settings) {
        const updates: any = { enabled, updated_at: new Date().toISOString() };
        if (enabled && tenantIds.length && (!settings.allowed_tenant_ids?.length)) {
          updates.allowed_tenant_ids = tenantIds;
        }
        await supabase.from('operator_simulation_settings')
          .update(updates as any).eq('id', settings.id);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('operator_simulation_settings').insert({
          enabled,
          created_by: user!.id,
          allowed_tenant_ids: tenantIds,
          intensity: 'low',
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['simulation-settings'] }); toast.success('Settings updated'); },
    onError: (e) => toast.error(e.message),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-seed-movement', {
        body: { intensity, run_key: `sim-${Date.now()}` },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Movement generated: ${JSON.stringify(d?.stats || {})}`);
      qc.invalidateQueries({ queryKey: ['simulation-runs-recent'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('simulation-cleanup', { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => toast.success(`Cleaned ${d?.markers_cleaned || 0} markers`),
    onError: (e) => toast.error(e.message),
  });

  if (settingsLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">Simulation Engine</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          When enabled, the engine generates believable movement in demo tenants <strong>every 30 minutes</strong> throughout the day — each tenant receives a randomized intensity (light, normal, or heavy). Use "Run Now" for an immediate batch. "Pause All" stops all autonomous movement. All simulated data is safely tagged for cleanup before going live.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Engine Controls
            <HelpTip text="When enabled, the engine runs autonomously every 30 minutes with randomized intensity per tenant. 'Run Now' triggers an immediate extra batch. 'Pause All' stops all automatic runs. Cleanup removes all simulated data." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable Simulation</p>
              <p className="text-xs text-muted-foreground">Allow demo movement generation</p>
            </div>
            <Switch
              checked={settings?.enabled || false}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground">Intensity</label>
              <Select value={intensity} onValueChange={setIntensity}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Light — 2 items/tenant</SelectItem>
                  <SelectItem value="medium">Normal — 5 items/tenant</SelectItem>
                  <SelectItem value="active">Active — 10 items/tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => runMutation.mutate()}
              disabled={!settings?.enabled || runMutation.isPending}
            >
              {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Run Now
            </Button>
            <Button
              variant="outline"
              onClick={() => toggleMutation.mutate(false)}
              disabled={!settings?.enabled}
            >
              <Pause className="h-4 w-4 mr-1" /> Pause All
            </Button>
            <Button
              variant="ghost"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Cleanup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Target Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target Demo Tenants</CardTitle>
          <CardDescription>Simulation only affects these sandboxed tenants.</CardDescription>
        </CardHeader>
        <CardContent>
          {tenants?.length ? (
            <div className="flex flex-wrap gap-2">
              {tenants.map((t: any) => (
                <Badge key={t.id} variant="secondary">{t.name || t.seed_profile}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No demo tenants configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Recent Runs
            <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['simulation-runs-recent'] })}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!runs?.length ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="space-y-2">
              {runs.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.run_key}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.intensity} · {new Date(r.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === 'completed' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>
                      {r.status}
                    </Badge>
                    {r.stats && (
                      <span className="text-xs text-muted-foreground">
                        {r.stats.activities_created || 0} acts · {r.stats.reflections_created || 0} ref
                        {r.stats.events_created ? ` · ${r.stats.events_created} ev` : ''}
                        {r.stats.volunteers_created ? ` · ${r.stats.volunteers_created} vol` : ''}
                        {r.stats.stage_advances ? ` · ${r.stats.stage_advances} adv` : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connector Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Integration Sync Status
            <HelpTip text="Simulated connector sync activity. Shows what Relatio integrations would look like with active tenants." />
          </CardTitle>
          <CardDescription>Latest simulated connector activity from demo tenants.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectorSyncSummary />
        </CardContent>
      </Card>
    </div>
  );
}
