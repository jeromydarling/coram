/**
 * useContacts — Tenant-scoped list of people (contacts).
 *
 * WHAT: Reads from `public.contacts` joined with opportunity + event-met.
 * WHERE: Source of truth for the People list and any component needing the
 *        full collection. Detail pages should prefer `useContact(id)`.
 * WHY: Centralized so cache keys, tenant scoping, and invalidation contracts
 *      stay consistent — see src/data/README.md.
 *
 * Cache key: queryKeys.people.list(tenantId) — prefix is `['contacts', ...]`
 * so legacy invalidations using `['contacts']` still match.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRows } from '@/lib/supabaseRow';

const SELECT = `
  *,
  opportunities!contacts_opportunity_id_fkey (
    organization,
    slug,
    stage,
    partner_tiers,
    mission_snapshot,
    best_partnership_angle,
    grant_alignment,
    metro_id,
    metros (
      metro,
      regions (name)
    )
  ),
  events:met_at_event_id (id, slug, event_name, event_date)
`;

export interface ContactRow {
  id: string;
  contact_id: string;
  opportunity_id?: string | null;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean | null;
  notes?: string | null;
  met_at_event_id?: string | null;
  person_type?: string | null;
  is_person_in_need?: boolean | null;
  tenant_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  slug?: string | null;
  opportunities?: {
    id?: string;
    organization: string;
    slug?: string | null;
    stage?: string | null;
    partner_tiers?: string[] | null;
    mission_snapshot?: string[] | null;
    best_partnership_angle?: string[] | null;
    grant_alignment?: string[] | null;
    metro_id?: string | null;
    metros?: { metro: string; regions?: { name: string } | null } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [extra: string]: any;
  } | null;
  events?: {
    id: string;
    slug?: string | null;
    event_name: string;
    event_date?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [extra: string]: any;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [extra: string]: any;
}

export function useContacts() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: tenantId
      ? queryKeys.people.list(tenantId)
      : (['contacts', 'no-tenant'] as const),
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select(SELECT)
        .eq('tenant_id', tenantId!)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return supabaseRows<ContactRow>(data);
    },
  });
}
