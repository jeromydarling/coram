/**
 * useOpportunities — Tenant-scoped list of opportunities (partners).
 *
 * WHAT: Reads from `public.opportunities` joined with primary contact and metro.
 * WHERE: Source of truth for the Opportunities list page and any component
 *        that needs the full collection. Detail pages should prefer
 *        `useOpportunity(id)` to avoid loading the full set.
 * WHY: Centralized so cache keys, tenant scoping, and invalidation contracts
 *      stay consistent — see src/data/README.md and src/lib/queryKeys.ts.
 *
 * Cache key: queryKeys.opportunities.list(tenantId)
 * Invalidations using the prefix `['opportunities']` (legacy callers) still
 * match this key thanks to TanStack Query's partial-match behavior.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { supabaseRows } from '@/lib/supabaseRow';

export interface OpportunityRow {
  id: string;
  opportunity_id: string;
  organization: string;
  slug?: string | null;
  metro_id?: string | null;
  stage?: string | null;
  status?: string | null;
  partner_tier?: string | null;
  partner_tiers?: string[] | null;
  mission_snapshot?: string[] | null;
  best_partnership_angle?: string[] | null;
  grant_alignment?: string[] | null;
  primary_contact?: {
    id: string;
    slug?: string | null;
    name: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  next_action_due?: string | null;
  next_step?: string | null;
  notes?: string | null;
  metros?: { metro: string } | null;
  tenant_id?: string | null;
  created_at?: string | null;
  website_url?: string | null;
  org_knowledge_status?: string | null;
  neighborhood_status?: string | null;
  org_enrichment_status?: string | null;
  prospect_pack_status?: string | null;
  // Permit extra fields that exist on the row but aren't typed here yet.
  // Typed as `any` (not `unknown`) so legacy callers don't break while we
  // gradually narrow the shape. Tracked in src/data/README.md.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [extra: string]: any;
}

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

export function useOpportunities() {
  const { tenantId } = useTenant();

  return useQuery({
    // Tenant-scoped key. Legacy `['opportunities']` invalidations still match.
    queryKey: tenantId
      ? queryKeys.opportunities.list(tenantId)
      : (['opportunities', 'no-tenant'] as const),
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(SELECT)
        // Defensive tenant filter — RLS enforces this too, but explicit
        // scoping prevents accidental cache bleed across tenant overrides.
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return supabaseRows<OpportunityRow>(data);
    },
  });
}
