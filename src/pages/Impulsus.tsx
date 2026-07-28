/**
 * Impulsus — private scrapbook journal page.
 *
 * WHAT: Displays a warm timeline of relationship moments.
 * WHERE: Route /impulsus, sidebar nav item.
 * WHY: Gives users a gentle, private record of meaningful work.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { ImpulsusTimeline } from '@/components/impulsus/ImpulsusTimeline';
import { ImpulsusFilters } from '@/components/impulsus/ImpulsusFilters';
import { ImpulsusSettingsSheet } from '@/components/impulsus/ImpulsusSettingsSheet';
import { useImpulsusEntries } from '@/hooks/useImpulsusEntries';
import { useImpulsusSettings } from '@/hooks/useImpulsusSettings';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import type { ImpulsusKind } from '@/lib/impulsusTemplates';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export default function Impulsus() {
  const { t } = useTranslation('narrative');
  const [activeKind, setActiveKind] = useState<ImpulsusKind | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  // Ensure settings row exists
  useImpulsusSettings();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useImpulsusEntries({ kind: activeKind, search: debouncedSearch });

  const entries = data?.pages.flat() || [];

  return (
    <MainLayout
      title={t('impulsus.title')}
      subtitle={t('impulsus.subtitle')}
      headerActions={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(true)}
          title={t('impulsus.captureSettings')}
        >
          <Settings className="w-4 h-4" />
        </Button>
      }
    >
      <div className="max-w-4xl space-y-6">
        <ImpulsusFilters
          activeKind={activeKind}
          onKindChange={setActiveKind}
          search={search}
          onSearchChange={setSearch}
        />

        <ImpulsusTimeline
          entries={entries}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={!!hasNextPage}
          fetchNextPage={fetchNextPage}
        />
      </div>

      <ImpulsusSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </MainLayout>
  );
}
