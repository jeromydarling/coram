import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, RotateCcw, Loader2, DollarSign, Info, Clock, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useRunDetail, isBillableStatus, billableLabel } from '@/hooks/useRunDetail';
import { useRetryRun } from '@/hooks/useAutomationHealth';
import { useAuth } from '@/contexts/AuthContext';
import {
  workflowLabel,
  statusVariant,
  statusLabel,
  formatTimestamp,
  formatDuration,
} from '@/lib/automationHealthFormatters';

interface RunDetailDrawerProps {
  runId: string | null;
  open: boolean;
  onClose: () => void;
}

export function RunDetailDrawer({ runId, open, onClose }: RunDetailDrawerProps) {
  const { data, isLoading } = useRunDetail(runId);
  const { retryRun, retryingRunId } = useRetryRun();
  const { hasAnyRole } = useAuth();
  const canRetry = hasAnyRole(['admin', 'leadership', 'regional_lead']);

  const run = data?.run;
  const usageEvents = data?.usageEvents ?? [];

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const durationSec = run?.processed_at
    ? (new Date(run.processed_at).getTime() - new Date(run.created_at).getTime()) / 1000
    : null;

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">Run Detail</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {runId?.slice(0, 8)}…
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && !run && (
          <p className="text-sm text-muted-foreground py-6">Run not found</p>
        )}

        {run && (
          <div className="space-y-4 mt-4">
            {/* Status + Billable */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={isBillableStatus(run.status) ? 'default' : 'outline'}
                    className="text-xs gap-1 cursor-help"
                  >
                    <DollarSign className="w-3 h-3" />
                    {isBillableStatus(run.status) ? 'Billable' : 'Not billable'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">{billableLabel(run.status)}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Key info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailField label="Workflow" value={workflowLabel(run.workflow_key)} />
              <DetailField label="Created" value={formatTimestamp(run.created_at)} />
              <DetailField label="Duration" value={formatDuration(durationSec)} />
              <DetailField label="Triggered by" value={run.triggered_by || '—'} />
              <DetailField label="Org" value={run.org_name || run.org_id?.slice(0, 8) || '—'} />
              <DetailField label="Metro" value={run.metro_id?.slice(0, 8) || '—'} />
            </div>

            {/* IDs */}
            <div className="space-y-1">
              <CopyableId label="Run ID" value={run.run_id} onCopy={copyText} />
              {run.parent_run_id && <CopyableId label="Parent Run" value={run.parent_run_id} onCopy={copyText} />}
              {run.inputs_hash && <CopyableId label="Inputs Hash" value={run.inputs_hash} onCopy={copyText} />}
              {run.payload_fingerprint && <CopyableId label="Fingerprint" value={run.payload_fingerprint} onCopy={copyText} />}
            </div>

            {/* Error */}
            {run.error_message && (
              <Card className="border-destructive/30">
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs flex items-center gap-1 text-destructive">
                    <AlertTriangle className="w-3 h-3" /> Error
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs font-mono whitespace-pre-wrap break-all">{run.error_message}</p>
                </CardContent>
              </Card>
            )}

            {/* Payload summary (redacted) */}
            {run.payload && (
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs">Payload Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto max-h-40">
                    {JSON.stringify(redactPayload(run.payload), null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {/* Linked usage events */}
            <Separator />
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Linked Usage Events ({usageEvents.length})
              </h4>
              {usageEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No usage events recorded for this run</p>
              ) : (
                <div className="space-y-1.5">
                  {usageEvents.map(ue => (
                    <div key={ue.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                      <span>{ue.event_type}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">
                          {ue.quantity} {ue.unit}
                        </Badge>
                        <span className="text-muted-foreground">{formatTimestamp(ue.occurred_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            {canRetry && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={retryingRunId === run.run_id}
                    onClick={() => retryRun(run.run_id, 'retry')}
                  >
                    {retryingRunId === run.run_id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <RotateCcw className="w-3 h-3 mr-1" />
                    )}
                    Retry
                  </Button>
                  {run.workflow_key.startsWith('watchlist') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={retryingRunId === run.run_id}
                      onClick={() => retryRun(run.run_id, 'force_crawl')}
                    >
                      Force Crawl
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}

function CopyableId({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string, l: string) => void }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono">{value.slice(0, 12)}…</span>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onCopy(value, label)}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/** Redact sensitive fields from payload for display */
function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  const sensitiveKeys = new Set(['api_key', 'token', 'secret', 'password', 'authorization']);
  for (const [key, value] of Object.entries(payload)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactPayload(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
