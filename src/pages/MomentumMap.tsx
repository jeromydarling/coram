import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { MomentumHeatmap, type StoryLayer } from '@/components/momentum/MomentumHeatmap';
import { MissingCoordinatesAlert } from '@/components/momentum/MissingCoordinatesAlert';
import { TimeRangeFilter, type TimeRange } from '@/components/momentum/TimeRangeFilter';
import { useMomentumData } from '@/hooks/useMomentumData';
import { useRadarData } from '@/hooks/useRadarData';
import { useStoryMomentum } from '@/hooks/useStoryMomentum';
import { useMetroDriftScores } from '@/hooks/useMetroDrift';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useState, useMemo } from 'react';
import { Map, RefreshCw, Layers, Waves, Users, Feather, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

function buildStoryLayerConfig(t: (key: string) => string): { key: StoryLayer; label: string; icon: typeof Waves }[] {
  return [
    { key: 'pulse', label: t('momentumMap.storyLayers.pulse'), icon: Waves },
    { key: 'partners', label: t('momentumMap.storyLayers.partners'), icon: Users },
    { key: 'ink', label: t('momentumMap.storyLayers.ink'), icon: Feather },
  ];
}

export default function MomentumMap() {
  const { t } = useTranslation('intelligence');
  const storyLayerConfig = buildStoryLayerConfig(t);
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');
  const [showStateOverlay, setShowStateOverlay] = useState(false);
  const [showRegionOverlay, setShowRegionOverlay] = useState(false);
  const [showRadarOverlay, setShowRadarOverlay] = useState(false);
  const [showDriftOverlay, setShowDriftOverlay] = useState(false);
  const [activeStoryLayer, setActiveStoryLayer] = useState<StoryLayer | null>(null);
  const { data: metros, isLoading, error, refetch, isFetching } = useMomentumData();
  const { data: radarData } = useRadarData();
  const queryClient = useQueryClient();

  // Derive metro IDs for story hook — only fetch when a story layer is active
  const metroIds = useMemo(() => (metros || []).map(m => m.metroId), [metros]);
  const { data: storyData } = useStoryMomentum(activeStoryLayer ? metroIds : []);
  const { data: driftScores } = useMetroDriftScores(showDriftOverlay ? metroIds : []);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['momentum-data'] });
    refetch();
  };

  const toggleStoryLayer = (layer: StoryLayer) => {
    setActiveStoryLayer(prev => prev === layer ? null : layer);
  };

  return (
    <MainLayout title={t('momentumMap.title')} helpKey="page.momentum" data-testid="momentum-root">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Map className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t('momentumMap.title')}</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                {t('momentumMap.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
            
            {/* Overlay toggles */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Layers className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('momentumMap.overlays')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem
                  checked={showStateOverlay}
                  onCheckedChange={setShowStateOverlay}
                >
                  {t('momentumMap.overlayOptions.stateBoundaries')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showRegionOverlay}
                  onCheckedChange={setShowRegionOverlay}
                >
                  {t('momentumMap.overlayOptions.regionGroupings')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showRadarOverlay}
                  onCheckedChange={setShowRadarOverlay}
                >
                  {t('momentumMap.overlayOptions.opportunityRadar')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={showDriftOverlay}
                  onCheckedChange={setShowDriftOverlay}
                >
                  <GitCompareArrows className="w-3.5 h-3.5 mr-1.5 inline" />
                  {t('momentumMap.overlayOptions.drift')}
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  {t('momentumMap.overlayOptions.storyLayers')}
                </DropdownMenuLabel>
                {storyLayerConfig.map(({ key, label, icon: Icon }) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={activeStoryLayer === key}
                    onCheckedChange={() => toggleStoryLayer(key)}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1.5 inline" />
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('momentumMap.refresh')}</span>
            </Button>
          </div>
        </div>

        {/* Missing coordinates alert (admin only) */}
        {metros && metros.length > 0 && (
          <div className="px-4 py-2">
            <MissingCoordinatesAlert metros={metros} />
          </div>
        )}

        {/* Map area */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center space-y-4">
                <Skeleton className="w-64 h-64 rounded-full mx-auto bg-slate-800" />
                <p className="text-muted-foreground">{t('momentumMap.loading')}</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <Card className="p-6 text-center max-w-md">
                <p className="text-destructive font-medium mb-2">{t('momentumMap.error')}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : 'Please try again later.'}
                </p>
                <Button onClick={handleRefresh} variant="outline">
                  {t('momentumMap.tryAgain')}
                </Button>
              </Card>
            </div>
          ) : metros && metros.length > 0 ? (
            <MomentumHeatmap
              metros={metros}
              className="absolute inset-0 bg-slate-900"
              showStateOverlay={showStateOverlay}
              showRegionOverlay={showRegionOverlay}
              radarHotspots={showRadarOverlay ? radarData?.metroHotspots : undefined}
              activeStoryLayer={activeStoryLayer}
              storyData={storyData ?? undefined}
              showDriftOverlay={showDriftOverlay}
              driftScores={driftScores ?? undefined}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <Card className="p-6 text-center max-w-md">
                <Map className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium mb-2">{t('momentumMap.noMetros')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('momentumMap.noMetrosMessage')}
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
