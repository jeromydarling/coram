/**
 * useTerritories — Hooks for territory queries and activation slot calculation.
 *
 * WHAT: Fetches territories by type, calculates activation slots.
 * WHERE: Onboarding wizard, territory selection, settings.
 * WHY: Unified geography layer replacing metro-only queries.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TerritoryType } from '@/types/cros';

export interface TerritoryRow {
  id: string;
  territory_type: TerritoryType;
  name: string;
  parent_id: string | null;
  state_code: string | null;
  country_code: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  metro_id: string | null;
  active: boolean;
}

export function useTerritories(type?: TerritoryType) {
  return useQuery({
    queryKey: ['territories', type ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('territories')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (type) {
        query = query.eq('territory_type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as TerritoryRow[];
    },
  });
}

export function useTerritoriesByCountry(countryCode: string) {
  return useQuery({
    queryKey: ['territories', 'country', countryCode],
    enabled: !!countryCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .eq('country_code', countryCode)
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as TerritoryRow[];
    },
  });
}

/** US states for county-bundle selection */
export function useUSStates() {
  return useQuery({
    queryKey: ['territories', 'us-states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .eq('territory_type', 'state')
        .eq('country_code', 'US')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return (data ?? []) as TerritoryRow[];
    },
  });
}

/**
 * Calculate activation slots consumed by a territory selection.
 * Rules:
 * - Metro: 1 slot each
 * - County: ceil(count / 5) slots (same state required)
 * - State: 2 slots each
 * - Country: 1 slot each
 * - Mission field: 0 (free if parent country activated)
 */
export function calculateActivationSlots(
  selections: Array<{ type: TerritoryType; count: number }>
): number {
  return selections.reduce((total, { type, count }) => {
    switch (type) {
      case 'metro': return total + count;
      case 'county': return total + Math.ceil(count / 5);
      case 'state': return total + count * 2;
      case 'country': return total + count;
      case 'mission_field': return total; // free
      case 'custom_region': return total + count;
      default: return total + count;
    }
  }, 0);
}
