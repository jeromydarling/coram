import { useState, useMemo, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { MetroHeatMarker } from './MetroHeatMarker';
import { MetroDetailPanel } from './MetroDetailPanel';
import { MomentumLegend } from './MomentumLegend';
import { StateOverlay } from './StateOverlay';
import { RegionOverlay } from './RegionOverlay';
import { RadarOverlay } from './RadarOverlay';
import { StoryLayerIndicator } from './StoryLayerIndicator';
import { DriftOverlayIndicator } from './DriftOverlayIndicator';
import type { MetroMomentum } from '@/hooks/useMomentumData';
import type { RadarMetroHot } from '@/hooks/useRadarData';
import type { MetroStoryData } from '@/hooks/useStoryMomentum';
import type { DriftLabel } from '@/hooks/useMetroDrift';
import { cn } from '@/lib/utils';

// US TopoJSON from a CDN
const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

export type StoryLayer = 'pulse' | 'partners' | 'ink';

interface MomentumHeatmapProps {
  metros: MetroMomentum[];
  className?: string;
  showStateOverlay?: boolean;
  showRegionOverlay?: boolean;
  radarHotspots?: RadarMetroHot[];
  activeStoryLayer?: StoryLayer | null;
  storyData?: Record<string, MetroStoryData>;
  showDriftOverlay?: boolean;
  driftScores?: Record<string, { driftScore: number; driftLabel: DriftLabel; emergingTopics: string[] }>;
}

export function MomentumHeatmap({ 
  metros, 
  className,
  showStateOverlay = false,
  showRegionOverlay = false,
  radarHotspots,
  activeStoryLayer = null,
  storyData,
  showDriftOverlay = false,
  driftScores,
}: MomentumHeatmapProps) {
  const [selectedMetro, setSelectedMetro] = useState<MetroMomentum | null>(null);
  const [position, setPosition] = useState({ coordinates: [-96, 38] as [number, number], zoom: 1 });

  // Filter metros with valid coordinates
  const mappableMetros = useMemo(() => {
    return metros.filter(m => m.lat !== null && m.lng !== null);
  }, [metros]);

  // Memoize storyData to prevent re-render storms when toggling overlays
  const safeStoryData = useMemo(() => storyData ?? {}, [storyData]);
  const safeDriftScores = useMemo(() => driftScores ?? {}, [driftScores]);

  const handleMoveEnd = (position: { coordinates: [number, number]; zoom: number }) => {
    setPosition(position);
  };

  return (
    <div className={cn('relative w-full h-full min-h-[400px]', className)}>
      <ComposableMap
        projection="geoAlbersUsa"
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={8}
        >
          {/* US States base layer */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#273449' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* State overlay layer */}
          <StateOverlay metros={metros} visible={showStateOverlay} />

          {/* Region overlay layer */}
          <RegionOverlay metros={metros} visible={showRegionOverlay} />

          {/* Metro heat markers */}
          {mappableMetros.map((metro) => (
            <Marker
              key={metro.metroId}
              coordinates={[metro.lng!, metro.lat!]}
            >
              <MetroHeatMarker
                metro={metro}
                x={0}
                y={0}
                onClick={setSelectedMetro}
              />
              {/* Story layer indicator — rendered above the marker */}
              {activeStoryLayer && safeStoryData[metro.metroId] && (
                <StoryLayerIndicator
                  storyData={safeStoryData[metro.metroId]}
                  activeLayer={activeStoryLayer}
                  x={0}
                  y={0}
                />
              )}
              {/* Drift overlay indicator */}
              {showDriftOverlay && safeDriftScores[metro.metroId] && (
                <DriftOverlayIndicator
                  driftScore={safeDriftScores[metro.metroId].driftScore}
                  driftLabel={safeDriftScores[metro.metroId].driftLabel}
                  emergingTopics={safeDriftScores[metro.metroId].emergingTopics}
                  x={0}
                  y={0}
                />
              )}
            </Marker>
          ))}

          {/* Radar overlay - hot opportunity markers */}
          {radarHotspots && (
            <RadarOverlay
              hotspots={radarHotspots}
              metros={metros}
              visible={true}
            />
          )}
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend overlay */}
      <MomentumLegend className="absolute bottom-4 left-4 z-10" />

      {/* Detail panel */}
      <MetroDetailPanel
        metro={selectedMetro}
        onClose={() => setSelectedMetro(null)}
        storyData={selectedMetro ? safeStoryData[selectedMetro.metroId] : undefined}
        storyLoading={!!activeStoryLayer && Object.keys(safeStoryData).length === 0}
      />
    </div>
  );
}
