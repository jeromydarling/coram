/**
 * OperatorAutomationPage — Workflows, runs, usage, and ops feed.
 *
 * WHAT: Consolidated automation monitoring for the operator.
 * WHERE: /operator/automation
 * WHY: All workflow/run data belongs at operator level, not tenant admin.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowResultsPanel } from '@/components/admin/WorkflowResultsPanel';
import { UsageDashboardPanel } from '@/components/admin/UsageDashboardPanel';
import { OpsControlsPanel } from '@/components/admin/OpsControlsPanel';
import { OpsFeedPanel } from '@/components/admin/OpsFeedPanel';
import { LearningDashboardPanel } from '@/components/dashboard/LearningDashboardPanel';
import { useTabPersistence } from '@/hooks/useTabPersistence';

export default function OperatorAutomationPage() {
  const { activeTab, setActiveTab } = useTabPersistence('results');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Automation</h1>
        <p className="text-sm text-muted-foreground">Background tending — rhythms, results, and gentle corrections.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="results" className="whitespace-nowrap">Results</TabsTrigger>
            <TabsTrigger value="usage" className="whitespace-nowrap">Usage</TabsTrigger>
            <TabsTrigger value="ops-feed" className="whitespace-nowrap">Ops Feed</TabsTrigger>
            <TabsTrigger value="learning" className="whitespace-nowrap">Learning</TabsTrigger>
            <TabsTrigger value="ops-controls" className="whitespace-nowrap">Ops Controls</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="results"><WorkflowResultsPanel /></TabsContent>
        <TabsContent value="usage"><UsageDashboardPanel /></TabsContent>
        <TabsContent value="ops-feed"><OpsFeedPanel /></TabsContent>
        <TabsContent value="learning"><LearningDashboardPanel /></TabsContent>
        <TabsContent value="ops-controls"><OpsControlsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
