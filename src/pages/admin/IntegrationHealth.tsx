/**
 * IntegrationHealthPage — Admin page for connector confidence scores.
 *
 * WHAT: Shows simulation test results and connector health metrics.
 * WHERE: Admin → Integration Health.
 * WHY: Catch mapping regressions without manual vendor testing.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle, Activity, HelpCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

export default function IntegrationHealthPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: healthData, isLoading } = useQuery({
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

  const statusIcon = (status: string) => {
    if (status === 'ok' || status === 'passed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="space-y-6 pb-12">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                <p><strong>What:</strong> Simulated health scores for each connector.</p>
                <p><strong>Where:</strong> Admin → Integration Health.</p>
                <p><strong>Why:</strong> Catch regressions without vendor accounts.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex gap-2">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Activity className="h-4 w-4 mr-2" /> View Test Runs
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Recent Test Runs</SheetTitle>
                </SheetHeader>
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
              Run Sweep Now
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : !healthData?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No connector health data. Run a sweep to populate.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Connector</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sim Passed</TableHead>
                    <TableHead className="text-right">Sim Failed</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead className="hidden sm:table-cell">Last Error</TableHead>
                    <TableHead className="hidden md:table-cell">Last Checked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium capitalize">{row.connector_key}</TableCell>
                      <TableCell><Badge variant="outline">{row.environment}</Badge></TableCell>
                      <TableCell>{statusIcon(row.last_status)}</TableCell>
                      <TableCell className="text-right">{row.simulated_runs_passed ?? 0}</TableCell>
                      <TableCell className="text-right">{row.simulated_runs_failed ?? 0}</TableCell>
                      <TableCell className="text-right">{row.success_rate ?? 0}%</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{row.last_error_code ?? '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {row.last_checked_at ? format(new Date(row.last_checked_at), 'MMM d HH:mm') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
  );
}
