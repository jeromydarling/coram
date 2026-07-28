/**
 * ConnectorDryRunPanel — Validates all connector registrations and setup guides.
 *
 * WHAT: Runs dry-run checks across all 12+ connectors without real API accounts.
 * WHERE: Admin / Operator console, Demo Lab.
 * WHY: Ensures every connector has a complete registry entry, guide, credential mapping, and confirm step.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, PlayCircle, Loader2 } from 'lucide-react';
import { runAllDryRuns, type ConnectorDryRunResult, type DryRunCheck } from '@/lib/relatio/connectorDryRun';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

function StatusIcon({ status }: { status: DryRunCheck['status'] }) {
  if (status === 'pass') return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
  if (status === 'fail') return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
}

function ConnectorResultCard({ result }: { result: ConnectorDryRunResult }) {
  const passCount = result.checks.filter(c => c.status === 'pass').length;
  const failCount = result.checks.filter(c => c.status === 'fail').length;
  const warnCount = result.checks.filter(c => c.status === 'warn').length;

  return (
    <Card className={result.allPass ? 'border-green-200 dark:border-green-800/30' : failCount > 0 ? 'border-destructive/30' : ''}>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{result.label}</CardTitle>
          <div className="flex gap-1">
            {passCount > 0 && <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">{passCount} pass</Badge>}
            {warnCount > 0 && <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">{warnCount} warn</Badge>}
            {failCount > 0 && <Badge variant="destructive" className="text-xs">{failCount} fail</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 space-y-1">
        {result.checks.map(c => (
          <div key={c.name} className="flex items-start gap-2 text-xs">
            <StatusIcon status={c.status} />
            <span className="font-medium min-w-[120px]">{c.name.replace(/_/g, ' ')}</span>
            <span className="text-muted-foreground">{c.detail}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ConnectorDryRunPanel() {
  const [results, setResults] = useState<ConnectorDryRunResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    // Simulate async for UX (dry run is synchronous but we want the animation)
    setTimeout(() => {
      setResults(runAllDryRuns());
      setRunning(false);
    }, 600);
  };

  const totalConnectors = results?.length ?? 0;
  const allPass = results?.filter(r => r.allPass).length ?? 0;
  const hasFailures = results?.some(r => r.checks.some(c => c.status === 'fail'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Connector Dry-Run Validation</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                <strong>What:</strong> Tests every registered connector's registry entry, setup guide, credential mapping, and companion confirm step — without needing real API accounts.<br />
                <strong>Where:</strong> Run from admin or Demo Lab.<br />
                <strong>Why:</strong> Catches missing guides, broken credential forms, or incomplete setup flows before users encounter them.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button onClick={handleRun} disabled={running} className="rounded-full" size="sm">
          {running ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Validating…</>
          ) : (
            <><PlayCircle className="h-3.5 w-3.5 mr-1" /> Run All Checks</>
          )}
        </Button>
      </div>

      {results && (
        <>
          {/* Summary */}
          <div className="flex items-center gap-3 text-sm">
            <Badge variant={hasFailures ? 'destructive' : 'secondary'} className={!hasFailures ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : ''}>
              {allPass}/{totalConnectors} all pass
            </Badge>
            <span className="text-muted-foreground">
              {totalConnectors} connectors validated
            </span>
          </div>

          {/* Results grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {results.map(r => (
              <ConnectorResultCard key={r.connectorKey} result={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
