import { useMemo } from 'react';
import { Marker } from 'react-simple-maps';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RadarMetroHot } from '@/hooks/useRadarData';
import type { MetroMomentum } from '@/hooks/useMomentumData';

interface RadarOverlayProps {
  hotspots: RadarMetroHot[];
  metros: MetroMomentum[];
  visible: boolean;
}

export function RadarOverlay({ hotspots, metros, visible }: RadarOverlayProps) {
  // Merge coordinates from momentum metros
  const enriched = useMemo(() => {
    if (!visible) return [];
    const metroCoords = new Map(metros.map(m => [m.metroId, { lat: m.lat, lng: m.lng }]));
    return hotspots
      .map(h => {
        const coords = metroCoords.get(h.metro_id);
        return { ...h, lat: coords?.lat ?? null, lng: coords?.lng ?? null };
      })
      .filter(h => h.lat !== null && h.lng !== null);
  }, [hotspots, metros, visible]);

  if (!visible || enriched.length === 0) return null;

  return (
    <>
      {enriched.map(spot => {
        const size = Math.min(6 + spot.hotOpportunityCount * 2, 16);
        return (
          <Marker key={spot.metro_id} coordinates={[spot.lng!, spot.lat!]}>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <g style={{ pointerEvents: 'all' }} className="cursor-pointer">
                  {/* Pulsing outer ring */}
                  <circle
                    r={size * 2.2}
                    fill="none"
                    stroke="hsl(0, 85%, 60%)"
                    strokeWidth={1.5}
                    opacity={0.4}
                    className="animate-pulse"
                  />
                  {/* Inner ring */}
                  <circle
                    r={size * 1.4}
                    fill="hsla(0, 85%, 60%, 0.15)"
                    stroke="hsl(0, 85%, 60%)"
                    strokeWidth={1}
                    opacity={0.6}
                  />
                  {/* Count label */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="hsl(0, 85%, 60%)"
                    fontSize={size * 0.9}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {spot.hotOpportunityCount}
                  </text>
                </g>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs space-y-1">
                <p className="font-semibold">{spot.metroName}</p>
                <p>{spot.hotOpportunityCount} hot opportunit{spot.hotOpportunityCount === 1 ? 'y' : 'ies'}</p>
                {spot.totalSignals > 0 && <p>{spot.totalSignals} recent signals</p>}
                {spot.topOrg && <p className="text-muted-foreground">Top: {spot.topOrg}</p>}
              </TooltipContent>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
