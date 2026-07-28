/**
 * OperatorSystemPage — Unified system health, sweeps, automation, and friction.
 *
 * WHAT: System-level monitoring, diagnostics, and stability signals.
 * WHERE: /operator/system
 * WHY: Single hub for all infrastructure and stability concerns.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTabPersistence } from '@/hooks/useTabPersistence';

const SystemHealth = lazy(() => import('@/pages/admin/SystemHealth'));
const SystemSweep = lazy(() => import('@/pages/admin/SystemSweep'));
const AutomationHealth = lazy(() => import('@/pages/AutomationHealth'));
const SystemFriction = lazy(() => import('@/pages/operator/nexus/OperatorStabilityPage'));

export default function OperatorSystemPage() {
  const { activeTab, setActiveTab } = useTabPersistence('health');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">System</h1>
        <p className="text-sm text-muted-foreground">Noticing where the garden needs care — health, friction, rhythms, and sweeps.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="health" className="whitespace-nowrap">Health</TabsTrigger>
            <TabsTrigger value="friction" className="whitespace-nowrap">Friction</TabsTrigger>
            <TabsTrigger value="automation" className="whitespace-nowrap">Background Tending</TabsTrigger>
            <TabsTrigger value="sweep" className="whitespace-nowrap">Walk the Garden</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="health">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SystemHealth />
          </Suspense>
        </TabsContent>
        <TabsContent value="friction">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SystemFriction />
          </Suspense>
        </TabsContent>
        <TabsContent value="automation">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <AutomationHealth />
          </Suspense>
        </TabsContent>
        <TabsContent value="sweep">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SystemSweep />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
