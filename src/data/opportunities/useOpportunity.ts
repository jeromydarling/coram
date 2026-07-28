/**
 * useOpportunity — Tenant-scoped single opportunity by id or slug.
 *
 * WHAT: Loads one row from `public.opportunities` for detail surfaces.
 * WHERE: Use on detail pages and side panels instead of pulling the entire
 *        list via `useOpportunities()` and filtering client-side.
 * WHY: Smaller payloads, finer-grained cache invalidation, and per-row
 *      Realtime subscriptions later (see src/data/README.md).
 *
 * Cache key: queryKeys.opportunities.detail(tenantId, idOrSlug)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRow } from '@/lib/supabaseRow';
import type { OpportunityRow } from './useOpportunities';

const SELECT = `
  *,
  metros (metro),
  primary_contact:contacts!opportunities_primary_contact_id_fkey (
    id,
    slug,
    name,
    title,
    email,
    phone
  )
`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useOpportunity(idOrSlug: string | null | undefined) {
  const { tenantId } = useTenant();
  const key = idOrSlug ?? '';

  return useQuery({
    queryKey: tenantId
      ? queryKeys.opportunities.detail(tenantId, key)
      : (['opportunities', 'no-tenant', 'detail', key] as const),
    enabled: !!tenantId && !!idOrSlug,
    queryFn: async () => {
      const column = UUID_RE.test(key) ? 'id' : 'slug';
      const { data, error } = await supabase
        .from('opportunities')
        .select(SELECT)
        .eq('tenant_id', tenantId!)
        .eq(column, key)
        .maybeSingle();

      if (error) throw error;
      return data ? supabaseRow<OpportunityRow>(data) : null;
    },
  });
}
