import { useTranslation } from 'react-i18next';
import { FindPage } from '@/components/discovery/FindPage';
import { LocalPulseSection } from '@/components/events/LocalPulseSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Radio } from 'lucide-react';
import { useTabPersistence } from '@/hooks/useTabPersistence';
import { MainLayout } from '@/components/layout/MainLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';

export default function FindEvents() {
  const { t } = useTranslation('events');
  const { activeTab, setActiveTab } = useTabPersistence('search');
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const isOperatorRoute = pathname.startsWith('/operator');

  const tabsList = (
    <TabsList className="h-8">
      <TabsTrigger value="search" className="text-xs gap-1.5" data-tour="find-events-search-tab">
        <Search className="w-3 h-3" />
        {t('findEvents.searchTab')}
      </TabsTrigger>
      <TabsTrigger value="pulse" className="text-xs gap-1.5" data-tour="find-events-pulse-tab">
        <Radio className="w-3 h-3" />
        {t('findEvents.pulseTab')}
      </TabsTrigger>
    </TabsList>
  );

  const content = (
    <>
      {(isMobile || isOperatorRoute) && (
        <div className="mb-3">
          {tabsList}
        </div>
      )}
      <TabsContent value="search" className="mt-0">
        <FindPage searchType="event" noLayout />
      </TabsContent>
      <TabsContent value="pulse" className="mt-0">
        <LocalPulseSection />
      </TabsContent>
    </>
  );

  if (isOperatorRoute) {
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div data-testid="find-events-root">
          {content}
        </div>
      </Tabs>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <MainLayout
        title={t('findEvents.title')}
        subtitle={t('findEvents.subtitle')}
        headerActions={!isMobile ? tabsList : undefined}
        data-testid="find-events-root"
      >
        {content}
      </MainLayout>
    </Tabs>
  );
}