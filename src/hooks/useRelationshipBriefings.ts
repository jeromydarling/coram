import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RelationshipBriefing {
  id: string;
  scope: string;
  metro_id: string | null;
  opportunity_id: string | null;
  week_start: string;
  week_end: string;
  briefing_json: {
    headline?: string;
    top_moves?: Array<{ title: string; why: string; when?: string | null; evidence_urls?: string[] }>;
    upcoming_soon?: Array<{ title: string; date?: string | null; why_it_matters?: string; url?: string | null }>;
    watchlist?: Array<{ title: string; note?: string; url?: string | null }>;
    metrics?: { open_actions?: number; high_priority?: number };
  };
  briefing_md: string;
  stats: Record<string, unknown>;
  created_at: string;
}

export function useMetroBriefings(metroId: string | undefined) {
  return useQuery({
    queryKey: ['relationship-briefings', 'metro', metroId],
    queryFn: async (): Promise<RelationshipBriefing[]> => {
      if (!metroId) return [];
      const { data, error } = await supabase
        .from('relationship_briefings')
        .select('*')
        .eq('scope', 'metro')
        .eq('metro_id', metroId)
        .order('week_start', { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data || []) as unknown as RelationshipBriefing[];
    },
    enabled: !!metroId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useOpportunityBriefings(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['relationship-briefings', 'opportunity', opportunityId],
    queryFn: async (): Promise<RelationshipBriefing[]> => {
      if (!opportunityId) return [];
      const { data, error } = await supabase
        .from('relationship_briefings')
        .select('*')
        .eq('scope', 'opportunity')
        .eq('opportunity_id', opportunityId)
        .order('week_start', { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data || []) as unknown as RelationshipBriefing[];
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 10,
  });
}
