import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Recommendation {
  id: string;
  run_id: string;
  metro_id: string | null;
  recommendation_type: string;
  title: string;
  body: string | null;
  priority: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortByPriority(a: Recommendation, b: Recommendation): number {
  const pa = PRIORITY_ORDER[a.priority ?? 'medium'] ?? 1;
  const pb = PRIORITY_ORDER[b.priority ?? 'medium'] ?? 1;
  if (pa !== pb) return pa - pb;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

/**
 * Fetch top 3 recommendations, optionally scoped to a metro.
 * Sorted by priority (high > medium > low), then most recent.
 */
export function useRecommendations(metroId?: string | null) {
  return useQuery({
    queryKey: ['ai-recommendations', metroId ?? 'all'],
    queryFn: async (): Promise<Recommendation[]> => {
      let query = supabase
        .from('ai_recommendations')
        .select('id, run_id, metro_id, recommendation_type, title, body, priority, metadata, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10); // fetch a few extra for priority sort

      if (metroId) {
        query = query.eq('metro_id', metroId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const recs = (data || []) as Recommendation[];
      return recs.sort(sortByPriority).slice(0, 3);
    },
    staleTime: 120_000, // 2 min cache
  });
}

/** Exported for testing */
export { sortByPriority, PRIORITY_ORDER };
