/**
 * DemoLab — Admin-only Demo Lab + Migration Harness.
 *
 * WHAT: Creates/seeds/resets demo tenants, manages CRM migrations.
 * WHERE: /:tenantSlug/admin/demo-lab
 * WHY: Safe, isolated environment for testing migrations and demos.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HelpCircle, FlaskConical, Database, ArrowRightLeft, Plus, RotateCcw, Play, CheckCircle2, XCircle, AlertTriangle, Loader2, Trash2, Eye, ShieldCheck, Map, TestTube2 } from 'lucide-react';
import IntegrationTestHarness from '@/components/demo-lab/IntegrationTestHarness';
import { DemoLabConnectorTests } from '@/components/demo-lab/DemoLabConnectorTests';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DemoLabConnectorTab } from '@/components/demo-lab/DemoLabConnectorTab';
import { DemoLabMigrationRuns } from '@/components/demo-lab/DemoLabMigrationRuns';
import { AdminImpersonateModal } from '@/components/impersonation/AdminImpersonateModal';
import { ExpansionScenarioRunner } from '@/components/demo-lab/ExpansionScenarioRunner';

export default function DemoLab() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [seedProfile, setSeedProfile] = useState<string>('small');
  const [confirmSlug, setConfirmSlug] = useState('');
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<{id: string; name: string; slug: string; tenantId: string} | null>(null);

  // Fetch demo tenants
  const { data: demoTenants, isLoading } = useQuery({
    queryKey: ['demo-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demo_tenants')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch seed runs
  const { data: seedRuns } = useQuery({
    queryKey: ['demo-seed-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demo_seed_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch connectors
  const { data: connectors } = useQuery({
    queryKey: ['integration-connectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_connectors')
        .select('*')
        .eq('active', true)
        .order('display_name');
      if (error) throw error;
      return data;
    },
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
    onError: (e) => toast.error(e.message),
  });

  // Seed demo tenant
  const seedMutation = useMutation({
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
    onError: (e) => toast.error(e.message),
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
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Demo Lab</h1>
          <p className="text-sm text-muted-foreground">
            Create, seed, and test demo tenants. Run CRM migrations safely.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs"><strong>What:</strong> Admin-only sandbox for demo data and migration testing.</p>
              <p className="text-xs"><strong>Where:</strong> Admin → Demo Lab.</p>
              <p className="text-xs"><strong>Why:</strong> Safely test imports without affecting real data.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants" className="gap-2">
            <Database className="h-4 w-4" /> Demo Tenants
          </TabsTrigger>
          <TabsTrigger value="migration" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Migration Harness
          </TabsTrigger>
          <TabsTrigger value="integration-tests" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> Integration Tests
          </TabsTrigger>
          <TabsTrigger value="connector-tests" className="gap-2">
            <TestTube2 className="h-4 w-4" /> Connector Tests
          </TabsTrigger>
          <TabsTrigger value="expansion-scenarios" className="gap-2">
            <Map className="h-4 w-4" /> Expansion Scenarios
          </TabsTrigger>
        </TabsList>

        {/* ─── DEMO TENANTS TAB ─── */}
        <TabsContent value="tenants" className="space-y-6 mt-4">
          {/* Create form */}
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
                  <Input
                    placeholder="demo-church-01"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input
                    placeholder="Demo Church"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
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
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newSlug || !newName || createMutation.isPending}
                className="rounded-full"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Demo Tenant
              </Button>
            </CardContent>
          </Card>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !demoTenants?.length ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No demo tenants yet. Create one above.
              </CardContent>
            </Card>
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
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(dt.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {lastRun && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          Last seed: {lastRun.status === 'completed' ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" /> Completed
                            </span>
                          ) : lastRun.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-destructive">
                              <XCircle className="h-3 w-3" /> Failed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Running
                            </span>
                          )}
                          {lastRun.stats && typeof lastRun.stats === 'object' && (
                            <span className="text-muted-foreground">
                              ({Object.entries(lastRun.stats as Record<string, number>).map(([k, v]) => `${v} ${k}`).join(', ')})
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={seedMutation.isPending}
                          onClick={() => seedMutation.mutate({ demoTenantId: dt.id, profile: dt.seed_profile })}
                        >
                          {seedMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                          Seed Data
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => setImpersonateTarget({ id: dt.id, name: dt.name, slug: dt.slug, tenantId: dt.tenant_id })}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          View as user…
                        </Button>

                        {!isResetting ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full text-destructive"
                            onClick={() => setResetTarget(dt.id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Reset
                          </Button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder={`Type "${dt.slug}" to confirm`}
                              value={confirmSlug}
                              onChange={(e) => setConfirmSlug(e.target.value)}
                              className="h-8 w-48 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-full"
                              disabled={confirmSlug !== dt.slug || resetMutation.isPending}
                              onClick={() => resetMutation.mutate(dt.id)}
                            >
                              {resetMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                              Confirm Reset
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setResetTarget(null); setConfirmSlug(''); }}
                            >
                              Cancel
                            </Button>
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
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No connectors registered.
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue={connectors[0]?.key}>
              <TabsList className="flex-wrap h-auto gap-1">
                {connectors.map((c) => (
                  <TabsTrigger key={c.key} value={c.key} className="text-xs">
                    {c.display_name}
                  </TabsTrigger>
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

        {/* ─── INTEGRATION TEST HARNESS TAB ─── */}
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
