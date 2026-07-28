import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AutomationHealthData } from '@/hooks/useAutomationHealth';
import {
  formatDuration,
  formatErrorRate,
  formatRelativeTime,
  workflowLabel,
  statusVariant,
} from '@/lib/automationHealthFormatters';
import { Activity, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  data: AutomationHealthData;
}

export function AutomationHealthSummary({ data }: Props) {
  const totalRuns = data.counts_by_workflow.reduce((a, c) => a + c.total, 0);
  const totalErrors = data.counts_by_workflow.reduce((a, c) => a + c.error, 0);
  const stuckCount = data.stuck_runs.length;

  const avgDuration = data.avg_duration_seconds_by_workflow.length > 0
    ? data.avg_duration_seconds_by_workflow.reduce((a, c) => a + (c.avg_duration_seconds ?? 0), 0) / data.avg_duration_seconds_by_workflow.length
    : null;

  const overallErrorRate = totalRuns > 0
    ? Math.round((totalErrors / totalRuns) * 1000) / 10
    : 0;

  return (
    <div className="space-y-4">
      {/* Top-level summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRuns}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overallErrorRate > 10 ? 'text-destructive' : ''}`}>
              {formatErrorRate(overallErrorRate)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stuck Runs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stuckCount > 0 ? 'text-amber-600' : ''}`}>
              {stuckCount}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgDuration)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-workflow latest status */}
      {data.latest_by_workflow.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.latest_by_workflow.map(run => {
            const counts = data.counts_by_workflow.find(c => c.workflow_key === run.workflow_key);
            const errRate = data.error_rate_by_workflow.find(e => e.workflow_key === run.workflow_key);
            const dur = data.avg_duration_seconds_by_workflow.find(d => d.workflow_key === run.workflow_key);

            return (
              <Card key={run.workflow_key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    {workflowLabel(run.workflow_key)}
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>Last run: {formatRelativeTime(run.created_at)}</p>
                  <p>Runs: {counts?.total ?? 0} | Errors: {counts?.error ?? 0} ({formatErrorRate(errRate?.error_rate ?? 0)})</p>
                  <p>Avg duration: {formatDuration(dur?.avg_duration_seconds ?? null)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
