import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export type OutcomeType = 'completed' | 'ignored' | 'successful' | 'unsuccessful' | 'needs_followup';

export interface ActionOutcome {
  id: string;
  org_id: string;
  action_id: string;
  outcome_type: OutcomeType;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

/** Record an outcome for an action (one per action, append-only) */
export function useRecordOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      actionId,
      orgId,
      outcomeType,
      notes,
    }: {
      actionId: string;
      orgId: string;
      outcomeType: OutcomeType;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('org_action_outcomes')
        .insert({
          action_id: actionId,
          org_id: orgId,
          outcome_type: outcomeType,
          notes: notes || null,
          recorded_by: 'user',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-outcomes'] });
      queryClient.invalidateQueries({ queryKey: ['org-actions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-actions'] });
      queryClient.invalidateQueries({ queryKey: ['insight-effectiveness'] });
      toast.success('Feedback recorded');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to record feedback';
      if (msg.includes('uq_org_action_outcomes_action_id')) {
        toast.info('Feedback already recorded for this action');
      } else {
        toast.error(msg);
      }
    },
  });
}

/** Check if an outcome already exists for given action IDs */
export function useActionOutcomes(actionIds: string[]) {
  return useQuery({
    queryKey: ['action-outcomes', actionIds],
    queryFn: async () => {
      if (actionIds.length === 0) return [];
      const { data, error } = await supabase
        .from('org_action_outcomes')
        .select('*')
        .in('action_id', actionIds);
      if (error) throw error;
      return (data || []) as ActionOutcome[];
    },
    enabled: actionIds.length > 0,
    staleTime: 60_000,
  });
}

/** Insight effectiveness data from the derived view */
export interface InsightEffectiveness {
  insight_id: string;
  org_id: string;
  insight_type: string;
  actions_created: number;
  actions_completed: number;
  actions_successful: number;
  actions_unsuccessful: number;
  success_rate: number | null;
}

export function useInsightEffectiveness(orgId: string | undefined) {
  return useQuery({
    queryKey: ['insight-effectiveness', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_insight_effectiveness_v')
        .select('*')
        .eq('org_id', orgId);
      if (error) throw error;
      return (data || []) as InsightEffectiveness[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
