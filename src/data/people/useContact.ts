/**
 * useContact — Tenant-scoped single person (contact) by id or slug.
 *
 * WHAT: Reads one row from `public.contacts` with relations.
 * WHERE: Person detail pages and modals.
 * WHY: Avoids loading the full list just to render one detail; key sits
 *      under the same domain so list/detail invalidate together.
 *
 * Cache key: queryKeys.people.detail(tenantId, idOrSlug)
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRow } from '@/lib/supabaseRow';
import type { ContactRow } from './useContacts';

const SELECT = `
  *,
  opportunities!contacts_opportunity_id_fkey (
    id, organization, slug, stage, metro_id,
    metros ( metro, regions ( name ) )
  ),
  events:met_at_event_id (id, slug, event_name, event_date)
`;

export function useContact(idOrSlug: string | null | undefined) {
  const { tenantId } = useTenant();
  const key = idOrSlug ?? '';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);

  return useQuery({
    queryKey: tenantId
      ? queryKeys.people.detail(tenantId, key)
      : (['contacts', 'no-tenant', 'detail', key] as const),
    enabled: !!tenantId && !!idOrSlug,
    queryFn: async () => {
      const column = isUuid ? 'id' : 'slug';
      const { data, error } = await supabase
        .from('contacts')
        .select(SELECT)
        .eq('tenant_id', tenantId!)
        .eq(column, key)
        .maybeSingle();

      if (error) throw error;
      return data ? supabaseRow<ContactRow>(data) : null;
    },
  });
}
