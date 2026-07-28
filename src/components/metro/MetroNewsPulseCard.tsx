import { useMetroNewsPulse, useTriggerMetroNewsRun, useMetroNewsRuns, type PulseHealth } from '@/hooks/useMetroNewsRuns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, Clock, FileText, Zap, RefreshCw, HelpCircle, Newspaper } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

const healthConfig: Record<PulseHealth, { label: string; className: string; description: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-primary/15 text-primary border-primary/20',
    description: 'Running on schedule with articles flowing in.',
  },
  quiet: {
    label: 'Quiet',
    className: 'bg-muted text-muted-foreground',
    description: 'Ran recently but found no new articles. This may be normal.',
  },
  stale: {
    label: 'Stale',
    className: 'bg-chart-1/15 text-chart-1 border-chart-1/20',
    description: 'No completed run in the last 8 days.',
  },
};

interface Props {
  metroId?: string | null;
  showManualRun?: boolean;
}

export function MetroNewsPulseCard({ metroId, showManualRun }: Props) {
  const { data: pulse, isLoading: pulseLoading } = useMetroNewsPulse(metroId);
  const { data: runs, isLoading: runsLoading } = useMetroNewsRuns(metroId, 10);
  const triggerRun = useTriggerMetroNewsRun();
  const { roles } = useAuth();
  const canTrigger = showManualRun && roles?.some((r) => ['admin', 'leadership', 'regional_lead'].includes(r));

  if (pulseLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const health = pulse ? healthConfig[pulse.health] : healthConfig.stale;

  return (
    <div className="space-y-4">
      {/* Pulse summary card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Metro News Pulse
            </CardTitle>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[240px] text-xs">
                <p className="font-medium mb-1">What is this?</p>
                <p>Metro News runs silently in the background, discovering community signals to enrich Metro Narratives. This shows whether the pipeline is alive.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!pulse || !pulse.lastRun ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No runs yet</p>
              <p className="text-xs mt-1">Metro News will start discovering community signals on its next scheduled run.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Last run
                  </p>
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(pulse.lastRun.ran_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> This week
                  </p>
                  <p className="text-sm font-medium">
                    {pulse.weeklyArticlesPersisted} article{pulse.weeklyArticlesPersisted !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Newspaper className="h-3 w-3" /> In narrative
                  </p>
                  <p className="text-sm font-medium">
                    {pulse.narrativeUsedCount > 0
                      ? `Yes (${pulse.narrativeUsedCount})`
                      : 'Not yet'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Signal
                  </p>
                  <p className="text-sm font-medium">{pulse.signalStrength}/100</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={health.className}>
                  {health.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{health.description}</span>
              </div>
            </>
          )}
          {canTrigger && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={triggerRun.isPending || !metroId}
              onClick={() => {
                if (!metroId) return;
                triggerRun.mutate(metroId, {
                  onSuccess: () => toast.success('News run started'),
                  onError: (e) => toast.error(e.message),
                });
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${triggerRun.isPending ? 'animate-spin' : ''}`} />
              {triggerRun.isPending ? 'Running…' : 'Run Now'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Recent runs table */}
      {runs && runs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">When</TableHead>
                    {!metroId && <TableHead className="text-xs">Metro</TableHead>}
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Found</TableHead>
                    <TableHead className="text-xs text-right">Kept</TableHead>
                    <TableHead className="text-xs text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(run.ran_at), 'MMM d, h:mm a')}
                      </TableCell>
                      {!metroId && (
                        <TableCell className="text-xs">{run.metro_name || '—'}</TableCell>
                      )}
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            run.status === 'completed'
                              ? 'bg-primary/15 text-primary'
                              : run.status === 'failed'
                              ? 'bg-destructive/15 text-destructive'
                              : 'bg-chart-1/15 text-chart-1'
                          }
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">{run.articles_found}</TableCell>
                      <TableCell className="text-xs text-right">{run.articles_persisted}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
