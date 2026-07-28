/**
 * OperatorIntegrationsPage — Unified Relatio integration hub.
 *
 * WHAT: Connector library, reference docs, migration runs, and HubSpot admin.
 * WHERE: /operator/integrations
 * WHY: Single pane of glass for all integration operations.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { GuidedAssistanceBlock } from '@/components/integrations/GuidedAssistanceBlock';
import { SyncSettingsPanel } from '@/components/relatio/SyncSettingsPanel';

const RelatioAdmin = lazy(() => import('@/pages/admin/RelatioAdmin'));
const HubSpotAdmin = lazy(() => import('@/pages/admin/HubSpotAdmin'));
const IntegrationReference = lazy(() => import('@/pages/operator/nexus/OperatorNexusIntegrations'));
const MigrationDashboard = lazy(() => import('@/pages/operator/nexus/OperatorNexusMigrations'));

export default function OperatorIntegrationsPage() {
  const { activeTab, setActiveTab } = useTabPersistence('relatio');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">Helping data find its way home.</p>
      </div>

      <GuidedAssistanceBlock />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="relatio" className="whitespace-nowrap">Connectors</TabsTrigger>
            <TabsTrigger value="sync" className="whitespace-nowrap">Sync Direction</TabsTrigger>
            <TabsTrigger value="reference" className="whitespace-nowrap">Reference</TabsTrigger>
            <TabsTrigger value="migrations" className="whitespace-nowrap">Migrations</TabsTrigger>
            <TabsTrigger value="hubspot" className="whitespace-nowrap">HubSpot</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="relatio">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <RelatioAdmin />
          </Suspense>
        </TabsContent>
        <TabsContent value="sync">
          <SyncSettingsPanel />
        </TabsContent>
        <TabsContent value="reference">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <IntegrationReference />
          </Suspense>
        </TabsContent>
        <TabsContent value="migrations">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <MigrationDashboard />
          </Suspense>
        </TabsContent>
        <TabsContent value="hubspot">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <HubSpotAdmin />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
