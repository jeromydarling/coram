import { useGeoGroups } from '@/hooks/useMomentumData';
import type { MetroMomentum } from '@/hooks/useMomentumData';

interface RegionOverlayProps {
  metros: MetroMomentum[];
  visible: boolean;
}

// For now, region overlay is a placeholder
// Full implementation would require region polygon data
export function RegionOverlay({ metros, visible }: RegionOverlayProps) {
  const { data: geoGroups = [] } = useGeoGroups();
  
  if (!visible) return null;

  // Region overlay requires custom GeoJSON for region boundaries
  // For V1, we show nothing - regions are groupings only
  return null;
}
