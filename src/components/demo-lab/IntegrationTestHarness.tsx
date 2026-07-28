/**
 * IntegrationTestHarness — Admin-only test panel for Outlook, Unsubscribe, Campaign gating.
 *
 * WHAT: Provides run buttons, results display, history, and operator runbook.
 * WHERE: Demo Lab → Integration Test Harness tab.
 * WHY: Safe, repeatable integration verification without sending emails.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  HelpCircle, Play, CheckCircle2, XCircle, Loader2, Copy,
  Mail, ShieldCheck, Ban, ChevronDown, BookOpen, AlertTriangle, SkipForward
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { formatDistanceToNow, format } from 'date-fns';

interface TestCheck {
  step_key: string;
  label: string;
  status: 'passed' | 'failed' | 'skipped';
  details: Record<string, unknown>;
}

interface TestResult {
  ok: boolean;
  test_run_id: string;
  status: string;
  checks: TestCheck[];
}

interface TestRun {
  id: string;
  tenant_id: string;
  suite_key: string;
  environment: string;
  status: string;
  started_by: string;
  started_at: string;
  completed_at: string | null;
  summary: Record<string, unknown>;
  error: Record<string, unknown> | null;
}

interface TestRunStep {
  id: string;
  test_run_id: string;
  step_key: string;
  label: string;
  status: string;
  details: Record<string, unknown>;
  created_at: string;
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === 'skipped') return <SkipForward className="h-4 w-4 text-muted-foreground" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'passed' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
  return <Badge variant={variant} className="text-xs capitalize">{status}</Badge>;
}

export default function IntegrationTestHarness({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [environment, setEnvironment] = useState<string>('sandbox');
  const [unsubEmail, setUnsubEmail] = useState('test.unsubscribe@cros.test');
  const [unsubCampaignId, setUnsubCampaignId] = useState('');
  const [suppressionEmail, setSuppressionEmail] = useState('test.unsubscribe@cros.test');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runbookOpen, setRunbookOpen] = useState(false);

  // Fetch demo tenants for selector
  const { data: demoTenants } = useQuery({
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

  // Fetch test history for selected tenant
  const { data: testRuns } = useQuery({
    queryKey: ['operator-test-runs', selectedTenant],
    enabled: !!selectedTenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_test_runs')
        .select('*')
        .eq('tenant_id', selectedTenant)
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as TestRun[];
    },
  });

  // Fetch steps for selected run
  const { data: runSteps } = useQuery({
    queryKey: ['operator-test-run-steps', selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_test_run_steps')
        .select('*')
        .eq('test_run_id', selectedRunId)
        .order('created_at');
      if (error) throw error;
      return data as TestRunStep[];
    },
  });

  // ─── Test Mutations ───

  const outlookTest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('outlook-connection-test', {
        body: { tenant_id: selectedTenant, environment },
      });
      if (error) throw error;
      return data as TestResult;
    },
    onSuccess: (data) => {
      toast[data.ok ? 'success' : 'error'](
        data.ok ? 'Outlook connection test passed' : 'Outlook connection test failed'
      );
      queryClient.invalidateQueries({ queryKey: ['operator-test-runs'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const unsubTest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('operator-unsubscribe-flow-test', {
        body: {
          tenant_id: selectedTenant,
          email: unsubEmail,
          campaign_id: unsubCampaignId || null,
          environment,
        },
      });
      if (error) throw error;
      return data as TestResult;
    },
    onSuccess: (data) => {
      toast[data.ok ? 'success' : 'error'](
        data.ok ? 'Unsubscribe flow test passed' : 'Unsubscribe flow test failed'
      );
      queryClient.invalidateQueries({ queryKey: ['operator-test-runs'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const suppressionTest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('operator-campaign-suppression-test', {
        body: { tenant_id: selectedTenant, email: suppressionEmail, environment },
      });
      if (error) throw error;
      return data as TestResult;
    },
    onSuccess: (data) => {
      toast[data.ok ? 'success' : 'error'](
        data.ok ? 'Suppression gate test passed' : 'Suppression gate test failed'
      );
      queryClient.invalidateQueries({ queryKey: ['operator-test-runs'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const copyResults = (run: TestRun) => {
    navigator.clipboard.writeText(JSON.stringify(run, null, 2));
    toast.success('Results copied to clipboard');
  };

  const suiteLabels: Record<string, string> = {
    outlook_connect: 'Outlook Connection',
    unsubscribe_flow: 'Unsubscribe Flow',
    campaign_suppression: 'Campaign Suppression',
  };

  const noTenant = !selectedTenant;

  return (
    <div className="space-y-6">
      {/* ─── Tenant + Environment Selector ─── */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Demo Tenant</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger><SelectValue placeholder="Select a demo tenant…" /></SelectTrigger>
                <SelectContent>
                  {demoTenants?.map((dt) => (
                    <SelectItem key={dt.tenant_id || dt.id} value={dt.tenant_id || dt.id}>
                      {dt.name} ({dt.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Test Cards ─── */}
      <div className="grid gap-4">
        {/* 1. Outlook Connection Test */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Outlook Connection Test</CardTitle>
              <Badge variant="outline" className="text-xs ml-auto">No Emails Sent</Badge>
            </div>
            <CardDescription>
              Verify OAuth connection, scopes, and Graph API access — without sending mail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => outlookTest.mutate()}
              disabled={noTenant || outlookTest.isPending}
              className="rounded-full"
              size="sm"
            >
              {outlookTest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run Test
            </Button>
            {outlookTest.data && (
              <TestResultDisplay result={outlookTest.data} />
            )}
          </CardContent>
        </Card>

        {/* 2. Unsubscribe Flow Test */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Unsubscribe Flow Test</CardTitle>
              <Badge variant="outline" className="text-xs ml-auto">No Emails Sent</Badge>
            </div>
            <CardDescription>
              Generate token, execute unsubscribe handler, verify suppression row and event log.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Test Email</Label>
                <Input
                  value={unsubEmail}
                  onChange={(e) => setUnsubEmail(e.target.value)}
                  placeholder="test.unsubscribe@cros.test"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Campaign ID (optional)</Label>
                <Input
                  value={unsubCampaignId}
                  onChange={(e) => setUnsubCampaignId(e.target.value)}
                  placeholder="Optional"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <Button
              onClick={() => unsubTest.mutate()}
              disabled={noTenant || !unsubEmail || unsubTest.isPending}
              className="rounded-full"
              size="sm"
            >
              {unsubTest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run Test
            </Button>
            {unsubTest.data && (
              <TestResultDisplay result={unsubTest.data} />
            )}
          </CardContent>
        </Card>

        {/* 3. Campaign Suppression Gate Test */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Campaign Suppression Gate Test</CardTitle>
              <Badge variant="outline" className="text-xs ml-auto">No Emails Sent</Badge>
            </div>
            <CardDescription>
              Verify suppressed recipients are excluded from campaign audience preflight.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1 max-w-sm">
              <Label className="text-xs">Test Email</Label>
              <Input
                value={suppressionEmail}
                onChange={(e) => setSuppressionEmail(e.target.value)}
                placeholder="test.unsubscribe@cros.test"
                className="h-8 text-sm"
              />
            </div>
            <Button
              onClick={() => suppressionTest.mutate()}
              disabled={noTenant || !suppressionEmail || suppressionTest.isPending}
              className="rounded-full"
              size="sm"
            >
              {suppressionTest.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run Test
            </Button>
            {suppressionTest.data && (
              <TestResultDisplay result={suppressionTest.data} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Operator Runbook ─── */}
      <Collapsible open={runbookOpen} onOpenChange={setRunbookOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Gardener Instructions</CardTitle>
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${runbookOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 text-sm">
              <RunbookSection
                title="Outlook Test — What accounts are needed?"
                content={[
                  "Minimum: ONE Outlook/Microsoft 365 mailbox (any tenant-owned mailbox).",
                  "Recommended: A dedicated sandbox mailbox (e.g., cros.operator.test@yourdomain.com).",
                  "No secondary recipient required — we only verify connection, scopes, and identity.",
                ]}
                steps={[
                  "Select demo tenant (e.g., demo-church-01)",
                  "Click \"Outlook Connection Test\"",
                  "Expected: Connection exists ✓, Required scopes present ✓",
                  "If 401/403: reconnect Outlook in that demo tenant's integration settings.",
                ]}
              />
              <Separator />
              <RunbookSection
                title="Unsubscribe Test — What accounts are needed?"
                content={[
                  "None. Use any test email string — no real mailbox required.",
                ]}
                steps={[
                  "Enter test email (e.g., test.unsubscribe@cros.test)",
                  "Click \"Unsubscribe Flow Test\"",
                  "Optionally click the generated link in a new tab to view the confirmation page",
                  "Expected: Token generated ✓, Unsubscribe executed ✓, Suppression verified ✓, Token marked used ✓",
                ]}
              />
              <Separator />
              <RunbookSection
                title="Campaign Suppression Test — What accounts are needed?"
                content={[
                  "None. No sending occurs.",
                ]}
                steps={[
                  "Use same test email from the unsubscribe test",
                  "Click \"Campaign Suppression Gate Test\"",
                  "Expected: Suppression record exists ✓, Preflight excludes email with reason \"unsubscribed\" ✓",
                  "Test fixture is automatically cleaned up after verification.",
                ]}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ─── Test History ─── */}
      {selectedTenant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test History</CardTitle>
            <CardDescription>Last 20 test runs for selected tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            {!testRuns?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No test runs yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Suite</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead className="hidden sm:table-cell">Summary</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testRuns.map((run) => (
                    <TableRow
                      key={run.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRunId(run.id)}
                    >
                      <TableCell className="text-xs">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>{formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}</TooltipTrigger>
                            <TooltipContent>{format(new Date(run.started_at), 'PPpp')}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs">{suiteLabels[run.suite_key] || run.suite_key}</TableCell>
                      <TableCell><StatusBadge status={run.status} /></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{run.environment}</Badge></TableCell>
                      <TableCell className="text-xs hidden sm:table-cell">
                        {run.summary && typeof run.summary === 'object'
                          ? Object.entries(run.summary as Record<string, unknown>)
                              .filter(([k]) => k !== 'email')
                              .map(([k, v]) => `${v} ${k}`)
                              .join(', ')
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); copyResults(run); }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Run Detail Modal ─── */}
      <Dialog open={!!selectedRunId} onOpenChange={(open) => { if (!open) setSelectedRunId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Test Run Steps</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {runSteps?.map((step) => (
              <div key={step.id} className="flex items-start gap-3 p-3 rounded-md border bg-muted/20">
                <StatusIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{step.label}</p>
                  <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                    {JSON.stringify(step.details, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
            {!runSteps?.length && (
              <p className="text-sm text-muted-foreground text-center py-4">Loading steps…</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (runSteps) {
                navigator.clipboard.writeText(JSON.stringify(runSteps, null, 2));
                toast.success('Steps copied');
              }
            }}
          >
            <Copy className="mr-2 h-3 w-3" /> Copy Steps JSON
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TestResultDisplay({ result }: { result: TestResult }) {
  return (
    <div className="space-y-2 mt-2 p-3 rounded-md border bg-muted/20">
      <div className="flex items-center gap-2">
        <StatusIcon status={result.status} />
        <span className="text-sm font-medium capitalize">{result.status}</span>
      </div>
      {result.checks.map((check) => (
        <div key={check.step_key} className="flex items-start gap-2 text-xs pl-6">
          <StatusIcon status={check.status} />
          <div className="min-w-0">
            <span className="font-medium">{check.label}</span>
            {check.status === 'failed' && check.details?.error && (
              <p className="text-destructive mt-0.5">{String(check.details.error)}</p>
            )}
            {check.status === 'failed' && check.details?.remediation && (
              <p className="text-muted-foreground mt-0.5">💡 {String(check.details.remediation)}</p>
            )}
            {check.status === 'passed' && check.details?.unsubscribe_url && (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-muted-foreground truncate max-w-[300px]">{String(check.details.unsubscribe_url)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => {
                    navigator.clipboard.writeText(String(check.details.unsubscribe_url));
                    toast.success('URL copied');
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RunbookSection({ title, content, steps }: { title: string; content: string[]; steps: string[] }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        {title}
      </h4>
      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
        {content.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
      <p className="font-medium text-xs mt-2">How to run:</p>
      <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}
