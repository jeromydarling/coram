/**
 * useTenantTerritories — Fetches activated territories for the current tenant.
 *
 * WHAT: Joins tenant_territories + territories for the current tenant's activated geography.
 * WHERE: Discovery (Signum), Atlas, Compass, territory-aware filters.
 * WHY: Replaces metro-only filtering with unified territory model supporting
 *      metros, counties, states, countries, and mission fields.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { TerritoryType } from '@/types/cros';

export interface ActivatedTerritory {
  territory_id: string;
  territory_type: TerritoryType;
  name: string;
  state_code: string | null;
  country_code: string | null;
  metro_id: string | null;
  bundle_id: string | null;
  activation_slots: number;
  is_home: boolean;
}

export function useTenantTerritories() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['tenant-territories', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_territories')
        .select(`
          territory_id,
          bundle_id,
          activation_slots,
          is_home,
          territories!inner (
            id,
            territory_type,
            name,
            state_code,
            country_code,
            metro_id
          )
        `)
        .eq('tenant_id', tenant!.id);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        territory_id: row.territory_id,
        territory_type: row.territories.territory_type as TerritoryType,
        name: row.territories.name,
        state_code: row.territories.state_code,
        country_code: row.territories.country_code,
        metro_id: row.territories.metro_id,
        bundle_id: row.bundle_id,
        activation_slots: row.activation_slots,
        is_home: row.is_home,
      })) as ActivatedTerritory[];
    },
  });
}

/**
 * Returns territory-appropriate label for the current tenant archetype.
 */
export function getTerritoryLabel(archetype: string | null | undefined): string {
  switch (archetype) {
    case 'missionary_org':
      return 'Field of service';
    case 'caregiver_solo':
      return 'Your area';
    case 'caregiver_agency':
      return 'Service area';
    default:
      return 'Territory';
  }
}

/**
 * Returns the appropriate scope label (replaces "All metros" / "National").
 */
export function getScopeLabel(archetype: string | null | undefined): { all: string; within: string } {
  switch (archetype) {
    case 'missionary_org':
      return { all: 'All fields', within: 'Within your active fields' };
    case 'caregiver_solo':
      return { all: 'Your area', within: 'Near you' };
    case 'caregiver_agency':
      return { all: 'All service areas', within: 'Within your service areas' };
    default:
      return { all: 'All territories', within: 'Within your active territories' };
  }
}
