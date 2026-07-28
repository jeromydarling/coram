/**
 * SimulationControls — Simulation mode toggle + profile selector for Migration Harness.
 *
 * WHAT: Enables simulation mode with profile selection for connector testing.
 * WHERE: Admin Demo Lab → Migration Harness tab.
 * WHY: Test connector contracts without real CRM accounts.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Play, GitCommitHorizontal, HelpCircle, FlaskConical } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  connectorKey: string;
  tenantId: string | null;
  isDemoTenant: boolean;
}

export function SimulationControls({ connectorKey, tenantId, isDemoTenant }: Props) {
  const [simEnabled, setSimEnabled] = useState(false);
  const [profileKey, setProfileKey] = useState('basic');
  const [runKey, setRunKey] = useState(`sim-${new Date().toISOString().split('T')[0]}`);
  const [confirmSlug, setConfirmSlug] = useState('');

  const { data: profiles } = useQuery({
    queryKey: ['sim-profiles', connectorKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connector_simulation_profiles')
        .select('*')
        .eq('connector_key', connectorKey)
        .eq('active', true)
        .order('profile_key');
      if (error) throw error;
      return data;
    },
    enabled: simEnabled,
  });

  const smokeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.functions.invoke('integration-smoke-test', {
        body: { tenant_id: tenantId, connector_key: connectorKey, mode: 'simulate', simulation_profile_key: profileKey, run_key: runKey },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast[data?.ok ? 'success' : 'error'](data?.ok ? 'Simulated smoke test passed!' : 'Simulated smoke test has failures.');
    },
    onError: (e) => toast.error(e.message),
  });

  const dryRunMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.functions.invoke('migration-dry-run', {
        body: { tenant_id: tenantId, connector_key: connectorKey, environment: 'simulation', source: { type: 'simulate', profile_key: profileKey, run_key: runKey } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Simulated dry run complete. ${data?.warnings?.length || 0} warnings.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');
      const { data, error } = await supabase.functions.invoke('migration-commit', {
        body: { tenant_id: tenantId, connector_key: connectorKey, environment: 'simulation', source: { type: 'simulate', profile_key: profileKey, run_key: runKey } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Simulated commit done. ${JSON.stringify(data?.results)}`);
      setConfirmSlug('');
    },
    onError: (e) => toast.error(e.message),
  });

  if (!simEnabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Simulation Mode</p>
              <p className="text-xs text-muted-foreground">Test connector contracts without real CRM accounts.</p>
            </div>
          </div>
          <Switch checked={simEnabled} onCheckedChange={setSimEnabled} />
        </CardContent>
      </Card>
    );
  }

  const selectedProfile = profiles?.find(p => p.profile_key === profileKey);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Simulation Mode
            <Badge variant="outline" className="text-xs">Active</Badge>
          </CardTitle>
          <Switch checked={simEnabled} onCheckedChange={setSimEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Profile</Label>
            <Select value={profileKey} onValueChange={setProfileKey}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {profiles?.map(p => (
                  <SelectItem key={p.profile_key} value={p.profile_key}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfile?.description && (
              <p className="text-xs text-muted-foreground">{selectedProfile.description}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Run Key</Label>
            <Input value={runKey} onChange={e => setRunKey(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => smokeMutation.mutate()} disabled={smokeMutation.isPending}>
            {smokeMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
            Smoke Test
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => dryRunMutation.mutate()} disabled={dryRunMutation.isPending}>
            {dryRunMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
            Dry Run
          </Button>
          {isDemoTenant && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending || !isDemoTenant}>
                {commitMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <GitCommitHorizontal className="mr-1 h-3 w-3" />}
                Commit
              </Button>
            </div>
          )}
        </div>

        {smokeMutation.data?.checks && (
          <div className="text-xs space-y-1 pt-2 border-t">
            {smokeMutation.data.checks.map((c: { name: string; status: string; detail: string }, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <span className={c.status === 'pass' ? 'text-green-600' : c.status === 'fail' ? 'text-destructive' : 'text-yellow-500'}>●</span>
                <span className="font-medium">{c.name.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground">{c.detail}</span>
              </div>
            ))}
          </div>
        )}

        {dryRunMutation.data?.counts && (
          <div className="text-xs space-y-1 pt-2 border-t">
            <p className="font-medium">Dry Run Preview:</p>
            {Object.entries(dryRunMutation.data.counts as Record<string, number>).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="capitalize">{k}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
