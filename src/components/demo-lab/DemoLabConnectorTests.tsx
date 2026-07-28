/**
 * DemoLabConnectorTests — In-browser connector adapter test runner with error logging + repair prompts.
 *
 * WHAT: Runs all connector adapter fixture + contract tests, logs failures to Error Desk, generates repair prompts.
 * WHERE: Demo Lab → Connector Tests tab.
 * WHY: Validates CRM normalization logic with the same operator observability as QA Employee.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  HelpCircle, Play, CheckCircle2, XCircle, Loader2, Copy,
  ChevronDown, FlaskConical, AlertTriangle
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { logOperatorError } from '@/lib/operatorErrorCapture';
import { runConnectorTests, type ConnectorTestRun, type ConnectorTestStep } from '@/lib/connectorTestRunner';
import { buildConnectorStepPrompt, buildConnectorRunPrompt } from '@/lib/connectorTestPromptBuilder';

function StatusIcon({ status }: { status: string }) {
  if (status === 'passed') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
}

export function DemoLabConnectorTests() {
  const [runs, setRuns] = useState<ConnectorTestRun[]>([]);
  const [running, setRunning] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      // Run tests synchronously (they're in-memory, fast)
      const result = runConnectorTests();
      setRuns(prev => [result, ...prev].slice(0, 20));
      setExpandedRun(result.run_id);

      // Log failures to Error Desk
      const failures = result.steps.filter(s => s.status === 'failed');
      for (const step of failures) {
        logOperatorError({
          source: 'integration',
          message: `Connector test failed: ${step.label} — ${step.error_message || 'unknown'}`,
          stack: step.stack,
          route: '/operator/platform?tab=demo',
          extra: {
            test_step_key: step.step_key,
            adapter_key: step.adapter_key,
            entity: step.entity,
            test_run_id: result.run_id,
          },
        });
      }

      if (failures.length === 0) {
        toast.success(`All ${result.total} connector tests passed ✅`);
      } else {
        toast.error(`${failures.length} of ${result.total} tests failed`);
      }
    } catch (err) {
      toast.error('Test runner crashed: ' + String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  const copyStepPrompt = (step: ConnectorTestStep) => {
    const prompt = buildConnectorStepPrompt(step);
    navigator.clipboard.writeText(prompt);
    toast.success('Repair prompt copied');
  };

  const copyRunPrompt = (run: ConnectorTestRun) => {
    const prompt = buildConnectorRunPrompt(run);
    navigator.clipboard.writeText(prompt);
    toast.success('Bulk repair prompt copied');
  };

    return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Connector Adapter Tests</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p><strong>What:</strong> In-browser fixture + contract tests for all CRM connector adapters.</p>
                  <p><strong>Where:</strong> Demo Lab → Connector Tests.</p>
                  <p><strong>Why:</strong> Validates normalization logic. Failures are logged to Error Desk with auto-generated repair prompts.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Run fixture, contract, and bi-directional sync tests for all 24+ connector adapters including Salesforce ⇆ and Dynamics 365 ⇆ outbound denormalization and conflict detection. Failures log to Error Desk with self-healing repair prompts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRun}
            disabled={running}
            className="rounded-full"
            size="sm"
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run All Connector Tests
          </Button>
        </CardContent>
      </Card>

      {/* Explainer: What these tests validate */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            How These Tests Provide Assurance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">What the tests validate</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Entity mapping (inbound)</strong> — Every adapter is tested for correct mapping of accounts, contacts, tasks, events, and activities from the vendor's schema to CROS's normalized format.</li>
              <li><strong>Data normalization</strong> — Emails are lowercased, dates are ISO-formatted, phone numbers are cleaned, and states are standardized (e.g. "California" → "CA").</li>
              <li><strong>Orphan detection</strong> — Contacts referencing non-existent accounts are flagged with mapping warnings rather than silently dropped.</li>
              <li><strong>Contract compliance</strong> — Every adapter implements the full <code>ConnectorAdapter</code> interface: <code>mapAccounts</code>, <code>mapContacts</code>, <code>mapTasks</code>, <code>mapEvents</code>, <code>mapActivities</code>, and <code>metadata()</code>.</li>
              <li><strong>Schema resilience</strong> — Tests include edge cases: empty arrays, missing optional fields, malformed dates, and null values.</li>
              <li><strong>Outbound denormalization (⇆)</strong> — For Salesforce and Dynamics 365, tests verify that CROS entities are correctly reverse-mapped to vendor-specific API formats for both create (POST) and update (PATCH) operations.</li>
              <li><strong>Conflict detection (⇆)</strong> — Tests verify that field-level differences between CROS data and remote vendor data are flagged for steward review rather than silently overwritten.</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground mb-1">Why you don't need live CRM accounts</p>
            <p>
              These tests use <strong>deterministic fixture data</strong> — carefully crafted JSON payloads that mirror the exact shape of each vendor's API response. The fixtures cover:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong>Happy path</strong> — Standard records with all fields populated.</li>
              <li><strong>Edge cases</strong> — Missing emails, null phones, orphaned contacts, empty result sets, inactive statecodes (Dynamics 365).</li>
              <li><strong>Schema drift</strong> — Extra or renamed fields that real APIs sometimes return.</li>
              <li><strong>Outbound round-trip</strong> — CROS data is denormalized to vendor format and tested for correct endpoint, method, and body structure.</li>
            </ul>
            <p className="mt-2">
              Because the adapters are pure functions (API response → normalized CROS data, and CROS data → vendor payload), the mapping logic is fully testable without network calls. The fixtures are modeled from real API documentation and sample responses from each vendor (Salesforce, HubSpot, Planning Center, Dynamics 365, etc.).
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground mb-1">What's NOT tested here</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Authentication</strong> — OAuth/API key flows are tested at the edge function layer, not in adapter logic.</li>
              <li><strong>Rate limiting</strong> — Handled by the sync runner, not by individual adapters.</li>
              <li><strong>Network reliability</strong> — Retries and timeouts are the sync runner's responsibility.</li>
              <li><strong>Live outbound writes</strong> — Actual vendor API calls for Salesforce ⇆ and Dynamics 365 ⇆ are tested via edge function integration tests, not here.</li>
            </ul>
            <p className="mt-2 text-xs italic">
              If all tests pass, you can be confident that when live data arrives from any supported CRM, it will be correctly normalized into CROS relationships, contacts, and activities — without manual QA against each vendor.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {runs.map((run) => {
        const failures = run.steps.filter(s => s.status === 'failed');
        const isExpanded = expandedRun === run.run_id;
        const allPassed = failures.length === 0;

        // Group by adapter
        const byAdapter = new Map<string, ConnectorTestStep[]>();
        for (const step of run.steps) {
          const list = byAdapter.get(step.adapter_key) || [];
          list.push(step);
          byAdapter.set(step.adapter_key, list);
        }

        return (
          <Card key={run.run_id}>
            <Collapsible open={isExpanded} onOpenChange={() => setExpandedRun(isExpanded ? null : run.run_id)}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {allPassed
                        ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                        : <XCircle className="h-5 w-5 text-destructive" />}
                      <div className="text-left">
                        <CardTitle className="text-sm">
                          {allPassed ? 'All Passed' : `${failures.length} Failed`}
                          <span className="ml-2 font-normal text-muted-foreground">
                            ({run.passed}/{run.total} passed)
                          </span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(run.started_at).toLocaleString()} · {run.run_id}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!allPassed && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          onClick={(e) => { e.stopPropagation(); copyRunPrompt(run); }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copy bulk fix
                        </Button>
                      )}
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {/* Summary badges */}
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="default" className="text-xs">{run.passed} passed</Badge>
                    {run.failed > 0 && <Badge variant="destructive" className="text-xs">{run.failed} failed</Badge>}
                    {run.skipped > 0 && <Badge variant="secondary" className="text-xs">{run.skipped} skipped</Badge>}
                  </div>

                  {/* Steps grouped by adapter */}
                  {Array.from(byAdapter.entries()).map(([adapterKey, steps]) => {
                    const adapterFails = steps.filter(s => s.status === 'failed');
                    const adapterPassed = adapterFails.length === 0;

                    return (
                      <div key={adapterKey} className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {adapterPassed
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                          <span>{adapterKey}</span>
                          <span className="text-xs text-muted-foreground">
                            ({steps.filter(s => s.status === 'passed').length}/{steps.length})
                          </span>
                        </div>
                        {/* Only show failed steps to reduce noise */}
                        {adapterFails.map((step) => (
                          <div
                            key={step.step_key}
                            className="ml-6 flex items-start gap-2 py-1.5 border-l-2 border-destructive/30 pl-3"
                          >
                            <StatusIcon status={step.status} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium">{step.label}</div>
                              <div className="text-xs text-destructive truncate">{step.error_message}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs shrink-0"
                              onClick={() => copyStepPrompt(step)}
                            >
                              <Copy className="h-3 w-3 mr-1" /> Fix
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  {allPassed && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      All {run.total} tests passed — no repair needed. ✅
                    </p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      {runs.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No test runs yet. Click "Run All Connector Tests" above.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
