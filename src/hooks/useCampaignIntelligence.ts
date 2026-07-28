import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrgActionRow {
  id: string;
  org_id: string;
  action_type: string;
  source: string;
  source_ref_id: string | null;
  hypothesis: string | null;
  created_at: string;
  executed_at: string | null;
  status: string;
}

export interface CampaignOutcomeRow {
  id: string;
  action_id: string;
  outcome_type: string;
  observed_at: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface ActionEffectiveness {
  org_id: string;
  action_type: string;
  source: string;
  total_actions: number;
  successful_actions: number;
  success_rate: number;
  avg_confidence: number | null;
  last_success_at: string | null;
}

export interface SuggestionDecisionRow {
  id: string;
  suggestion_id: string;
  decision: string;
  reason: string;
  evaluated_at: string;
}

/** Actions for an org */
export function useOrgCampaignActions(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-campaign-actions', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_actions')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as OrgActionRow[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/** Outcomes for given action IDs */
export function useCampaignOutcomes(actionIds: string[]) {
  return useQuery({
    queryKey: ['campaign-outcomes', actionIds],
    queryFn: async () => {
      if (actionIds.length === 0) return [];
      const { data, error } = await supabase
        .from('org_campaign_outcomes')
        .select('*')
        .in('action_id', actionIds);
      if (error) throw error;
      return (data || []) as CampaignOutcomeRow[];
    },
    enabled: actionIds.length > 0,
    staleTime: 60_000,
  });
}

/** Effectiveness for an org (materialized view) */
export function useActionEffectiveness(orgId: string | undefined) {
  return useQuery({
    queryKey: ['action-effectiveness', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_action_effectiveness_mv')
        .select('*')
        .eq('org_id', orgId);
      if (error) throw error;
      return (data || []) as ActionEffectiveness[];
    },
    enabled: !!orgId,
    staleTime: 120_000,
  });
}

/** Suggestion decisions for given suggestion IDs */
export function useSuggestionDecisions(suggestionIds: string[]) {
  return useQuery({
    queryKey: ['suggestion-decisions', suggestionIds],
    queryFn: async () => {
      if (suggestionIds.length === 0) return [];
      const { data, error } = await supabase
        .from('campaign_suggestion_decisions')
        .select('*')
        .in('suggestion_id', suggestionIds);
      if (error) throw error;
      return (data || []) as SuggestionDecisionRow[];
    },
    enabled: suggestionIds.length > 0,
    staleTime: 60_000,
  });
}
