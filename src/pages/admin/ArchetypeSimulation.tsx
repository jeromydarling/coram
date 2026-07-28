/**
 * ArchetypeSimulation — Admin control panel for archetype simulation.
 *
 * WHAT: Start/pause/tick deterministic behavioral simulations on demo tenants.
 * WHERE: /:tenantSlug/admin/archetype-simulation
 * WHY: Makes the platform feel alive for testing without real users or AI.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, Zap, BarChart3, Users, Heart, Calendar, Package, HandHelping, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';


export default function ArchetypeSimulation() {
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('');

  // Load demo tenants
  const { data: demoTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['demo-tenants-for-sim'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demo_tenants')
        .select('id, name, slug, tenant_id, seed_profile')
        .eq('is_demo', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load archetype profiles
  const { data: archetypes, isLoading: archetypesLoading } = useQuery({
    queryKey: ['archetype-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('archetype_profiles')
        .select('*')
        .order('display_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load simulation runs
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['simulation-runs', selectedTenant],
    queryFn: async () => {
      let query = supabase
        .from('archetype_simulation_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (selectedTenant) {
        query = query.eq('tenant_id', selectedTenant);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: true,
  });

  // Run a single tick
  const tickMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTenant || !selectedArchetype) {
        throw new Error('Select a tenant and archetype first');
      }
      const tick_key = `tick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { data, error } = await supabase.functions.invoke('archetype-simulate-tick', {
        body: {
          tenant_id: selectedTenant,
          archetype_key: selectedArchetype,
          tick_key,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.idempotent) {
        toast.info('This tick was already completed.');
      } else {
        toast.success('Simulation tick completed', {
          description: formatStats(data?.stats),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['simulation-runs'] });
    },
    onError: (err: Error) => {
      toast.error('Simulation failed', { description: err.message });
    },
  });

  // Run 5 rapid ticks
  const burstMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTenant || !selectedArchetype) {
        throw new Error('Select a tenant and archetype first');
      }
      const results = [];
      for (let i = 0; i < 5; i++) {
        const tick_key = `burst-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
        const { data, error } = await supabase.functions.invoke('archetype-simulate-tick', {
          body: {
            tenant_id: selectedTenant,
            archetype_key: selectedArchetype,
            tick_key,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.message || data.error);
        results.push(data);
      }
      return results;
    },
    onSuccess: (results) => {
      const totalStats: Record<string, number> = {};
      for (const r of results) {
        if (r?.stats) {
          for (const [k, v] of Object.entries(r.stats as Record<string, number>)) {
            totalStats[k] = (totalStats[k] ?? 0) + v;
          }
        }
      }
      toast.success('5-tick burst completed', {
        description: formatStats(totalStats),
      });
      queryClient.invalidateQueries({ queryKey: ['simulation-runs'] });
    },
    onError: (err: Error) => {
      toast.error('Burst simulation failed', { description: err.message });
    },
  });

  const isRunning = tickMutation.isPending || burstMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Archetype Simulation
            <HelpTooltip content="Deterministic behavioral simulation for demo tenants. Makes the platform feel alive without real users or AI generation." />
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate realistic narrative activity on demo tenants using archetype behavior profiles.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Simulation Controls</CardTitle>
          <CardDescription>Select a demo tenant and archetype, then run ticks to generate activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Demo Tenant</label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant} disabled={tenantsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={tenantsLoading ? "Loading..." : "Select a demo tenant"} />
                </SelectTrigger>
                <SelectContent>
                  {(demoTenants ?? []).map(t => (
                    <SelectItem key={t.tenant_id ?? t.id} value={t.tenant_id ?? t.id}>
                      {t.name} ({t.seed_profile})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Archetype</label>
              <Select value={selectedArchetype} onValueChange={setSelectedArchetype} disabled={archetypesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={archetypesLoading ? "Loading..." : "Select an archetype"} />
                </SelectTrigger>
                <SelectContent>
                  {(archetypes ?? []).map(a => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Behavior preview */}
          {selectedArchetype && archetypes && (
            <BehaviorPreview archetype={archetypes.find(a => a.key === selectedArchetype)} />
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => tickMutation.mutate()}
              disabled={!selectedTenant || !selectedArchetype || isRunning}
            >
              {tickMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Run Single Tick
            </Button>
            <Button
              variant="secondary"
              onClick={() => burstMutation.mutate()}
              disabled={!selectedTenant || !selectedArchetype || isRunning}
            >
              {burstMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              5-Tick Burst
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Simulation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !runs?.length ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No simulation runs yet. Select a tenant and archetype to begin.</p>
          ) : (
            <div className="space-y-3">
              {runs.map(run => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BehaviorPreview({ archetype }: { archetype: any }) {
  if (!archetype) return null;
  const bp = archetype.behavior_profile as Record<string, number>;

  const bars = [
    { key: 'reflection_rate', label: 'Reflections', icon: Heart, color: 'bg-rose-500' },
    { key: 'event_rate', label: 'Events', icon: Calendar, color: 'bg-blue-500' },
    { key: 'volunteer_rate', label: 'Voluntārium', icon: HandHelping, color: 'bg-emerald-500' },
    { key: 'provisio_rate', label: 'Prōvīsiō', icon: Package, color: 'bg-amber-500' },
    { key: 'email_rate', label: 'Email Touches', icon: Users, color: 'bg-purple-500' },
    { key: 'journey_advance_rate', label: 'Journey Moves', icon: Zap, color: 'bg-cyan-500' },
    { key: 'communio_share_rate', label: 'Communio Shares', icon: Sparkles, color: 'bg-pink-500' },
  ];

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{archetype.display_name}</span>
        <Badge variant="outline" className="text-xs">{archetype.narrative_style}</Badge>
      </div>
      <div className="space-y-2">
        {bars.map(bar => {
          const val = bp[bar.key] ?? 0;
          return (
            <div key={bar.key} className="flex items-center gap-2">
              <bar.icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground w-28 truncate">{bar.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${bar.color} rounded-full transition-all`} style={{ width: `${val * 100}%` }} />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(val * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunCard({ run }: { run: any }) {
  const stats = (run.stats ?? {}) as Record<string, number>;
  const statusColor = run.status === 'completed' ? 'default'
    : run.status === 'running' ? 'secondary'
    : 'destructive';

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={statusColor}>{run.status}</Badge>
          <span className="text-xs text-muted-foreground font-mono">{run.archetype_key}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(run.created_at).toLocaleString()}
        </span>
      </div>
      {Object.keys(stats).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats).map(([k, v]) => (
            <span key={k} className="text-xs bg-muted px-2 py-0.5 rounded">
              {k.replace(/_/g, ' ')}: <strong>{v}</strong>
            </span>
          ))}
        </div>
      )}
      {run.error && (
        <p className="text-xs text-destructive">{(run.error as any)?.message ?? JSON.stringify(run.error)}</p>
      )}
    </div>
  );
}

function formatStats(stats?: Record<string, number>): string {
  if (!stats || !Object.keys(stats).length) return 'No activity generated';
  return Object.entries(stats)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
    .join(' · ');
}
