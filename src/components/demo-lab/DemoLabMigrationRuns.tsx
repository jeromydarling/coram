/**
 * DemoLabMigrationRuns — Lists migration runs with status and details.
 *
 * WHAT: Shows all migration runs for this tenant with filtering.
 * WHERE: Admin Demo Lab → Migration Harness tab.
 * WHY: Audit trail and debugging for migration operations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RotateCcw, Clock, HelpCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  tenantId: string | null;
}

export function DemoLabMigrationRuns({ tenantId }: Props) {
  const queryClient = useQueryClient();

  const { data: runs, isLoading } = useQuery({
    queryKey: ['migration-runs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('migration_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const rollbackMutation = useMutation({
    mutationFn: async (migrationRunId: string) => {
      const { data, error } = await supabase.functions.invoke('migration-rollback', {
        body: { migration_run_id: migrationRunId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Rollback failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Rolled back. ${data.deleted} records removed.`);
      queryClient.invalidateQueries({ queryKey: ['migration-runs'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'rolled_back': return <RotateCcw className="h-4 w-4 text-muted-foreground" />;
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Migration Runs</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p><strong>What:</strong> History of all migration dry-runs and commits.</p>
              <p><strong>Where:</strong> Scoped to current tenant.</p>
              <p><strong>Why:</strong> Full audit trail for data imports.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !runs?.length ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">
            No migration runs yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {runs.map((run) => {
            const results = run.results_summary as Record<string, { created?: number; skipped?: number; errors?: number }> | null;
            return (
              <Card key={run.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {statusIcon(run.status)}
                      <span className="font-medium text-sm">{run.connector_key}</span>
                      <Badge variant={run.mode === 'dry_run' ? 'secondary' : 'default'} className="text-xs">
                        {run.mode === 'dry_run' ? 'Dry Run' : 'Commit'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{run.environment}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(run.started_at).toLocaleString()}
                    </span>
                  </div>

                  {results && typeof results === 'object' && !Array.isArray(results) && (
                    <div className="flex gap-3 flex-wrap text-xs text-muted-foreground">
                      {Object.entries(results).map(([objType, counts]) => (
                        <span key={objType}>
                          {objType}: {counts?.created || 0} created, {counts?.skipped || 0} skipped
                          {(counts?.errors || 0) > 0 && <span className="text-destructive ml-1">{counts.errors} errors</span>}
                        </span>
                      ))}
                    </div>
                  )}

                  {run.status === 'completed' && run.mode === 'commit' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      onClick={() => rollbackMutation.mutate(run.id)}
                      disabled={rollbackMutation.isPending}
                    >
                      {rollbackMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
                      Rollback (demo only)
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
