import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetroMomentum {
  metroId: string;
  metroName: string;
  regionId: string | null;
  normalizedMomentum: number;
  momentumStatus: 'Resting' | 'Steady' | 'Growing' | 'Strong';
  anchors90d: number;
  eventsThisQuarter: number;
  orders30d: number;
  computedAt: string;
  lat: number | null;
  lng: number | null;
  hasMilestone: boolean;
  milestoneAchievedAt: string | null;
}

export interface GeoGroup {
  id: string;
  geoGroupId: string;
  name: string;
  geoGroupType: 'state' | 'region';
  geojsonId: string | null;
  centerLat: number | null;
  centerLng: number | null;
}

export function useMomentumData() {
  return useQuery({
    queryKey: ['momentum-data'],
    queryFn: async (): Promise<MetroMomentum[]> => {
      const { data, error } = await supabase.rpc('get_metro_momentum_data');

      if (error) {
        console.error('Error fetching momentum data:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        metroId: row.metro_id,
        metroName: row.metro_name,
        regionId: row.region_id,
        normalizedMomentum: Number(row.normalized_momentum) || 0,
        momentumStatus: row.momentum_status as MetroMomentum['momentumStatus'],
        anchors90d: row.anchors_90d || 0,
        eventsThisQuarter: row.events_this_quarter || 0,
        orders30d: row.orders_30d || 0,
        computedAt: row.computed_at,
        lat: row.lat ? Number(row.lat) : null,
        lng: row.lng ? Number(row.lng) : null,
        hasMilestone: row.has_milestone || false,
        milestoneAchievedAt: row.milestone_achieved_at,
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 30, // Refetch every 30 minutes
  });
}

export function useGeoGroups() {
  return useQuery({
    queryKey: ['geo-groups'],
    queryFn: async (): Promise<GeoGroup[]> => {
      const { data, error } = await supabase
        .from('geo_groups')
        .select('*')
        .order('name');

      if (error) {
        console.error('Error fetching geo groups:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        geoGroupId: row.geo_group_id,
        name: row.name,
        geoGroupType: row.geo_group_type,
        geojsonId: row.geojson_id,
        centerLat: row.center_lat ? Number(row.center_lat) : null,
        centerLng: row.center_lng ? Number(row.center_lng) : null,
      }));
    },
    staleTime: 1000 * 60 * 60, // 1 hour - states don't change often
  });
}
