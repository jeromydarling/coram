/**
 * SyncHistoryPanel — Shows sync job history for a tenant's connector.
 *
 * WHAT: Timeline of import/export jobs with status, counts, and rollback.
 * WHERE: RelatioMarketplace and admin views.
 * WHY: Human-first visibility into migration history.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Undo2, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useTenant } from '@/contexts/TenantContext';

interface SyncJob {
  id: string;
  connector_key: string;
  direction: string;
  mode: string;
  status: string;
  summary: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
}

interface SyncHistoryPanelProps {
  connectorKey?: string;
  limit?: number;
}

export function SyncHistoryPanel({ connectorKey, limit = 10 }: SyncHistoryPanelProps) {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['relatio-sync-jobs', tenantId, connectorKey],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from('relatio_sync_jobs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (connectorKey) {
        q = q.eq('connector_key', connectorKey);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as SyncJob[];
    },
    enabled: !!tenantId,
  });

  const rollbackMutation = useMutation({
    mutationFn: async (syncJobId: string) => {
      const { data, error } = await supabase.functions.invoke('relatio-rollback', {
        body: { sync_job_id: syncJobId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relatio-sync-jobs'] });
      toast.success('Rollback complete.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Rollback failed.');
    },
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!jobs?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm italic">
          No sync history yet. Stories will grow as you connect.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card key={job.id}>
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3 min-w-0">
              {statusIcon(job.status)}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {job.connector_key} — {job.mode === 'dry_run' ? 'Preview' : 'Import'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(job.started_at).toLocaleDateString()}{' '}
                  {job.summary && typeof job.summary === 'object' && 'created' in job.summary && (
                    <span>· {String(job.summary.created)} created</span>
                  )}
                </p>
              </div>
            </div>
            {job.mode === 'commit' && job.status === 'completed' && !(job.summary as any)?.rolled_back && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => rollbackMutation.mutate(job.id)}
                disabled={rollbackMutation.isPending}
                className="rounded-full text-xs"
              >
                <Undo2 className="h-3 w-3 mr-1" /> Undo
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
