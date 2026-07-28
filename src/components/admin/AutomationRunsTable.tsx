import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Copy, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { AutomationRun } from '@/hooks/useAutomationHealth';
import {
  formatTimestamp,
  formatDuration,
  truncateError,
  workflowLabel,
  statusVariant,
  statusLabel,
} from '@/lib/automationHealthFormatters';

interface Props {
  runs: AutomationRun[];
  emptyMessage: string;
  showRetry?: boolean;
  onRetry?: (runId: string, mode?: 'retry' | 'force_crawl') => Promise<void>;
  retryingRunId?: string | null;
}

function durationSeconds(run: AutomationRun): number | null {
  if (!run.processed_at) return null;
  return (new Date(run.processed_at).getTime() - new Date(run.created_at).getTime()) / 1000;
}

export function AutomationRunsTable({ runs, emptyMessage, showRetry, onRetry, retryingRunId }: Props) {
  const [confirmRunId, setConfirmRunId] = useState<string | null>(null);

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  const copyRunId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Run ID copied');
  };

  const handleRetryConfirm = async () => {
    if (confirmRunId && onRetry) {
      await onRetry(confirmRunId, 'retry');
    }
    setConfirmRunId(null);
  };

  return (
    <>
      {/* Mobile card layout */}
      <div className="md:hidden space-y-2">
        {runs.map(run => (
          <Card key={run.run_id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <span>{run.run_id.slice(0, 8)}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyRunId(run.run_id)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Badge variant={statusVariant(run.status)} className="text-xs">{statusLabel(run.status)}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{workflowLabel(run.workflow_key)}</span>
                <span className="text-xs text-muted-foreground">{formatTimestamp(run.created_at)}</span>
              </div>
              {run.error_message && (
                <p className="text-xs text-destructive line-clamp-2">{truncateError(run.error_message)}</p>
              )}
              {showRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 w-full"
                  disabled={retryingRunId === run.run_id}
                  onClick={() => setConfirmRunId(run.run_id)}
                >
                  {retryingRunId === run.run_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Retry
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table layout */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Error</TableHead>
                  {showRetry && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(run => (
                  <TableRow key={run.run_id}>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span>{run.run_id.slice(0, 8)}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyRunId(run.run_id)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{workflowLabel(run.workflow_key)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(run.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(durationSeconds(run))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={run.error_message || ''}>
                      {truncateError(run.error_message)}
                    </TableCell>
                    {showRetry && (
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={retryingRunId === run.run_id}
                          onClick={() => setConfirmRunId(run.run_id)}
                        >
                          {retryingRunId === run.run_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Retry
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmRunId} onOpenChange={() => setConfirmRunId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry stuck run?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new run with the same payload and dispatch it to n8n.
              The original run will remain for audit purposes.
              <br /><br />
              <span className="font-mono text-xs">Run ID: {confirmRunId?.slice(0, 8)}…</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryConfirm}>Retry</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
