import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';

/**
 * useHouseholdCounts — Batch-fetches household member counts for a list of contact IDs.
 *
 * WHAT: Returns a map of contactId → count for display in People list.
 * WHERE: Used by People page to show "Household: X" badges.
 * WHY: Avoids N+1 queries by batch-fetching all counts at once.
 *
 * Phase B foundation: uses centralized queryKeys helper for safe invalidation.
 */
export function useHouseholdCounts(contactIds: string[]) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: queryKeys.people.households(tenantId ?? '', contactIds),
    queryFn: async () => {
      if (!tenantId || contactIds.length === 0) return new Map<string, number>();

      const { data, error } = await supabase
        .from('contact_household_members')
        .select('contact_id')
        .eq('tenant_id', tenantId)
        .in('contact_id', contactIds);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data || []) {
        counts.set(row.contact_id, (counts.get(row.contact_id) || 0) + 1);
      }
      return counts;
    },
    enabled: !!tenantId && contactIds.length > 0,
    staleTime: 30_000,
  });
}
