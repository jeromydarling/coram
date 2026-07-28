/**
 * useDuplicateDetection — Detects potential duplicate contacts.
 *
 * WHAT: Calls detect_duplicate_contacts() DB function.
 * WHERE: Used in contacts page and data integrity panel.
 * WHY: Duplicate records degrade data quality and confuse users.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DuplicateMatch {
  match_type: 'email' | 'name';
  match_value: string;
  contact_ids: string[];
  names?: string[];
  emails?: string[];
  count: number;
}

export function useDuplicateDetection(tenantId: string | undefined, enabled = true) {
  return useQuery<DuplicateMatch[]>({
    queryKey: ['duplicate-detection', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('detect_duplicate_contacts' as any, {
        p_tenant_id: tenantId,
      });
      if (error) throw error;
      return (data ?? []) as unknown as DuplicateMatch[];
    },
    enabled: enabled && !!tenantId,
    staleTime: 10 * 60_000,
  });
}
