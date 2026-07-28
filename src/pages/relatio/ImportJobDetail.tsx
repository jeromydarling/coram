/**
 * ImportJobDetail — View a specific import job's progress and events.
 *
 * WHAT: Job detail page with progress meters and event log.
 * WHERE: /relatio/jobs/:id
 * WHY: Transparency into what happened during an import.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantPath } from '@/hooks/useTenantPath';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ImportJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { tenantPath } = useTenantPath();
  const navigate = useNavigate();

  const { data: job, isLoading } = useQuery({
    queryKey: ['relatio-job', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatio_import_jobs')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'queued' ? 3000 : false;
    },
  });

  const { data: events } = useQuery({
    queryKey: ['relatio-job-events', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('relatio_import_events')
        .select('*')
        .eq('job_id', id!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      return job?.status === 'running' ? 3000 : false;
    },
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading…</div>;
  }

  if (!job) {
    return <div className="p-6 text-center text-muted-foreground">Job not found.</div>;
  }

  const progress = (job.progress || {}) as Record<string, unknown>;
  const counts = (progress.counts || {}) as Record<string, number>;
  const progressValue =
    job.status === 'completed' ? 100 :
    job.status === 'failed' ? 100 :
    job.status === 'running' ? 50 : 0;

  const levelIcon = {
    info: <Info className="h-3.5 w-3.5 text-blue-500" />,
    warn: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
    error: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate(tenantPath('/relatio'))} className="rounded-full">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Relatio
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl capitalize">{job.connector_key} Import</CardTitle>
              <CardDescription>
                {job.status === 'completed' && 'Import completed successfully.'}
                {job.status === 'failed' && 'Import encountered errors.'}
                {job.status === 'running' && 'Import is running…'}
                {job.status === 'queued' && 'Import is queued.'}
                {job.status === 'canceled' && 'Import was canceled.'}
              </CardDescription>
            </div>
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              job.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
              job.status === 'failed' && 'bg-destructive/10 text-destructive',
              job.status === 'running' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
              job.status === 'queued' && 'bg-muted text-muted-foreground',
              job.status === 'canceled' && 'bg-muted text-muted-foreground',
            )}>
              {job.status}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress
            value={progressValue}
            className={job.status === 'failed' ? '[&>div]:bg-destructive' : ''}
          />

          {Object.keys(counts).length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(counts).map(([k, v]) => (
                <div key={k} className="flex justify-between p-2 bg-muted/30 rounded text-sm">
                  <span className="capitalize">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            {job.started_at && <p>Started: {new Date(job.started_at).toLocaleString()}</p>}
            {job.completed_at && <p>Completed: {new Date(job.completed_at).toLocaleString()}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Event log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Log</CardTitle>
        </CardHeader>
        <CardContent>
          {!events?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">No events yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map((e: any) => (
                <div key={e.id} className="flex items-start gap-2 text-sm p-2 rounded bg-muted/20">
                  {levelIcon[e.level as keyof typeof levelIcon] || levelIcon.info}
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{e.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
