/**
 * OperatorQAPage — Unified QA hub: health dashboard + E2E smoke tests.
 *
 * WHAT: Platform health overview, architecture guardrails, and operator-triggered
 *       E2E smoke tests with screenshots, structured failure evidence,
 *       auto-generated Lovable Fix Prompts, and known issue matching.
 * WHERE: Operator Console → QA (/operator/qa).
 * WHY: Single pane of glass for all quality assurance workflows.
 * VERSION: 2 — tenant_id nullable for tenant-optional suites (e.g. 80_checkout_e2e)
 */
import { useState, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVigiliaSystem } from '@/hooks/useVigilia';
import { VigiliaCard } from '@/components/operator/vigilia/VigiliaCard';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import {
  Play, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown,
  Copy, Image, Loader2, FileText, Archive, Check, Bug, UserPlus, RefreshCw, Trash2, ListChecks, RotateCcw
} from 'lucide-react';
import { generateRepairSnippet, formatRepairSnippetAsText, generateBulkRepairText } from '@/lib/qaRepairSnippets';
import { buildSelfHealingPrompt } from '@/lib/qa/promptBuilder';
import { format } from 'date-fns';
import { useTabPersistence } from '@/hooks/useTabPersistence';

const QAHealthDashboard = lazy(() => import('@/pages/operator/nexus/OperatorNexusQA'));

type RunStatus = 'running' | 'passed' | 'failed' | 'partial' | 'skipped';
type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

const STATUS_BADGES: Record<RunStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  running: { variant: 'secondary', icon: Loader2 },
  passed: { variant: 'default', icon: CheckCircle2 },
  failed: { variant: 'destructive', icon: XCircle },
  partial: { variant: 'outline', icon: AlertTriangle },
  skipped: { variant: 'outline', icon: AlertTriangle },
};

/** Derive display status: if DB says "passed" but all steps were skipped, show "skipped" */
const effectiveRunStatus = (run: { status: string; summary?: { passed?: number; failed?: number; skipped?: number } }): RunStatus => {
  if (run.status === 'passed' && run.summary) {
    const { passed = 0, failed = 0, skipped = 0 } = run.summary;
    if (passed === 0 && failed === 0 && skipped > 0) return 'skipped';
  }
  return run.status as RunStatus;
};

const STEP_ICONS: Record<StepStatus, React.ElementType> = {
  pending: Clock,
  running: Loader2,
  passed: CheckCircle2,
  failed: XCircle,
  skipped: AlertTriangle,
};

