/**
 * OperatorNexusQA — QA & Stability workflow dashboard.
 *
 * WHAT: Platform health overview with QA run results and self-healing prompts.
 * WHERE: /operator/nexus/qa
 * WHY: Operators need a single view of platform stability and quick repair tools.
 */
import { useQuery } from '@tanstack/react-query';
import ImportReadinessNoticeCard from '@/components/relatio/ImportReadinessNoticeCard';
import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  ShieldCheck,
  TestTube2,
  Shield,
  XCircle,
} from 'lucide-react';
import { calmText, calmVariant } from '@/lib/calmMode';
import { toast } from '@/components/ui/sonner';
import { useMemo } from 'react';
import { runAllGuardrails, guardrailSummary, type GuardrailCheck } from '@/lib/guardrails';

function QAStatCard({ label, value, variant }: { label: string; value: number; variant?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground font-serif">{value}</p>
        {variant && (
          <Badge variant={calmVariant(variant)} className="mt-1 text-xs">
            {calmText(variant === 'error' ? 'Needs attention' : 'Healthy')}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function OperatorNexusQA() {
  const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const guardrailResults = useMemo(() => runAllGuardrails(), []);
  const summary = useMemo(() => guardrailSummary(guardrailResults), [guardrailResults]);

  // qa_run_results NOT in types.ts — keep as any
  const { data: failures24h, isLoading: l1 } = useQuery({
    queryKey: ['nexus-qa-failures-24h'],
    queryFn: async () => {
      const { count } = await untypedTable('qa_test_run_steps')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('started_at', now24h);
      return count ?? 0;
    },
  });

  const { data: passes24h, isLoading: l2 } = useQuery({
    queryKey: ['nexus-qa-passes-24h'],
    queryFn: async () => {
      const { count } = await untypedTable('qa_test_run_steps')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'passed')
        .gte('started_at', now24h);
      return count ?? 0;
    },
  });

  const { data: failingSuites, isLoading: l3 } = useQuery({
    queryKey: ['nexus-qa-failing-suites'],
    queryFn: async () => {
      const { data } = await untypedTable('qa_test_run_steps')
        .select('step_key, label, status, notes, started_at, run_id')
        .eq('status', 'failed')
        .gte('started_at', now7d)
        .order('started_at', { ascending: false })
        .limit(20);
      return (data as any[]) ?? [];
    },
  });

  // testimonium_events IS in types.ts
  const { data: driftCount, isLoading: l4 } = useQuery({
    queryKey: ['nexus-qa-drift-events'],
    queryFn: async () => {
      const { count } = await supabase
        .from('testimonium_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_kind', 'drift_detected')
        .gte('created_at', now7d);
      return count ?? 0;
    },
  });

  const { data: automationErrors, isLoading: l5 } = useQuery({
    queryKey: ['nexus-qa-automation-errors'],
    queryFn: async () => {
      const { count } = await supabase
        .from('automation_runs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', now24h);
      return count ?? 0;
    },
  });

  const isLoading = l1 || l2 || l3 || l4 || l5;

  const handleCopyPrompt = (suite: any) => {
    const prompt = `QA Failure Repair Prompt\n\nStep: ${suite.label || suite.step_key || 'unknown'}\nStatus: ${suite.status || 'failed'}\nNotes: ${suite.notes || 'No details'}\nRun: ${suite.run_id || 'unknown'}\n\nPlease investigate this failure and provide a targeted fix.`;
    navigator.clipboard.writeText(prompt);
    toast.success('Self-healing prompt copied');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground font-serif">QA & Stability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform health signals, test results, and repair workflows.
        </p>
      </div>

      {/* Health Summary */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Health Summary (24h)</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QAStatCard label="Tests Passing" value={passes24h ?? 0} variant="ok" />
            <QAStatCard label="Tests Failing" value={failures24h ?? 0} variant={(failures24h ?? 0) > 0 ? 'warning' : 'ok'} />
            <QAStatCard label="Automation Errors" value={automationErrors ?? 0} variant={(automationErrors ?? 0) > 0 ? 'warning' : 'ok'} />
            <QAStatCard label="Drift Flags (7d)" value={driftCount ?? 0} variant={(driftCount ?? 0) > 3 ? 'warning' : 'ok'} />
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section>
        <div className="flex flex-wrap gap-2">
          <Link to="/operator/qa">
            <Button variant="outline" size="sm" className="gap-1.5">
              <TestTube2 className="w-3.5 h-3.5" /> QA Employee Console
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
          <Link to="/operator/error-desk">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Error Desk
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
          <Link to="/operator/automation">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Automation Health
              <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Failing Suites */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Recent Failures (7 days)
        </h2>
        {l3 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : failingSuites && failingSuites.length > 0 ? (
          <div className="space-y-2">
            {failingSuites.map((suite: any, i: number) => (
              <Card key={i} className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                         <p className="text-sm font-medium text-foreground truncate">
                           {suite.label || suite.step_key || 'Unknown test'}
                         </p>
                       </div>
                       {suite.notes && (
                         <p className="text-xs text-muted-foreground line-clamp-2 ml-5.5">
                           {suite.notes}
                         </p>
                       )}
                       <p className="text-xs text-muted-foreground mt-1 ml-5.5">
                         {suite.started_at ? new Date(suite.started_at).toLocaleDateString() : '—'} · {suite.step_key}
                       </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1 text-xs"
                      onClick={() => handleCopyPrompt(suite)}
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                      Copy Fix
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3 text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <p className="text-sm">All clear — no failures in the last 7 days.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Import Readiness Notices */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Import Readiness
        </h2>
        <ImportReadinessNoticeCard />
      </section>

      {/* Architecture Guardrails */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Architecture Guardrails
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <QAStatCard label="Checks Passed" value={summary.passed} variant="ok" />
          <QAStatCard label="Checks Failed" value={summary.failed} variant={summary.failed > 0 ? 'error' : 'ok'} />
          <QAStatCard label="Warnings" value={summary.warnings} variant={summary.warnings > 0 ? 'warning' : 'ok'} />
          <QAStatCard label="Total Checks" value={summary.total} />
        </div>

        {Object.entries(guardrailResults).map(([group, checks]) => (
          <Card key={group} className="mb-3">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-serif capitalize">{group === 'nri' ? 'NRI Transparency' : group === 'addons' ? 'Add-on Registry Sync' : group === 'selectors' ? 'Selector Contracts' : 'Entitlement Integrity'}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 space-y-1.5">
              {checks.map((check: GuardrailCheck) => (
                <div key={check.id} className="flex items-start gap-2">
                  {check.status === 'pass' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  ) : check.status === 'warn' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
