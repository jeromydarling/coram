/**
 * useEvents — Tenant-scoped events list.
 *
 * WHAT: Reads `public.events` (excluding Local Pulse rows and soft-deleted).
 * WHERE: Source of truth for the Events list, calendar surfaces, and
 *        anywhere needing the org's event collection.
 * WHY: Centralized cache key + invalidation contract.
 *
 * Cache key: queryKeys.events.list(tenantId, { mineOnly, allTenants }).
 * Legacy `['events']` invalidations still match this key (prefix match).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRows } from '@/lib/supabaseRow';

export interface EventRow {
  id: string;
  event_id: string;
  event_name: string;
  event_date: string;
  end_date?: string | null;
  slug?: string | null;
  metro_id?: string | null;
  host_opportunity_id?: string | null;
  event_type: string;
  tenant_id?: string | null;
  attended_by?: string | null;
  attended?: boolean | null;
  is_local_pulse?: boolean | null;
  is_conference?: boolean | null;
  deleted_at?: string | null;
  notes?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  city?: string | null;
  host_organization?: string | null;
  target_populations?: string[] | null;
  strategic_lanes?: string[] | null;
  pcs_goals?: string[] | null;
  households_served?: number | null;
  staff_deployed?: number | null;
  devices_distributed?: number | null;
  internet_signups?: number | null;
  referrals_generated?: number | null;
  cost_estimated?: number | null;
  metros?: { metro: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [extra: string]: any;
}

export interface UseEventsOptions {
  allTenants?: boolean;
  mineOnly?: boolean;
}

export function useEvents(options?: UseEventsOptions) {
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const filterByTenant = !options?.allTenants && !!tenantId;
  const filters = {
    tenant: filterByTenant ? tenantId : 'all',
    mine: options?.mineOnly ? user?.id ?? 'me' : 'all-users',
  };

  return useQuery({
    queryKey: filterByTenant && tenantId
      ? queryKeys.events.list(tenantId, filters)
      : (['events', 'all', filters] as const),
    queryFn: async () => {
      if (options?.mineOnly && !user?.id) return [];

      let query = supabase
        .from('events')
        .select(`*, metros (metro)`)
        .is('deleted_at', null)
        .eq('is_local_pulse', false)
        .order('event_date', { ascending: false });

      if (filterByTenant && tenantId) query = query.eq('tenant_id', tenantId);
      if (options?.mineOnly && user?.id) query = query.eq('attended_by', user.id);

      const { data, error } = await query;
      if (error) throw error;
      return supabaseRows<EventRow>(data);
    },
  });
}
