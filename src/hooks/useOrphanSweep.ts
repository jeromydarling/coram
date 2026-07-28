/**
 * useOrphanSweep — Runs the orphan FK sweeper and returns results.
 *
 * WHAT: Calls the sweep_orphan_foreign_keys() DB function.
 * WHERE: Used in Operator Nexus data integrity panel.
 * WHY: Orphan references cause silent data inconsistencies.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrphanResult {
  table: string;
  column: string;
  references: string;
  orphan_count: number;
}

export function useOrphanSweep(enabled = true) {
  return useQuery<OrphanResult[]>({
    queryKey: ['orphan-sweep'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sweep_orphan_foreign_keys' as any);
      if (error) throw error;
      return (data ?? []) as unknown as OrphanResult[];
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}
