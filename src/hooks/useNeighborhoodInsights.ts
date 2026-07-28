import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface InsightSource {
  url: string;
  title: string | null;
  snippet: string | null;
  content_hash: string;
}

export interface InsightsJson {
  location_label?: string;
  brief_history?: string;
  demographics_summary?: string;
  current_trends?: string[];
  current_struggles?: string[];
  community_needs?: string[];
  program_opportunities?: string[];
  helpful_articles?: Array<{ title: string; url: string; why: string }>;
  sources?: Array<{ title: string; url: string; quote: string }>;
}

export interface NeighborhoodInsight {
  id: string;
  location_key: string;
  summary: string;
  insights_json: InsightsJson;
  generated_at: string;
  fresh_until: string;
  model: string;
  state_fips?: string | null;
  sources: InsightSource[];
}

export function useNeighborhoodInsight(orgId: string | undefined) {
  return useQuery({
    queryKey: ['neighborhood-insight', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('org_neighborhood_insights')
        .select(`
          id,
          location_key,
          summary,
          insights_json,
          generated_at,
          fresh_until,
          model,
          org_neighborhood_insight_sources (
            url, title, snippet, content_hash
          )
        `)
        .eq('org_id', orgId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        location_key: data.location_key,
        summary: data.summary,
        insights_json: data.insights_json as unknown as InsightsJson,
        generated_at: data.generated_at,
        fresh_until: data.fresh_until,
        model: data.model,
        sources: (data.org_neighborhood_insight_sources || []) as InsightSource[],
      } as NeighborhoodInsight;
    },
    enabled: !!orgId,
    staleTime: 120_000,
  });
}

export function useGenerateNeighborhoodInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, force = false }: { orgId: string; force?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('neighborhood-insights', {
        body: { org_id: orgId, force },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to generate insights');
      return data.insight as NeighborhoodInsight;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['neighborhood-insight', variables.orgId] });
      toast.success('Neighborhood insights generated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to generate insights');
    },
  });
}

/** Recent insights for dashboard */
export function useRecentNeighborhoodInsights(limit = 10) {
  return useQuery({
    queryKey: ['neighborhood-insights-recent', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_neighborhood_insights')
        .select('id, org_id, location_key, summary, generated_at, fresh_until, model')
        .order('generated_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}
