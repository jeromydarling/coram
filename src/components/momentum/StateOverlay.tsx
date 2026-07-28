import { Geographies, Geography } from 'react-simple-maps';
import { useGeoGroups } from '@/hooks/useMomentumData';
import type { MetroMomentum } from '@/hooks/useMomentumData';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

interface StateOverlayProps {
  metros: MetroMomentum[];
  visible: boolean;
}

// Calculate average momentum for metros in each state
function getStateHeat(metros: MetroMomentum[], stateGeojsonId: string, geoGroups: any[]): number {
  // Find the state by geojson_id
  const stateGroup = geoGroups.find(g => g.name === stateGeojsonId);
  if (!stateGroup) return 0;

  // For now, we'll use a simplified approach - metros don't have state links in the hook data
  // This overlay shows the state boundary with no heat (just structural)
  return 0;
}

const statusColors: Record<string, { fill: string; opacity: number }> = {
  strong: { fill: '#FFB627', opacity: 0.3 },
  growing: { fill: '#FFD93D', opacity: 0.25 },
  steady: { fill: '#F5C6A5', opacity: 0.2 },
  resting: { fill: '#4ECDC4', opacity: 0.15 },
  none: { fill: 'transparent', opacity: 0 },
};

function getMomentumLevel(avgMomentum: number): string {
  if (avgMomentum >= 1.5) return 'strong';
  if (avgMomentum >= 1.0) return 'growing';
  if (avgMomentum >= 0.5) return 'steady';
  if (avgMomentum > 0) return 'resting';
  return 'none';
}

export function StateOverlay({ metros, visible }: StateOverlayProps) {
  const { data: geoGroups = [] } = useGeoGroups();

  if (!visible) return null;

  return (
    <Geographies geography={GEO_URL}>
      {({ geographies }) =>
        geographies.map((geo) => {
          const stateName = geo.properties.name;
          const avgMomentum = getStateHeat(metros, stateName, geoGroups);
          const level = getMomentumLevel(avgMomentum);
          const colors = statusColors[level];

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              fill={colors.fill}
              stroke="#475569"
              strokeWidth={0.5}
              style={{
                default: { 
                  outline: 'none',
                  opacity: colors.opacity,
                },
                hover: { 
                  outline: 'none',
                  opacity: colors.opacity + 0.1,
                },
                pressed: { outline: 'none' },
              }}
            />
          );
        })
      }
    </Geographies>
  );
}