export default function OperatorQAPage() {
  const { activeTab: qaView, setActiveTab: setQaView } = useTabPersistence('test-runner');
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState('steps');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedSuiteKey, setSelectedSuiteKey] = useState('00_smoke_login_dashboard');
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSelectedKeys, setBatchSelectedKeys] = useState<Set<string>>(new Set());
  const { data: systemWatch, isLoading: systemWatchLoading } = useVigiliaSystem();

  // Fetch tenants
  const { data: tenants } = useQuery({
    queryKey: ['qa-tenants'],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('id, name, slug').order('name');
      return data || [];
    },
  });

  // Fetch suites (DB-driven)
  const { data: suites } = useQuery({
    queryKey: ['qa-suites'],
    queryFn: async () => {
      const { data } = await supabase
        .from('qa_test_suites')
        .select('*')
        .eq('enabled', true)
        .order('name');
      return data || [];
    },
  });

  // Sync suites from GitHub
  const syncSuites = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('qa-sync-suites');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['qa-suites'] });
      toast.success(`Suites synced — ${data?.synced ?? 0} spec files found`);
    },
    onError: (err) => toast.error(`Sync failed: ${String(err)}`),
  });

  // Fetch runs
  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['qa-runs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('qa_test_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 5000,
  });

  // Fetch latest batch run for fallback when qa_test_runs are purged
  const { data: latestBatch } = useQuery({
    queryKey: ['qa-latest-batch', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return null;
      const { data } = await supabase
        .from('qa_batch_runs')
        .select('id, status, suite_keys, results, created_at, completed_at, tenant_id')
        .eq('tenant_id', selectedTenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedTenantId,
    refetchInterval: 10000,
  });

  // Fetch steps for selected run
  const { data: steps } = useQuery({
    queryKey: ['qa-run-steps', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return [];
      const { data } = await supabase
        .from('qa_test_run_steps')
        .select('*')
        .eq('run_id', selectedRunId)
        .order('step_index');
      return data || [];
    },
    enabled: !!selectedRunId,
  });

  // Fetch failure record
  const { data: failure } = useQuery({
    queryKey: ['qa-run-failure', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return null;
      const { data } = await supabase
        .from('qa_run_failures')
        .select('*')
        .eq('run_id', selectedRunId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedRunId,
  });

  // Fetch fix prompt
  const { data: fixPrompt } = useQuery({
    queryKey: ['qa-fix-prompt', selectedRunId],
    queryFn: async () => {
      if (!selectedRunId) return null;
      const { data } = await supabase
        .from('qa_fix_prompts')
        .select('*')
        .eq('run_id', selectedRunId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedRunId,
  });

  // Signed URLs for screenshots
  const signedUrls = useQuery({
    queryKey: ['qa-signed-urls', selectedRunId, steps?.map(s => (s as any).screenshot_path).join(',')],
    queryFn: async () => {
      if (!steps) return {};
      const paths = steps.map((s: any) => s.screenshot_path).filter(Boolean) as string[];
      if (paths.length === 0) return {};
      const { data } = await supabase.storage.from('qa_screenshots').createSignedUrls(paths, 3600);
      if (!data) return {};
      const map: Record<string, string> = {};
      data.forEach((item) => { if (item.signedUrl && item.path) map[item.path] = item.signedUrl; });
      return map;
    },
    enabled: !!steps && steps.length > 0,
  });

  const getScreenshotUrl = (path: string | null): string | null => {
    if (!path) return null;
    return signedUrls.data?.[path] || null;
  };



  const toggleBatchKey = (key: string) => {
    setBatchSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAllBatchKeys = () => {
    if (!suites) return;
    if (batchSelectedKeys.size === suites.length) {
      setBatchSelectedKeys(new Set());
    } else {
      setBatchSelectedKeys(new Set(suites.map(s => s.key)));
    }
  };

  // Trigger batch run
  const triggerBatch = useMutation({
    mutationFn: async () => {
      if (!selectedTenantId) throw new Error('Select a tenant first');
      if (batchSelectedKeys.size === 0) throw new Error('Select at least one suite');
      const { data, error } = await supabase.functions.invoke('qa-run-batch', {
        body: {
          tenant_id: selectedTenantId,
          suite_keys: Array.from(batchSelectedKeys).sort(),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Batch started — ${data?.total_suites} suites queued`);
      queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
    },
    onError: (err) => toast.error(`Batch failed: ${String(err)}`),
  });

  // Seed QA user
  const seedUser = useMutation({
    mutationFn: async () => {
      if (!selectedTenantId) throw new Error('Select a tenant first');
      const { data, error } = await supabase.functions.invoke('qa-seed-user', {
        body: { tenant_id: selectedTenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`QA user ready: ${data?.email} → ${data?.tenant_slug}`);
    },
    onError: (err) => toast.error(`Failed to seed QA user: ${String(err)}`),
  });

  // Check if selected suite requires a tenant
  // Fallback: keep checkout E2E tenant-optional even if metadata is stale/missing.
  const selectedSuiteRequiresTenant = (() => {
    const suite = suites?.find(s => s.key === selectedSuiteKey);
    if (suite?.requires_tenant === false) return false;
    if (selectedSuiteKey === '80_checkout_e2e') return false;
    return true; // default true
  })();

  // Trigger run — includes spec_path for audit
  const triggerRun = useMutation({
    mutationFn: async () => {
      const selectedSuite = suites?.find(s => s.key === selectedSuiteKey);
      const bodyPayload: Record<string, unknown> = {
        suite_key: selectedSuiteKey,
        spec_path: selectedSuite?.spec_path || undefined,
      };
      if (selectedTenantId) {
        bodyPayload.tenant_id = selectedTenantId;
      }
      const { data, error } = await supabase.functions.invoke('qa-run-suite', {
        body: bodyPayload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('QA run started');
      queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
      if (data?.run_id) setSelectedRunId(data.run_id);
    },
    onError: (err) => toast.error(`Failed to start QA run: ${String(err)}`),
  });

  // Kill a stuck/running run
  const killRun = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from('qa_test_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error: { reason: 'Manually cancelled by gardener' } as any })
        .eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
      toast.success('Run killed');
    },
    onError: (err) => toast.error(`Failed to kill run: ${String(err)}`),
  });

  // Delete a run and all associated data
  const deleteRun = useMutation({
    mutationFn: async (runId: string) => {
      // Delete child records first (FK constraints)
      await supabase.from('qa_fix_prompts').delete().eq('run_id', runId);
      await supabase.from('qa_run_failures').delete().eq('run_id', runId);
      await supabase.from('qa_test_run_steps').delete().eq('run_id', runId);
      const { error } = await supabase.from('qa_test_runs').delete().eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (selectedRunId === deleteRun.variables) setSelectedRunId(null);
      queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
      toast.success('Run deleted');
    },
    onError: (err) => toast.error(`Failed to delete run: ${String(err)}`),
  });

  // Clear ALL runs
  const clearAllRuns = useMutation({
    mutationFn: async () => {
      const runIds = runs?.map(r => r.id) || [];
      if (runIds.length === 0) return;
      // Delete child records first
      await supabase.from('qa_fix_prompts').delete().in('run_id', runIds);
      await supabase.from('qa_run_failures').delete().in('run_id', runIds);
      await supabase.from('qa_test_run_steps').delete().in('run_id', runIds);
      const { error } = await supabase.from('qa_test_runs').delete().in('id', runIds);
      if (error) throw error;
    },
    onSuccess: () => {
      setSelectedRunId(null);
      queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
      toast.success('All runs cleared');
    },
    onError: (err) => toast.error(`Failed to clear runs: ${String(err)}`),
  });

  // Update fix prompt status
  const updatePromptStatus = useMutation({
    mutationFn: async ({ promptId, status }: { promptId: string; status: string }) => {
      const { error } = await supabase.from('qa_fix_prompts').update({ status }).eq('id', promptId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qa-fix-prompt', selectedRunId] });
      toast.success('Prompt status updated');
    },
  });

  const selectedRun = runs?.find(r => r.id === selectedRunId);
  const tenantName = (id: string | null | undefined) =>
    (id && (tenants?.find(t => t.id === id)?.name || id.slice(0, 8))) || 'No tenant';
  const hasFailed = selectedRun && (selectedRun.status === 'failed' || selectedRun.status === 'partial');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-normal text-foreground">QA & Stability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Noticing where the system feels heavy, and gently restoring balance.
        </p>
      </div>

      <Tabs value={qaView} onValueChange={setQaView}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="test-runner" className="whitespace-nowrap">Test Runner</TabsTrigger>
            <TabsTrigger value="health" className="whitespace-nowrap">Health Dashboard</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="health">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <QAHealthDashboard />
          </Suspense>
        </TabsContent>

        <TabsContent value="test-runner" className="space-y-6">

      {/* Vigilia: System stability summary */}
      <VigiliaCard
        title="System Stability"
        highlights={systemWatch?.highlights ?? []}
        isLoading={systemWatchLoading}
        compact
        helpText="A calm summary of QA, automation, and friction signals across the platform."
      />

      {/* Run Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start a QA Run</CardTitle>
          <CardDescription>Select a tenant and suite, then run the automated test.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="flex h-10 w-full sm:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select tenant...</option>
              {tenants?.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
              ))}
            </select>
            <select
              value={selectedSuiteKey}
              onChange={(e) => setSelectedSuiteKey(e.target.value)}
              className="flex h-10 w-full sm:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {suites?.map(s => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
            <Button
              variant="outline"
              onClick={() => syncSuites.mutate()}
              disabled={syncSuites.isPending}
            >
              {syncSuites.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync Suites
            </Button>
            <Button
              variant="outline"
              onClick={() => seedUser.mutate()}
              disabled={!selectedTenantId || seedUser.isPending}
            >
              {seedUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Seed QA User
            </Button>
            <Button
              onClick={() => triggerRun.mutate()}
              disabled={(selectedSuiteRequiresTenant && !selectedTenantId) || triggerRun.isPending}
            >
              {triggerRun.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run QA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch Runner */}
      <Collapsible open={batchOpen} onOpenChange={setBatchOpen}>
        <Card>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-left">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListChecks className="w-4 h-4" /> Batch Runner
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Select specific suites to run sequentially. Results arrive in one email.
                  </CardDescription>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${batchOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {!suites?.length ? (
                <p className="text-sm text-muted-foreground">No suites found. Sync suites first.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Checkbox
                      checked={suites.length > 0 && batchSelectedKeys.size === suites.length}
                      onCheckedChange={toggleAllBatchKeys}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {batchSelectedKeys.size === suites.length ? 'Deselect all' : 'Select all'}
                    </span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {batchSelectedKeys.size} / {suites.length} selected
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
                    {suites.map(s => (
                      <label
                        key={s.key}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={batchSelectedKeys.has(s.key)}
                          onCheckedChange={() => toggleBatchKey(s.key)}
                        />
                        <span className="truncate min-w-0">{s.name || s.key}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={() => triggerBatch.mutate()}
                      disabled={!selectedTenantId || batchSelectedKeys.size === 0 || triggerBatch.isPending}
                    >
                      {triggerBatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Run {batchSelectedKeys.size} Suite{batchSelectedKeys.size !== 1 ? 's' : ''} in Batch
                    </Button>
                    {!selectedTenantId && (
                      <span className="text-xs text-muted-foreground">← Select a tenant above first</span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Failed Re-run Box */}
      {(() => {
        // Derive failed/partial suite keys from runs or batch results fallback
        const failedSuiteKeys = new Set<string>();
        const passedSuiteKeys = new Set<string>();

        if (runs?.length && selectedTenantId) {
          // Primary: derive from qa_test_runs rows
          const tenantRuns = runs.filter(r => r.tenant_id === selectedTenantId && r.status !== 'running');
          if (tenantRuns.length > 0) {
            const latestRun = tenantRuns[0];
            let batchRuns: typeof tenantRuns;
            if (latestRun.batch_id) {
              batchRuns = tenantRuns.filter(r => r.batch_id === latestRun.batch_id);
            } else {
              const latestTime = new Date(latestRun.started_at).getTime();
              batchRuns = tenantRuns.filter(r => {
                const diff = latestTime - new Date(r.started_at).getTime();
                return diff >= 0 && diff < 5 * 60 * 1000;
              });
            }
            batchRuns.forEach(r => {
              if (r.status === 'failed' || r.status === 'partial') {
                failedSuiteKeys.add(r.suite_key);
              } else if (r.status === 'passed') {
                passedSuiteKeys.add(r.suite_key);
              }
            });
            passedSuiteKeys.forEach(k => failedSuiteKeys.delete(k));
          }
        } else if (latestBatch?.results && Array.isArray(latestBatch.results) && latestBatch.status !== 'running') {
          // Fallback: derive from qa_batch_runs.results JSON when runs are purged
          (latestBatch.results as Array<{ suite_key: string; status: string }>).forEach(r => {
            if (r.status === 'failed' || r.status === 'partial') {
              failedSuiteKeys.add(r.suite_key);
            } else if (r.status === 'passed') {
              passedSuiteKeys.add(r.suite_key);
            }
          });
          passedSuiteKeys.forEach(k => failedSuiteKeys.delete(k));
        }

        if (failedSuiteKeys.size === 0) return null;

        const failedKeys = Array.from(failedSuiteKeys).sort();

        return (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-destructive" />
                Failed Re-run
              </CardTitle>
              <CardDescription>
                {failedKeys.length} suite{failedKeys.length !== 1 ? 's' : ''} failed in the latest batch. Re-run just these.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {failedKeys.map(key => {
                  const suite = suites?.find(s => s.key === key);
                  return (
                    <Badge key={key} variant="destructive" className="text-xs gap-1">
                      <XCircle className="w-3 h-3" />
                      {suite?.name || key}
                    </Badge>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setBatchSelectedKeys(new Set(failedKeys));
                    setBatchOpen(true);
                    // Auto-trigger the batch
                    if (selectedTenantId && failedKeys.length > 0) {
                      supabase.functions.invoke('qa-run-batch', {
                        body: {
                          tenant_id: selectedTenantId,
                          suite_keys: failedKeys,
                        },
                      }).then(({ data, error }) => {
                        if (error) {
                          toast.error(`Re-run failed: ${String(error)}`);
                        } else {
                          toast.success(`Re-running ${failedKeys.length} failed suite${failedKeys.length !== 1 ? 's' : ''}`);
                          queryClient.invalidateQueries({ queryKey: ['qa-runs'] });
                        }
                      });
                    }
                  }}
                  disabled={!selectedTenantId}
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-run {failedKeys.length} Failed Suite{failedKeys.length !== 1 ? 's' : ''}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBatchSelectedKeys(new Set(failedKeys));
                    setBatchOpen(true);
                    toast.info('Failed suites loaded into Batch Runner — review and run when ready.');
                  }}
                >
                  Load into Batch Runner
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Runs Table */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Runs</CardTitle>
              {runs && runs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={clearAllRuns.isPending}
                  onClick={() => {
                    if (window.confirm(`Clear all ${runs.length} runs? This cannot be undone.`)) {
                      clearAllRuns.mutate();
                    }
                  }}
                >
                  {clearAllRuns.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runsLoading ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : !runs?.length ? (
                    latestBatch?.results && Array.isArray(latestBatch.results) ? (
                      <>
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-2 text-xs text-muted-foreground bg-muted/30">
                            Showing last batch summary ({format(new Date(latestBatch.created_at), 'MMM d, HH:mm')}) — individual runs were cleared
                          </TableCell>
                        </TableRow>
                        {(latestBatch.results as Array<{ suite_key: string; status: string; passed?: number; failed?: number }>).map((r, i) => {
                          const badge = STATUS_BADGES[r.status as RunStatus] || STATUS_BADGES.failed;
                          const Icon = badge.icon;
                          return (
                            <TableRow key={`batch-${i}`}>
                              <TableCell className="text-xs">
                                <div className="text-muted-foreground">{r.suite_key}</div>
                                <div className="text-muted-foreground/70">{r.passed ?? 0}✓ {r.failed ?? 0}✗</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={badge.variant} className="gap-1">
                                  <Icon className="w-3 h-3" />
                                  {r.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    ) : (
                      <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No runs yet</TableCell></TableRow>
                    )
                  ) : runs.map(run => {
                    const displayStatus = effectiveRunStatus(run as any);
                    const badge = STATUS_BADGES[displayStatus] || STATUS_BADGES.failed;
                    const Icon = badge.icon;
                    return (
                      <TableRow
                        key={run.id}
                        className={`cursor-pointer ${selectedRunId === run.id ? 'bg-muted' : ''}`}
                        onClick={() => { setSelectedRunId(run.id); setDetailTab('steps'); }}
                      >
                        <TableCell className="text-xs">
                          <div>{format(new Date(run.started_at), 'MMM d, HH:mm')}</div>
                          <div className="text-muted-foreground">{run.suite_key}</div>
                          <div className="text-muted-foreground">{tenantName(run.tenant_id)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant} className="gap-1">
                            <Icon className={`w-3 h-3 ${displayStatus === 'running' ? 'animate-spin' : ''}`} />
                            {displayStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Run Detail — scrollable on mobile */}
        <Card className="lg:col-span-2 flex flex-col max-h-[70vh] lg:max-h-[80vh]">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg">
                {selectedRun ? `Run — ${selectedRun.suite_key}` : 'Select a run'}
              </CardTitle>
              <div className="flex gap-2">
                {selectedRun && !['passed', 'failed'].includes(selectedRun.status) && (
                  <Button
                    variant="destructive" size="sm" className="gap-1.5"
                    disabled={killRun.isPending}
                    onClick={() => killRun.mutate(selectedRun.id)}
                  >
                    {killRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    Kill Run
                  </Button>
                )}
                {selectedRun && (
                  <>
                    <Button
                      variant="outline" size="sm" className="gap-1.5"
                      disabled={triggerRun.isPending}
                      onClick={() => {
                        setSelectedTenantId(selectedRun.tenant_id ?? '');
                        setSelectedSuiteKey(selectedRun.suite_key);
                        triggerRun.mutate();
                      }}
                    >
                      <Play className="w-3.5 h-3.5" />
                      Re-run
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={deleteRun.isPending}
                      onClick={() => deleteRun.mutate(selectedRun.id)}
                    >
                      {deleteRun.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
            {selectedRun?.error && (
              <div className="text-xs text-destructive bg-destructive/10 rounded p-2 mt-2">
                {typeof selectedRun.error === 'object' ? JSON.stringify(selectedRun.error) : String(selectedRun.error)}
              </div>
            )}
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto min-h-0">
            {!selectedRun ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Click a run to see details.</p>
            ) : (
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <div className="overflow-x-auto -mx-1 px-1">
                  <TabsList className="inline-flex w-max">
                    <TabsTrigger value="steps" className="gap-1.5 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Steps
                    </TabsTrigger>
                    {hasFailed && (
                      <TabsTrigger value="failure" className="gap-1.5 whitespace-nowrap">
                        <Bug className="w-3.5 h-3.5" /> Failure
                      </TabsTrigger>
                    )}
                    {hasFailed && fixPrompt && (
                      <TabsTrigger value="fix" className="gap-1.5 whitespace-nowrap">
                        <FileText className="w-3.5 h-3.5" /> Fix Prompt
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>

                {/* Steps Tab */}
                <TabsContent value="steps" className="mt-4">
                  {!steps?.length ? (
                    <div className="text-center py-8">
                      {selectedRun.status === 'running' ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Waiting for results from GitHub Actions...</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No steps recorded.</span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {steps.map((step: any) => {
                        const StepIcon = STEP_ICONS[step.status as StepStatus] || Clock;
                        const isFailed = step.status === 'failed';
                        const hasErrors = step.console_errors?.length > 0 || step.page_errors?.length > 0 || step.network_failures?.length > 0;

                        return (
                          <Collapsible key={step.id}>
                            <CollapsibleTrigger className="flex items-center gap-3 w-full p-3 rounded-lg border text-left hover:bg-muted/50 transition-colors">
                              <StepIcon className={`w-4 h-4 shrink-0 ${
                                step.status === 'passed' ? 'text-primary' :
                                step.status === 'failed' ? 'text-destructive' :
                                step.status === 'running' ? 'animate-spin text-primary' :
                                'text-muted-foreground'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{step.label}</div>
                                <div className="text-xs text-muted-foreground truncate">{step.url || step.step_key}</div>
                              </div>
                              {step.screenshot_path && <Image className="w-3.5 h-3.5 text-muted-foreground" />}
                              {hasErrors && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="px-3 pb-3 pt-1 space-y-2">
                              {step.screenshot_path && getScreenshotUrl(step.screenshot_path) && (
                                <div className="border rounded overflow-hidden">
                                  <img
                                    src={getScreenshotUrl(step.screenshot_path)!}
                                    alt={`Screenshot: ${step.label}`}
                                    className="w-full max-h-64 object-contain bg-muted"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              {step.console_errors?.length > 0 && (
                                <div className="text-xs">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-destructive">Console Errors</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(step.console_errors, null, 2));
                                      toast.success('Copied');
                                    }}>
                                      <Copy className="w-3 h-3" /> Copy
                                    </Button>
                                  </div>
                                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">{JSON.stringify(step.console_errors, null, 2)}</pre>
                                </div>
                              )}
                              {step.page_errors?.length > 0 && (
                                <div className="text-xs">
                                  <div className="font-medium text-destructive mb-1">Page Errors</div>
                                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">{JSON.stringify(step.page_errors, null, 2)}</pre>
                                </div>
                              )}
                              {step.network_failures?.length > 0 && (
                                <div className="text-xs">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-destructive">Network Failures</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(step.network_failures, null, 2));
                                      toast.success('Copied');
                                    }}>
                                      <Copy className="w-3 h-3" /> Copy
                                    </Button>
                                  </div>
                                  <pre className="bg-muted p-2 rounded text-xs overflow-x-auto max-h-32">{JSON.stringify(step.network_failures, null, 2)}</pre>
                                </div>
                              )}
                              {step.notes && <div className="text-xs text-muted-foreground">{step.notes}</div>}
                              {isFailed && (
                                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => {
                                  const allSteps = steps?.map(s => ({
                                    step_key: s.step_key,
                                    label: s.label || s.step_key,
                                    status: s.status,
                                    url: s.url,
                                    screenshot_path: s.screenshot_path,
                                    console_errors: Array.isArray(s.console_errors) ? s.console_errors : [],
                                    page_errors: Array.isArray(s.page_errors) ? s.page_errors : [],
                                    network_failures: Array.isArray(s.network_failures) ? s.network_failures : [],
                                    notes: s.notes ?? null,
                                  })) || [];
                                  const result = buildSelfHealingPrompt(
                                    selectedRun?.suite_key || 'unknown',
                                    selectedRunId || '',
                                    allSteps,
                                  );
                                  navigator.clipboard.writeText(result.prompt_text);
                                  toast.success('Self-healing repair prompt copied');
                                }}>
                                  <Copy className="w-3 h-3" /> Copy root-cause fix
                                </Button>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Failure Tab */}
                {hasFailed && (
                  <TabsContent value="failure" className="mt-4 space-y-4">
                    {failure ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-1">Failure Type</div>
                            <Badge variant="destructive">{failure.failure_type}</Badge>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground mb-1">Last Step</div>
                            <div className="text-sm font-medium">{(failure.last_step as any)?.name || 'unknown'}</div>
                            <div className="text-xs text-muted-foreground truncate">{(failure.last_step as any)?.url || ''}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-1">Primary Message</div>
                          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-40 whitespace-pre-wrap">
                            {failure.primary_message}
                          </pre>
                        </div>
                        {failure.stack_trace && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">Stack Trace</span>
                              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                                navigator.clipboard.writeText(failure.stack_trace || '');
                                toast.success('Copied');
                              }}>
                                <Copy className="w-3 h-3" /> Copy
                              </Button>
                            </div>
                            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-40 whitespace-pre-wrap">
                              {failure.stack_trace}
                            </pre>
                          </div>
                        )}
                        {(failure.console_errors as any[])?.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">Console Errors ({(failure.console_errors as any[]).length})</span>
                              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(failure.console_errors, null, 2));
                                toast.success('Copied');
                              }}>
                                <Copy className="w-3 h-3" /> Copy
                              </Button>
                            </div>
                            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-40">
                              {JSON.stringify(failure.console_errors, null, 2)}
                            </pre>
                          </div>
                        )}
                        {(failure.network_errors as any[])?.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">Network Errors ({(failure.network_errors as any[]).length})</span>
                              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(failure.network_errors, null, 2));
                                toast.success('Copied');
                              }}>
                                <Copy className="w-3 h-3" /> Copy
                              </Button>
                            </div>
                            <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-40">
                              {JSON.stringify(failure.network_errors, null, 2)}
                            </pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No structured failure evidence yet.</p>
                    )}
                  </TabsContent>
                )}

                {/* Fix Prompt Tab */}
                {hasFailed && fixPrompt && (
                  <TabsContent value="fix" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="text-sm font-medium">{fixPrompt.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={fixPrompt.status === 'approved' ? 'default' : fixPrompt.status === 'archived' ? 'secondary' : 'outline'}>
                            {fixPrompt.status}
                          </Badge>
                          {(fixPrompt.redactions as any[])?.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {(fixPrompt.redactions as any[]).length} redaction(s) applied
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="gap-1.5" onClick={() => {
                          navigator.clipboard.writeText(fixPrompt.prompt_text);
                          toast.success('Fix prompt copied to clipboard');
                        }}>
                          <Copy className="w-3.5 h-3.5" /> Copy Prompt
                        </Button>
                        {fixPrompt.status === 'draft' && (
                          <>
                            <Button variant="outline" size="sm" className="gap-1.5"
                              disabled={updatePromptStatus.isPending}
                              onClick={() => updatePromptStatus.mutate({ promptId: fixPrompt.id, status: 'approved' })}
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </Button>
                            <Button variant="ghost" size="sm" className="gap-1.5"
                              disabled={updatePromptStatus.isPending}
                              onClick={() => updatePromptStatus.mutate({ promptId: fixPrompt.id, status: 'archived' })}
                            >
                              <Archive className="w-3.5 h-3.5" /> Archive
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Root cause hypotheses */}
                    {(fixPrompt.root_cause_hypotheses as any[])?.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Root Cause Hypotheses</div>
                        <ol className="list-decimal list-inside text-sm space-y-1">
                          {(fixPrompt.root_cause_hypotheses as string[]).map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Suggested files */}
                    {(fixPrompt.suggested_files as any[])?.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">Likely Files to Inspect</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(fixPrompt.suggested_files as string[]).map((f, i) => (
                            <code key={i} className="text-xs bg-background px-2 py-0.5 rounded border">{f}</code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full prompt */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">Full Lovable Fix Prompt</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => {
                          navigator.clipboard.writeText(fixPrompt.prompt_text);
                          toast.success('Copied');
                        }}>
                          <Copy className="w-3 h-3" /> Copy
                        </Button>
                      </div>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto max-h-96 whitespace-pre-wrap border">
                        {fixPrompt.prompt_text}
                      </pre>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
