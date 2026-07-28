/**
 * ScenarioLabPage — Unified Scenario Lab combining seeding, simulation,
 * demo tenant management, migration harness, and connector testing.
 *
 * WHAT: Full sandbox for CROS platform validation.
 * WHERE: /operator/scenario-lab
 * WHY: Launch-grade testing layer — one place for all demo/test tools.
 */
import { useState, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import {
  Play, RefreshCw, Database, FlaskConical, FileText, Loader2,
  CheckCircle2, XCircle, AlertTriangle, HelpCircle, Clock,
  ArrowRightLeft, Plus, RotateCcw, Trash2, Eye, ShieldCheck, Map, TestTube2,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTabPersistence } from '@/hooks/useTabPersistence';

// Lazy-load heavy sub-tabs from the old DemoLab
import IntegrationTestHarness from '@/components/demo-lab/IntegrationTestHarness';
import { DemoLabConnectorTests } from '@/components/demo-lab/DemoLabConnectorTests';
import { DemoLabConnectorTab } from '@/components/demo-lab/DemoLabConnectorTab';
import { DemoLabMigrationRuns } from '@/components/demo-lab/DemoLabMigrationRuns';
import { AdminImpersonateModal } from '@/components/impersonation/AdminImpersonateModal';
import { ExpansionScenarioRunner } from '@/components/demo-lab/ExpansionScenarioRunner';

/* ─── Shared types ─── */
interface DemoScenario {
  key: string;
  display_name: string;
  description: string;
  default_seed_profile: string;
  enabled: boolean;
}

interface SimulationRun {
  id: string;
  scenario_key: string;
  run_key: string;
  status: string;
  stats: Record<string, number>;
  started_at: string;
  completed_at: string | null;
  intensity: string;
}

interface SimulationEvent {
  id: string;
  occurred_at: string;
  actor_type: string;
  module: string;
  action: string;
  outcome: string;
  warnings: unknown[];
}

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs"><p className="text-xs">{text}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function ScenarioLabPage() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const { activeTab, setActiveTab } = useTabPersistence('scenarios', 'scenario-lab');

  /* ─── Scenario / Simulation state ─── */
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [selectedDemoTenant, setSelectedDemoTenant] = useState<string>('');
  const [ledgerRunId, setLedgerRunId] = useState<string | null>(null);

  /* ─── Demo Tenant state ─── */
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [seedProfile, setSeedProfile] = useState<string>('small');
  const [confirmSlug, setConfirmSlug] = useState('');
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<{id: string; name: string; slug: string; tenantId: string} | null>(null);

  /* ─── Queries ─── */
  const { data: scenarios, isLoading: scenariosLoading } = useQuery({
    queryKey: ['demo-scenarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demo_scenarios').select('*').eq('enabled', true).order('key');
      if (error) throw error;
      return data as unknown as DemoScenario[];
    },
  });

  const { data: demoTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['demo-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demo_tenants').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: simRuns } = useQuery({
    queryKey: ['simulation-runs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('simulation_runs').select('*').order('started_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data as unknown as SimulationRun[];
    },
  });

  const { data: ledgerEvents } = useQuery({
    queryKey: ['simulation-events', ledgerRunId],
    queryFn: async () => {
      if (!ledgerRunId) return [];
      const { data, error } = await supabase.from('simulation_events').select('*').eq('simulation_run_id', ledgerRunId).order('occurred_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data as unknown as SimulationEvent[];
    },
    enabled: !!ledgerRunId,
  });

  const { data: seedRuns } = useQuery({
    queryKey: ['demo-seed-runs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demo_seed_runs').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: connectors } = useQuery({
    queryKey: ['integration-connectors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('integration_connectors').select('*').eq('active', true).order('display_name');
      if (error) throw error;
      return data;
    },
  });

  /* ─── Mutations ─── */
  // Scenario seed
  const scenarioSeedMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDemoTenant || !selectedScenario) throw new Error('Select scenario and demo tenant');
      const scenario = scenarios?.find(s => s.key === selectedScenario);
      const { data, error } = await supabase.functions.invoke('demo-tenant-seed', {
        body: { demo_tenant_id: selectedDemoTenant, seed_profile: scenario?.default_seed_profile ?? 'small', seed_version: 1, run_key: `${selectedScenario}-seed-v1` },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Seeded: ${JSON.stringify(d?.stats ?? {})}`); queryClient.invalidateQueries({ queryKey: ['simulation-runs'] }); },
    onError: (e: Error) => toast.error(`Seed failed: ${e.message}`),
  });

  // Simulation run
  const simMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDemoTenant || !selectedScenario) throw new Error('Select scenario and demo tenant');
      const tenant = demoTenants?.find(t => t.id === selectedDemoTenant);
      const { data, error } = await supabase.functions.invoke('simulation-run', {
        body: { tenant_id: tenant?.tenant_id, demo_tenant_id: selectedDemoTenant, scenario_key: selectedScenario, run_key: `sim-v1-7days-normal`, days: 7, intensity: 'normal' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Simulation complete: ${JSON.stringify(d?.stats ?? {})}`); queryClient.invalidateQueries({ queryKey: ['simulation-runs'] }); },
    onError: (e: Error) => toast.error(`Simulation failed: ${e.message}`),
  });

  // Create demo tenant
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('demo-tenant-create', {
        body: { slug: newSlug, name: newName, seed_profile: seedProfile },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Creation failed');
      return data;
    },
    onSuccess: () => {
      toast.success('Demo tenant created.');
      setNewSlug('');
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['demo-tenants'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Seed demo tenant
  const tenantSeedMutation = useMutation({
    mutationFn: async ({ demoTenantId, profile }: { demoTenantId: string; profile: string }) => {
      const runKey = `seed-v1-${profile}-${Date.now()}`;
      const { data, error } = await supabase.functions.invoke('demo-tenant-seed', {
        body: { demo_tenant_id: demoTenantId, seed_profile: profile, seed_version: 1, run_key: runKey },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Seed failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Seeded: ${JSON.stringify(data.stats)}`);
      queryClient.invalidateQueries({ queryKey: ['demo-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['demo-seed-runs'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reset demo tenant
  const resetMutation = useMutation({
    mutationFn: async (demoTenantId: string) => {
      const { data, error } = await supabase.functions.invoke('demo-tenant-reset', {
        body: { demo_tenant_id: demoTenantId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Reset failed');
      return data;
    },
    onSuccess: () => {
      toast.success('Demo tenant data wiped.');
      setResetTarget(null);
      setConfirmSlug('');
      queryClient.invalidateQueries({ queryKey: ['demo-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['demo-seed-runs'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const outcomeIcon = (outcome: string) => {
    if (outcome === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    if (outcome === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    if (outcome === 'error') return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6" data-testid="demo-lab-root">
      <div className="flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Scenario Lab</h1>
          <p className="text-muted-foreground text-sm">
            Seed, simulate, test migrations, and validate connectors — all in one place.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs"><strong>What:</strong> Unified sandbox for demo data, simulations, CRM migrations, and connector tests.</p>
              <p className="text-xs"><strong>Where:</strong> Operator → Scenario Lab.</p>
              <p className="text-xs"><strong>Why:</strong> Safely validate the entire CROS pipeline without touching production data.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="scenarios" className="whitespace-nowrap gap-1.5">
              <Play className="h-3.5 w-3.5" /> Scenarios
            </TabsTrigger>
            <TabsTrigger value="tenants" className="whitespace-nowrap gap-1.5">
              <Database className="h-3.5 w-3.5" /> Demo Tenants
            </TabsTrigger>
            <TabsTrigger value="migration" className="whitespace-nowrap gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Migration Harness
            </TabsTrigger>
            <TabsTrigger value="integration-tests" className="whitespace-nowrap gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Integration Tests
            </TabsTrigger>
            <TabsTrigger value="connector-tests" className="whitespace-nowrap gap-1.5">
              <TestTube2 className="h-3.5 w-3.5" /> Connector Tests
            </TabsTrigger>
            <TabsTrigger value="expansion-scenarios" className="whitespace-nowrap gap-1.5">
              <Map className="h-3.5 w-3.5" /> Expansion
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─── SCENARIOS TAB ─── */}
        <TabsContent value="scenarios" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run Configuration <HelpTip text="Select a scenario and demo tenant, then seed data and run simulations to validate the full CROS pipeline." /></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Scenario</label>
                  <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                    <SelectTrigger><SelectValue placeholder="Choose scenario..." /></SelectTrigger>
                    <SelectContent>
                      {scenarios?.map(s => (
                        <SelectItem key={s.key} value={s.key}>{s.display_name} ({s.default_seed_profile})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedScenario && (
                    <p className="text-xs text-muted-foreground mt-1">{scenarios?.find(s => s.key === selectedScenario)?.description}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Demo Tenant</label>
                  <Select value={selectedDemoTenant} onValueChange={setSelectedDemoTenant}>
                    <SelectTrigger><SelectValue placeholder="Choose demo tenant..." /></SelectTrigger>
                    <SelectContent>
                      {demoTenants?.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => scenarioSeedMutation.mutate()} disabled={!selectedScenario || !selectedDemoTenant || scenarioSeedMutation.isPending}>
                  {scenarioSeedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
                  Seed Scenario
                </Button>
                <Button size="sm" variant="secondary" onClick={() => simMutation.mutate()} disabled={!selectedScenario || !selectedDemoTenant || simMutation.isPending}>
                  {simMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                  Run Simulation
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Simulation Runs */}
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Simulation Runs</CardTitle></CardHeader>
            <CardContent>
              {!simRuns?.length ? (
                <p className="text-sm text-muted-foreground">No simulation runs yet.</p>
              ) : (
                <div className="space-y-2">
                  {simRuns.map(run => (
                    <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {run.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : run.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                        <div>
                          <p className="text-sm font-medium">{run.scenario_key} / {run.run_key}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(run.started_at), 'MMM d, HH:mm')} · {run.intensity}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>{run.status}</Badge>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost" onClick={() => setLedgerRunId(run.id)}>
                              <FileText className="h-3.5 w-3.5 mr-1" /> Ledger
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh]">
                            <DialogHeader><DialogTitle>Simulation Ledger</DialogTitle></DialogHeader>
                            <ScrollArea className="h-[60vh]">
                              <div className="space-y-1 pr-4">
                                {ledgerEvents?.map(evt => (
                                  <div key={evt.id} className="flex items-start gap-2 py-1.5 border-b border-border/50 text-xs">
                                    {outcomeIcon(evt.outcome)}
                                    <span className="text-muted-foreground w-16 shrink-0">{format(new Date(evt.occurred_at), 'MMM d')}</span>
                                    <Badge variant="outline" className="text-[10px] px-1">{evt.module}</Badge>
                                    <span className="flex-1">{evt.action}</span>
                                    <Badge variant="outline" className="text-[10px] px-1">{evt.actor_type}</Badge>
                                  </div>
                                ))}
                                {!ledgerEvents?.length && <p className="text-muted-foreground">No events recorded.</p>}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── DEMO TENANTS TAB ─── */}
        <TabsContent value="tenants" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Demo Tenant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Slug</Label>
                  <Input placeholder="demo-church-01" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input placeholder="Demo Church" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Seed Profile</Label>
                  <Select value={seedProfile} onValueChange={setSeedProfile}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (12 orgs, 40 contacts)</SelectItem>
                      <SelectItem value="medium">Medium (60 orgs, 300 contacts)</SelectItem>
                      <SelectItem value="large">Large (200 orgs, 1200 contacts)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={!newSlug || !newName || createMutation.isPending} className="rounded-full">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Demo Tenant
              </Button>
            </CardContent>
          </Card>

          {tenantsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !demoTenants?.length ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No demo tenants yet. Create one above.</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {demoTenants.map((dt) => {
                const runs = seedRuns?.filter((r) => r.demo_tenant_id === dt.id) || [];
                const lastRun = runs[0];
                const isResetting = resetTarget === dt.id;

                return (
                  <Card key={dt.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{dt.name}</span>
                          <Badge variant="outline" className="font-mono text-xs">{dt.slug}</Badge>
                          <Badge variant="secondary" className="text-xs">{dt.seed_profile}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">Created {new Date(dt.created_at).toLocaleDateString()}</span>
                      </div>

                      {lastRun && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          Last seed: {lastRun.status === 'completed' ? (
                            <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> Completed</span>
                          ) : lastRun.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" /> Failed</span>
                          ) : (
                            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Running</span>
                          )}
                          {lastRun.stats && typeof lastRun.stats === 'object' && (
                            <span className="text-muted-foreground">({Object.entries(lastRun.stats as Record<string, number>).map(([k, v]) => `${v} ${k}`).join(', ')})</span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="rounded-full" disabled={tenantSeedMutation.isPending} onClick={() => tenantSeedMutation.mutate({ demoTenantId: dt.id, profile: dt.seed_profile })}>
                          {tenantSeedMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                          Seed Data
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setImpersonateTarget({ id: dt.id, name: dt.name, slug: dt.slug, tenantId: dt.tenant_id })}>
                          <Eye className="mr-1 h-3 w-3" /> View as user…
                        </Button>
                        {!isResetting ? (
                          <Button size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => setResetTarget(dt.id)}>
                            <Trash2 className="mr-1 h-3 w-3" /> Reset
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input placeholder={`Type "${dt.slug}" to confirm`} value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} className="h-8 w-48 text-xs" />
                            <Button size="sm" variant="destructive" className="rounded-full" disabled={confirmSlug !== dt.slug || resetMutation.isPending} onClick={() => resetMutation.mutate(dt.id)}>
                              {resetMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                              Confirm Reset
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setResetTarget(null); setConfirmSlug(''); }}>Cancel</Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── MIGRATION HARNESS TAB ─── */}
        <TabsContent value="migration" className="space-y-6 mt-4">
          {!connectors?.length ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No connectors registered.</CardContent></Card>
          ) : (
            <Tabs defaultValue={connectors[0]?.key}>
              <TabsList className="flex-wrap h-auto gap-1">
                {connectors.map((c) => (
                  <TabsTrigger key={c.key} value={c.key} className="text-xs">{c.display_name}</TabsTrigger>
                ))}
              </TabsList>
              {connectors.map((c) => (
                <TabsContent key={c.key} value={c.key} className="mt-4">
                  <DemoLabConnectorTab connector={c} tenantId={tenantId} />
                </TabsContent>
              ))}
            </Tabs>
          )}
          <Separator />
          <DemoLabMigrationRuns tenantId={tenantId} />
        </TabsContent>

        {/* ─── INTEGRATION TESTS TAB ─── */}
        <TabsContent value="integration-tests" className="space-y-6 mt-4">
          <IntegrationTestHarness tenantId={tenantId} />
        </TabsContent>

        {/* ─── CONNECTOR TESTS TAB ─── */}
        <TabsContent value="connector-tests" className="space-y-6 mt-4">
          <DemoLabConnectorTests />
        </TabsContent>

        {/* ─── EXPANSION SCENARIOS TAB ─── */}
        <TabsContent value="expansion-scenarios" className="space-y-6 mt-4">
          <ExpansionScenarioRunner tenantId={tenantId} />
        </TabsContent>
      </Tabs>

      {impersonateTarget && (
        <AdminImpersonateModal
          open={!!impersonateTarget}
          onOpenChange={(open) => { if (!open) setImpersonateTarget(null); }}
          tenantId={impersonateTarget.tenantId}
          tenantName={impersonateTarget.name}
          tenantSlug={impersonateTarget.slug}
        />
      )}
    </div>
  );
}
