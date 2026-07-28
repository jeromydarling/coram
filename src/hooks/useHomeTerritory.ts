/**
 * useHomeTerritory — Returns the tenant's home territory from tenant_territories.
 *
 * WHAT: Queries tenant_territories where is_home = true, joined with territories.
 * WHERE: Replaces legacy useHomeMetro across Local Pulse, Command Center, narratives.
 * WHY: Unified territory model — home location flows through tenant_territories.is_home
 *      instead of legacy profiles.home_metro_id or tenants.home_metro_id.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import type { TerritoryType } from '@/types/cros';

export interface HomeTerritory {
  territory_id: string;
  territory_type: TerritoryType;
  name: string;
  metro_id: string | null;
  state_code: string | null;
  country_code: string | null;
}

export function useHomeTerritory() {
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['home-territory', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<HomeTerritory | null> => {
      // Primary: territory model
      const { data, error } = await supabase
        .from('tenant_territories')
        .select(`
          territory_id,
          territories!inner (
            id,
            territory_type,
            name,
            metro_id,
            state_code,
            country_code
          )
        `)
        .eq('tenant_id', tenant!.id)
        .eq('is_home', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const t = (data as any).territories;
        return {
          territory_id: data.territory_id,
          territory_type: t.territory_type as TerritoryType,
          name: t.name,
          metro_id: t.metro_id,
          state_code: t.state_code,
          country_code: t.country_code,
        };
      }

      // Fallback: legacy home_metro_id on tenants table
      if ((tenant as any)?.home_metro_id) {
        const metroId = (tenant as any).home_metro_id;
        const { data: metro } = await supabase
          .from('metros')
          .select('id, metro')
          .eq('id', metroId)
          .maybeSingle();

        if (metro) {
          return {
            territory_id: metro.id,
            territory_type: 'metro',
            name: metro.metro,
            metro_id: metro.id,
            state_code: null,
            country_code: null,
          };
        }
      }

      return null;
    },
  });
}

/**
 * Convenience: returns just the effective metro_id for backward-compatible queries
 * (events, local_pulse_runs, narratives all still key on metro_id).
 */
export function useHomeMetroId() {
  const { data: home, ...rest } = useHomeTerritory();
  return { data: home?.metro_id ?? null, ...rest };
}
