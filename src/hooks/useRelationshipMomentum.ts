import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RelationshipMomentum {
  opportunity_id: string;
  score: number;
  trend: 'rising' | 'stable' | 'falling';
  drivers: MomentumDriver[];
  computed_at: string;
  score_delta: number;
  last_score: number;
}

export interface MomentumDriver {
  type: string;
  label: string;
  evidence_url: string | null;
  evidence_snippet: string | null;
  weight: number;
  ts: string | null;
}

export function useRelationshipMomentum(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['relationship-momentum', opportunityId],
    queryFn: async (): Promise<RelationshipMomentum | null> => {
      if (!opportunityId) return null;

      const { data, error } = await supabase
        .from('relationship_momentum')
        .select('opportunity_id, score, trend, drivers, computed_at, score_delta, last_score')
        .eq('opportunity_id', opportunityId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching momentum:', error);
        throw error;
      }

      if (!data) return null;

      return {
        opportunity_id: data.opportunity_id,
        score: data.score,
        trend: data.trend as RelationshipMomentum['trend'],
        drivers: (data.drivers || []) as unknown as MomentumDriver[],
        computed_at: data.computed_at,
        score_delta: data.score_delta,
        last_score: data.last_score,
      };
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllMomentumRankings() {
  return useQuery({
    queryKey: ['momentum-rankings'],
    queryFn: async (): Promise<(RelationshipMomentum & { organization_name?: string; metro_name?: string })[]> => {
      const { data, error } = await supabase
        .from('relationship_momentum')
        .select('opportunity_id, score, trend, drivers, computed_at, score_delta, last_score')
        .order('score', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching momentum rankings:', error);
        throw error;
      }

      if (!data || data.length === 0) return [];

      // Fetch opportunity details separately to avoid deep type instantiation
      const oppIds = data.map((r) => r.opportunity_id);
      const { data: opps } = await supabase
        .from('opportunities')
        .select('id, organization, metro_id')
        .in('id', oppIds);

      const { data: metros } = await supabase
        .from('metros')
        .select('id, metro');

      const oppMap = new Map((opps || []).map((o) => [o.id, o]));
      const metroMap = new Map((metros || []).map((m) => [m.id, m.metro]));

      return data.map((row) => {
        const opp = oppMap.get(row.opportunity_id);
        return {
          opportunity_id: row.opportunity_id,
          score: row.score,
          trend: row.trend as RelationshipMomentum['trend'],
          drivers: (row.drivers || []) as unknown as MomentumDriver[],
          computed_at: row.computed_at,
          score_delta: row.score_delta,
          last_score: row.last_score,
          organization_name: opp?.organization,
          metro_name: opp?.metro_id ? metroMap.get(opp.metro_id) : undefined,
        };
      });
    },
    staleTime: 1000 * 60 * 5,
  });
}
