import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useWorkflowResults } from '@/hooks/useWorkflowResults';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useWatchlistSignals } from '@/hooks/useWatchlistSignals';
import { AutomationRunsTable } from './AutomationRunsTable';
import { useRetryRun } from '@/hooks/useAutomationHealth';
import { workflowLabel } from '@/lib/automationHealthFormatters';
import { AUTOMATION_WORKFLOW_KEYS } from '@/lib/automationWorkflowKeys';
import { useAuth } from '@/contexts/AuthContext';

function RecommendationsOutputPanel() {
  const { data: recs, isLoading } = useRecommendations();

  if (isLoading) return <LoadingCard />;

  return (
    <div className="space-y-2">
      {!recs?.length ? (
        <EmptyState message="No recommendations generated yet" />
      ) : (
        recs.map((r) => (
          <Card key={r.id} className="border-l-4 border-l-primary/40">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{r.title}</p>
                <Badge variant={r.priority === 'high' ? 'destructive' : r.priority === 'low' ? 'outline' : 'secondary'} className="text-xs">
                  {r.priority ?? 'medium'}
                </Badge>
              </div>
              {r.body && <p className="text-sm text-muted-foreground line-clamp-2">{r.body}</p>}
              <p className="text-xs text-muted-foreground font-mono">run: {r.run_id.slice(0, 8)}</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function WatchlistSignalsOutputPanel() {
  const { data: signals, isLoading } = useWatchlistSignals(168);

  if (isLoading) return <LoadingCard />;

  return (
    <div className="space-y-2">
      {!signals?.length ? (
        <EmptyState message="No watchlist signals in past 7 days" />
      ) : (
        signals.slice(0, 10).map((s) => (
          <Card key={s.id} className="border-l-4 border-l-accent/40">
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{s.summary}</p>
                <Badge variant="outline" className="text-xs">{Math.round(s.confidence * 100)}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.signal_type} · {new Date(s.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function WorkflowRunsTab({ workflowKey }: { workflowKey: string }) {
  const { data: runs, isLoading } = useWorkflowResults(workflowKey);
  const { retryRun, retryingRunId } = useRetryRun();
  const { hasAnyRole } = useAuth();
  const canRetry = hasAnyRole(['admin', 'leadership', 'regional_lead']);

  if (isLoading) return <LoadingCard />;

  return (
    <AutomationRunsTable
      runs={runs ?? []}
      emptyMessage={`No ${workflowLabel(workflowKey)} runs yet`}
      showRetry={canRetry}
      onRetry={retryRun}
      retryingRunId={retryingRunId}
    />
  );
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-6 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}

export function WorkflowResultsPanel() {
  const [activeTab, setActiveTab] = useState('partner_enrich');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:flex-wrap md:w-auto">
            {AUTOMATION_WORKFLOW_KEYS.map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs whitespace-nowrap">
                {workflowLabel(key)}
              </TabsTrigger>
            ))}
            <TabsTrigger value="recommendations_output" className="text-xs whitespace-nowrap">
              Recs Output
            </TabsTrigger>
            <TabsTrigger value="watchlist_output" className="text-xs whitespace-nowrap">
              Signals
            </TabsTrigger>
          </TabsList>
        </div>

        {AUTOMATION_WORKFLOW_KEYS.map((key) => (
          <TabsContent key={key} value={key}>
            <WorkflowRunsTab workflowKey={key} />
          </TabsContent>
        ))}

        <TabsContent value="recommendations_output">
          <RecommendationsOutputPanel />
        </TabsContent>

        <TabsContent value="watchlist_output">
          <WatchlistSignalsOutputPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
