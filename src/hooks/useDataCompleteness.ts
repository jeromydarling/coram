/**
 * useDataCompleteness — Scores data completeness for a tenant.
 *
 * WHAT: Calls score_data_completeness() DB function.
 * WHERE: Used in Operator Nexus and tenant dashboard.
 * WHY: Helps organizations see where their data has gaps.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EntityCompleteness {
  total: number;
  with_email?: number;
  with_phone?: number;
  with_organization?: number;
  with_stage?: number;
  with_contact?: number;
  with_metro?: number;
  completeness_pct: number;
}

export interface DataCompletenessResult {
  contacts: EntityCompleteness;
  opportunities: EntityCompleteness;
}

export function useDataCompleteness(tenantId: string | undefined, enabled = true) {
  return useQuery<DataCompletenessResult>({
    queryKey: ['data-completeness', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('score_data_completeness' as any, {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      return data as unknown as DataCompletenessResult;
    },
    enabled: enabled && !!tenantId,
    staleTime: 5 * 60_000,
  });
}
