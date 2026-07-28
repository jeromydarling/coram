/**
 * RelatioAdmin — Unified Relatio connector management: library, health, sync history.
 *
 * WHAT: Connector library with toggles, health scores, sync history, smoke tests.
 * WHERE: Operator → Integrations → Relatio
 * WHY: Single pane of glass for all connector admin operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ConnectionStatusBadge } from '@/components/relatio/ConnectionStatusBadge';
import { SyncHistoryPanel } from '@/components/relatio/SyncHistoryPanel';
import { SmokeTestButton } from '@/components/relatio/SmokeTestButton';
import {
  Shield, Plug, RefreshCw, ArrowLeftRight, Database, Activity,
  Loader2, CheckCircle2, XCircle, AlertTriangle, HelpCircle,
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useTenant } from '@/contexts/TenantContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { useState } from 'react';

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

const CATEGORY_ORDER: Record<string, number> = { chms: 0, crm: 1, wordpress: 2, data: 3 };
const CATEGORY_LABELS: Record<string, string> = { chms: 'ChMS', crm: 'CRM', wordpress: 'WordPress', data: 'Data' };

export default function RelatioAdmin() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // All connectors
  const { data: connectors, isLoading: connectorsLoading } = useQuery({
    queryKey: ['admin-relatio-connectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatio_connectors')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Tenant connections
  const { data: connections } = useQuery({
    queryKey: ['admin-relatio-connections', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('relatio_connections')
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Health data
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['integration-health-sim'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_integration_health')
        .select('*')
        .order('connector_key');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Test runs
  const { data: testRuns, isLoading: loadingRuns } = useQuery({
    queryKey: ['integration-test-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_test_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Toggle connector active
  const toggleMutation = useMutation({
    mutationFn: async ({ key, active }: { key: string; active: boolean }) => {
      const { error } = await supabase
        .from('relatio_connectors')
        .update({ active })
        .eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-relatio-connectors'] });
      toast.success('Connector updated.');
    },
  });

  // Health sweep
  const sweepMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('integration-sweep-nightly', {
        body: { scope: 'all' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sweep complete: ${data?.connectors_tested ?? 0} connectors tested.`);
      queryClient.invalidateQueries({ queryKey: ['integration-health-sim'] });
      queryClient.invalidateQueries({ queryKey: ['integration-test-runs'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const getConnectionForKey = (key: string) =>
    connections?.find((c) => c.connector_key === key);

  const getHealthForKey = (key: string) =>
    healthData?.find((h) => h.connector_key === key);

  const statusIcon = (status: string) => {
    if (status === 'ok' || status === 'passed') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (status === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />;
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  };

  // Group connectors by category
  const grouped = (connectors ?? []).reduce<Record<string, typeof connectors>>((acc, c) => {
    const cat = c.category ?? 'crm';
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(c);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99)
  );

  return (
    <div className="space-y-8">
      {/* ── Connector Library ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Plug className="h-5 w-5" /> Connector Library
            <HelpTip text="All registered Relatio connectors. Toggle active/inactive, view connection status and health scores." />
          </h2>
          <div className="flex gap-2">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Activity className="h-4 w-4 mr-2" /> Test Runs
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader><SheetTitle>Recent Test Runs</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-3">
                  {loadingRuns ? (
                    <Skeleton className="h-40 w-full" />
                  ) : !testRuns?.length ? (
                    <p className="text-sm text-muted-foreground">No test runs yet.</p>
                  ) : (
                    testRuns.map((run) => (
                      <Card key={run.id} className="text-xs">
                        <CardContent className="py-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {statusIcon(run.status)}
                              <span className="font-medium capitalize">{run.connector_key}</span>
                              <Badge variant="outline">{run.test_type}</Badge>
                            </div>
                            <Badge variant={run.status === 'passed' ? 'default' : 'destructive'}>{run.status}</Badge>
                          </div>
                          {run.simulation_profile_key && (
                            <p className="text-muted-foreground">Profile: {run.simulation_profile_key}</p>
                          )}
                          <p className="text-muted-foreground">
                            {run.started_at ? format(new Date(run.started_at), 'MMM d, yyyy HH:mm') : '—'}
                          </p>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Button size="sm" onClick={() => sweepMutation.mutate()} disabled={sweepMutation.isPending}>
              {sweepMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Run Sweep
            </Button>
          </div>
        </div>

        {connectorsLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          sortedCategories.map((cat) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {CATEGORY_LABELS[cat] ?? cat} ({grouped[cat]?.length ?? 0})
              </h3>
              <div className="grid gap-2">
                {grouped[cat]?.map((c) => {
                  const conn = getConnectionForKey(c.key);
                  const health = getHealthForKey(c.key);
                  return (
                    <Card key={c.key}>
                      <CardContent className="flex items-center justify-between py-3 gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            {c.direction === 'two_way' ? (
                              <ArrowLeftRight className="h-4 w-4 text-foreground" />
                            ) : (
                              <Database className="h-4 w-4 text-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-sm">{c.name}</span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {c.direction === 'two_way' && (
                                <Badge variant="outline" className="text-[10px]">Two-way</Badge>
                              )}
                              {conn && (
                                <ConnectionStatusBadge status={conn.status as 'connected' | 'disconnected' | 'error'} />
                              )}
                              {health && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  {statusIcon(health.last_status)} {health.success_rate ?? 0}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {conn?.status === 'connected' && (
                            <SmokeTestButton connectorKey={c.key} />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {c.active ? 'Active' : 'Disabled'}
                          </span>
                          <Switch
                            checked={c.active}
                            onCheckedChange={(checked) => toggleMutation.mutate({ key: c.key, active: checked })}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Sync History ── */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <RefreshCw className="h-5 w-5" /> Sync History
        </h2>
        <SyncHistoryPanel limit={20} />
      </section>
    </div>
  );
}
