/**
 * ExpansionScenarioRunner — Admin UI for running Metro Expansion QA scenarios.
 *
 * WHAT: Triggers the expansion-scenario-runner edge function and displays results.
 * WHERE: Demo Lab → Expansion Scenarios tab.
 * WHY: Validates 8A–8D expansion features with evidence-backed reports.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Play, CheckCircle2, XCircle, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface ScenarioResult {
  scenario: string;
  ok: boolean;
  evidence: Record<string, unknown>;
  error?: string;
}

interface RunReport {
  ok: boolean;
  run_id: string;
  tenant_id: string;
  tenant_slug: string;
  metro_id: string;
  started_at: string;
  finished_at: string;
  results: ScenarioResult[];
  totals: {
    activation_logs_created: number;
    testimonium_events_created: number;
    notifications_created: number;
  };
  security_checks: {
    rls_isolation: string;
    forbidden_key_leak: string;
  };
}

export function ExpansionScenarioRunner({ tenantId }: { tenantId: string | null }) {
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [report, setReport] = useState<RunReport | null>(null);

  const { data: demoTenants } = useQuery({
    queryKey: ['demo-tenants-for-scenarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demo_tenants')
        .select('id, name, slug, tenant_id, seed_profile')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const target = demoTenants?.find((d) => d.id === selectedTenant);
      if (!target?.tenant_id) throw new Error('Select a demo tenant');
      const { data, error } = await supabase.functions.invoke('expansion-scenario-runner', {
        body: { tenant_id: target.tenant_id },
      });
      if (error) throw error;
      if (!data?.ok && data?.error) throw new Error(data.error);
      return data as RunReport;
    },
    onSuccess: (data) => setReport(data),
  });

  const passCount = report?.results.filter((r) => r.ok).length ?? 0;
  const totalCount = report?.results.length ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Metro Expansion Scenario Suite
            </CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs"><strong>What:</strong> Runs 7 deterministic expansion scenarios.</p>
                  <p className="text-xs"><strong>Where:</strong> Against any demo tenant.</p>
                  <p className="text-xs"><strong>Why:</strong> Validates activation stages, telemetry, privacy, and isolation.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Run all 7 expansion scenarios against a demo tenant to verify activation stages,
            telemetry capture, privacy guards, and tenant isolation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1 min-w-[200px]">
              <Label>Demo Tenant</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger><SelectValue placeholder="Select tenant…" /></SelectTrigger>
                <SelectContent>
                  {demoTenants?.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      {dt.name} ({dt.seed_profile})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => runMutation.mutate()}
              disabled={!selectedTenant || runMutation.isPending}
              className="rounded-full"
            >
              {runMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Run Expansion Scenarios
            </Button>
          </div>

          {runMutation.isError && (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {runMutation.error?.message}
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Scenario Report — {report.ok ? 'ALL PASSED' : 'SOME FAILED'}
              </CardTitle>
              <Badge variant={report.ok ? 'default' : 'destructive'}>
                {passCount}/{totalCount} passed
              </Badge>
            </div>
            <CardDescription className="text-xs space-y-1">
              <span>Tenant: {report.tenant_slug} · Metro: {report.metro_id?.slice(0, 8)}…</span>
              <br />
              <span>Run: {report.run_id?.slice(0, 8)}… · {new Date(report.finished_at).toLocaleString()}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scenario results table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4">Scenario</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-xs">{r.scenario}</td>
                      <td className="py-2 pr-4">
                        {r.ok ? (
                          <span className="flex items-center gap-1 text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> FAIL
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground font-mono max-w-[300px] truncate">
                        {r.error ? (
                          <span className="text-destructive">{r.error}</span>
                        ) : (
                          JSON.stringify(r.evidence)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Aggregate counts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold">{report.totals.activation_logs_created}</div>
                <div className="text-xs text-muted-foreground">Activation Logs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{report.totals.testimonium_events_created}</div>
                <div className="text-xs text-muted-foreground">Testimonium Events</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{report.totals.notifications_created}</div>
                <div className="text-xs text-muted-foreground">Notifications</div>
              </div>
            </div>

            {/* Security checks */}
            <div className="flex gap-4 pt-2">
              <Badge variant={report.security_checks.rls_isolation === 'PASS' ? 'default' : 'destructive'}>
                RLS Isolation: {report.security_checks.rls_isolation}
              </Badge>
              <Badge variant={report.security_checks.forbidden_key_leak === 'PASS' ? 'default' : 'destructive'}>
                Privacy Guard: {report.security_checks.forbidden_key_leak}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
