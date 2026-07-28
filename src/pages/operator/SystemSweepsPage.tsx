/**
 * SystemSweepsPage — Full pipeline sweep scoreboard.
 *
 * WHAT: Run and view system sweeps with green/red scoreboard.
 * WHERE: /operator/sweeps
 * WHY: Proves the entire CROS pipeline works end-to-end.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import { Play, Loader2, CheckCircle2, XCircle, Copy, Download, HelpCircle, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface SystemSweep {
  id: string;
  sweep_key: string;
  status: string;
  steps: { name: string; status: string; duration_ms: number; error?: string; details?: Record<string, unknown> }[];
  scoreboard: Record<string, boolean>;
  stats: Record<string, number>;
  started_at: string;
  completed_at: string | null;
}

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1 cursor-help" /></TooltipTrigger>
        <TooltipContent className="max-w-xs"><p className="text-xs">{text}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const STEP_LABELS: Record<string, string> = {
  seed_check: 'Seed Data',
  simulation: 'Simulation',
  migration_check: 'Migration',
  testimonium_rollup: 'Testimonium',
  operator_refresh: 'Operator Refresh',
  communio_privacy: 'Privacy Check',
  tenant_isolation: 'Tenant Isolation',
};

export default function SystemSweepsPage() {
  const queryClient = useQueryClient();
  const [selectedDemoTenant, setSelectedDemoTenant] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('church_small');

  const { data: demoTenants } = useQuery({
    queryKey: ['demo-tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demo_tenants').select('id, name, slug, tenant_id');
      if (error) throw error;
      return data;
    },
  });

  const { data: sweeps } = useQuery({
    queryKey: ['system-sweeps'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_sweeps').select('*').order('started_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data as unknown as SystemSweep[];
    },
  });

  const sweepMutation = useMutation({
    mutationFn: async () => {
      const tenant = demoTenants?.find(t => t.id === selectedDemoTenant);
      if (!tenant) throw new Error('Select a demo tenant');
      const { data, error } = await supabase.functions.invoke('system-sweep-run', {
        body: { tenant_id: tenant.tenant_id, demo_tenant_id: selectedDemoTenant, sweep_key: `sweep-${Date.now()}`, scenario_key: selectedScenario },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      const allPass = d?.ok;
      if (allPass) toast.success('Sweep completed — all checks passed!');
      else toast.warning('Sweep completed with failures');
      queryClient.invalidateQueries({ queryKey: ['system-sweeps'] });
    },
    onError: (e) => toast.error(`Sweep failed: ${e.message}`),
  });

  const latestSweep = sweeps?.[0];

  const copyResults = () => {
    if (!latestSweep) return;
    navigator.clipboard.writeText(JSON.stringify({ scoreboard: latestSweep.scoreboard, steps: latestSweep.steps, stats: latestSweep.stats }, null, 2));
    toast.success('Copied to clipboard');
  };

  const exportJSON = () => {
    if (!latestSweep) return;
    const blob = new Blob([JSON.stringify(latestSweep, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sweep-${latestSweep.id.slice(0, 8)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Sweeps</h1>
        <p className="text-muted-foreground text-sm">Run full pipeline validation and view green/red scoreboard.</p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader><CardTitle className="text-base">Run Full Sweep <HelpTip text="Validates seed → simulate → migrate → rollup → privacy → isolation in one pass." /></CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedDemoTenant} onValueChange={setSelectedDemoTenant}>
              <SelectTrigger><SelectValue placeholder="Select demo tenant..." /></SelectTrigger>
              <SelectContent>
                {demoTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="church_small">Church (Small)</SelectItem>
                <SelectItem value="gov_medium">Government (Medium)</SelectItem>
                <SelectItem value="coalition_large">Coalition (Large)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => sweepMutation.mutate()} disabled={!selectedDemoTenant || sweepMutation.isPending}>
            {sweepMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Run Full Sweep
          </Button>
        </CardContent>
      </Card>

      {/* Scoreboard */}
      {latestSweep && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                Scoreboard
                <Badge variant={latestSweep.status === 'completed' ? 'default' : 'destructive'}>{latestSweep.status}</Badge>
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={copyResults}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
                <Button size="sm" variant="ghost" onClick={exportJSON}><Download className="h-3.5 w-3.5 mr-1" /> Export</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {Object.entries(latestSweep.scoreboard).map(([key, passed]) => (
                <div key={key} className={`flex items-center gap-2 p-3 rounded-lg border ${passed ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'}`}>
                  {passed ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                  <span className="text-sm font-medium">{STEP_LABELS[key] ?? key}</span>
                </div>
              ))}
            </div>

            {/* Steps detail */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Step Details</h3>
              {latestSweep.steps.map((step, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 border rounded text-sm">
                  <div className="flex items-center gap-2">
                    {step.status === 'passed' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    <span>{STEP_LABELS[step.name] ?? step.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{step.duration_ms}ms</span>
                    {step.error && <span className="text-red-500 max-w-48 truncate">{step.error}</span>}
                  </div>
                </div>
              ))}
            </div>

            {latestSweep.started_at && (
              <p className="text-xs text-muted-foreground mt-4">
                Started {format(new Date(latestSweep.started_at), 'MMM d, yyyy HH:mm:ss')}
                {latestSweep.stats?.total_duration_ms && ` · ${latestSweep.stats.total_duration_ms}ms total`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Smoke Checklist */}
      <Card>
        <CardHeader><CardTitle className="text-base">Smoke Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {['Seeded', 'Simulation', 'Migration', 'Rollup', 'Operator Refresh', 'Communio', 'Privacy'].map(item => {
              const key = item.toLowerCase().replace(/ /g, '_');
              const scoreKey = Object.keys(latestSweep?.scoreboard ?? {}).find(k => k.includes(key));
              const passed = scoreKey ? latestSweep?.scoreboard[scoreKey] : undefined;
              return (
                <div key={item} className="flex items-center gap-2 text-sm">
                  {passed === true ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : passed === false ? <XCircle className="h-4 w-4 text-red-500" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                  {item}
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={copyResults} disabled={!latestSweep}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy Results
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
