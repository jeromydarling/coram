import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SearchHistoryRun {
  run_id: string;
  enforced_query: string | null;
  raw_query: string | null;
  scope: string;
  metro_id: string | null;
  created_at: string;
  status: string;
  results_saved: number;
  people_added_count: number;
  opportunities_created_count: number;
}

export function useSearchHistory(module: string, enabled = true) {
  return useQuery({
    queryKey: ['search-history', module],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        `search-history?module=${module}&days=30`,
        { method: 'GET' },
      );
      if (error) throw error;
      const result = data as { ok: boolean; runs: SearchHistoryRun[] };
      if (!result?.ok) throw new Error('Failed to load search history');
      return result.runs || [];
    },
    enabled,
    staleTime: 30_000,
  });
}
