/**
 * OperatorPlatformPage — Global keywords, pricing, archetypes, demo lab, and admin settings.
 *
 * WHAT: Platform-wide configuration including editorial admin tabs (Switches, Gardeners, Notifications).
 * WHERE: /operator/platform (MACHINA zone)
 * WHY: Separates system/admin configuration from editorial content creation (Garden Studio).
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { Bell, ToggleLeft, Sprout } from 'lucide-react';

const GlobalKeywordsAdmin = lazy(() => import('@/pages/GlobalKeywordsAdmin'));
const ArchetypeSimulation = lazy(() => import('@/pages/admin/ArchetypeSimulation'));
const MetroNewsAdmin = lazy(() => import('@/pages/admin/MetroNewsAdmin'));
const StudioNotificationsTab = lazy(() => import('@/components/operator/studio/StudioNotificationsTab'));
const StudioSwitchesTab = lazy(() => import('@/components/operator/studio/StudioSwitchesTab'));
const StudioGardenersTab = lazy(() => import('@/components/operator/studio/StudioGardenersTab'));

export default function OperatorPlatformPage() {
  const { activeTab, setActiveTab } = useTabPersistence('keywords');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Platform Config</h1>
        <p className="text-sm text-muted-foreground">The soil and seasons — global settings, archetypes, team, and patterns.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-max md:w-auto">
            <TabsTrigger value="keywords" className="whitespace-nowrap">Keywords</TabsTrigger>
            <TabsTrigger value="archetypes" className="whitespace-nowrap">Archetypes</TabsTrigger>
            <TabsTrigger value="metro-news" className="whitespace-nowrap">Metro News</TabsTrigger>
            <TabsTrigger value="switches" className="whitespace-nowrap gap-1.5">
              <ToggleLeft className="h-3.5 w-3.5" /> Switches
            </TabsTrigger>
            <TabsTrigger value="gardeners" className="whitespace-nowrap gap-1.5">
              <Sprout className="h-3.5 w-3.5" /> Gardeners
            </TabsTrigger>
            <TabsTrigger value="notifications" className="whitespace-nowrap gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Notifications
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="keywords">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <GlobalKeywordsAdmin />
          </Suspense>
        </TabsContent>
        <TabsContent value="archetypes">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <ArchetypeSimulation />
          </Suspense>
        </TabsContent>
        <TabsContent value="metro-news">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <MetroNewsAdmin />
          </Suspense>
        </TabsContent>
        <TabsContent value="switches">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <StudioSwitchesTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="gardeners">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <StudioGardenersTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="notifications">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <StudioNotificationsTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
