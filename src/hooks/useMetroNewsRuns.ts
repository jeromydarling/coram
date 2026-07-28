import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MetroNewsRun {
  id: string;
  metro_id: string;
  period_start: string | null;
  period_end: string | null;
  ran_at: string;
  status: 'running' | 'completed' | 'failed';
  queries_used: unknown[];
  keyword_snapshot: unknown[];
  source_count: number;
  articles_found: number;
  articles_deduped: number;
  articles_persisted: number;
  errors: unknown[];
  duration_ms: number | null;
  metro_name?: string;
}

export type PulseHealth = 'healthy' | 'quiet' | 'stale';

export interface MetroNewsPulse {
  lastRun: MetroNewsRun | null;
  weeklyArticlesPersisted: number;
  weeklyArticlesFound: number;
  health: PulseHealth;
  signalStrength: number;
  narrativeUsedCount: number;
}

function computeHealth(runs: MetroNewsRun[]): PulseHealth {
  if (!runs.length) return 'stale';
  const latest = runs[0];
  const daysAgo = (Date.now() - new Date(latest.ran_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysAgo > 8) return 'stale';
  if (latest.articles_persisted === 0) return 'quiet';
  return 'healthy';
}

export function useMetroNewsRuns(metroId?: string | null, limit = 10) {
  return useQuery({
    queryKey: ['metro-news-runs', metroId ?? 'all', limit],
    queryFn: async (): Promise<MetroNewsRun[]> => {
      let query = supabase
        .from('metro_news_runs')
        .select('*, metros!inner(metro)')
        .order('ran_at', { ascending: false })
        .limit(limit);

      if (metroId) query = query.eq('metro_id', metroId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((r: any) => ({
        ...r,
        metro_name: r.metros?.metro || 'Unknown',
      })) as MetroNewsRun[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useMetroNewsPulse(metroId?: string | null) {
  const { data: runs } = useMetroNewsRuns(metroId, 20);

  return useQuery({
    queryKey: ['metro-news-pulse', metroId ?? 'all', runs?.length],
    queryFn: async (): Promise<MetroNewsPulse> => {
      const allRuns = runs || [];
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekRuns = allRuns.filter((r) => new Date(r.ran_at).getTime() > weekAgo && r.status === 'completed');

      const weeklyArticlesPersisted = weekRuns.reduce((s, r) => s + r.articles_persisted, 0);
      const weeklyArticlesFound = weekRuns.reduce((s, r) => s + r.articles_found, 0);

      // Fetch narrative impact count for this week
      let narrativeUsedCount = 0;
      let signalStrength = 0;
      try {
        let nQuery = supabase
          .from('metro_narratives')
          .select('news_items_used_count, news_signal_strength')
          .gt('created_at', new Date(weekAgo).toISOString());
        if (metroId) nQuery = nQuery.eq('metro_id', metroId);
        const { data: narData } = await nQuery;
        narrativeUsedCount = (narData || []).reduce(
          (s: number, n: any) => s + (n.news_items_used_count || 0),
          0,
        );
        const strengths = (narData || []).map((n: any) => n.news_signal_strength || 0);
        signalStrength = strengths.length > 0 ? Math.round(strengths.reduce((a: number, b: number) => a + b, 0) / strengths.length) : 0;
      } catch {
        // non-fatal
      }

      return {
        lastRun: allRuns[0] || null,
        weeklyArticlesPersisted,
        weeklyArticlesFound,
        health: computeHealth(allRuns),
        signalStrength,
        narrativeUsedCount,
      };
    },
    enabled: !!runs,
    staleTime: 1000 * 60 * 2,
  });
}

export function useTriggerMetroNewsRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (metroId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/metro-news-run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ metro_id: metroId }),
        },
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(err.message || `Failed: ${resp.status}`);
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metro-news-runs'] });
      queryClient.invalidateQueries({ queryKey: ['metro-news-pulse'] });
      queryClient.invalidateQueries({ queryKey: ['metro-news-ingestion'] });
    },
  });
}
