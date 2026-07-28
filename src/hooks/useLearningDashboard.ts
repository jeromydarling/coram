import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { untypedTable } from '@/lib/untypedTable';

export interface ActionTypeEffectiveness {
  action_type: string;
  total_actions: number;
  executed_actions: number;
  successful_outcomes: number;
  success_rate: number;
  avg_confidence: number | null;
}

export interface SignalTypeEffectiveness {
  source: string;
  actions_generated: number;
  actions_executed: number;
  successful_outcomes: number;
  success_rate: number;
}

export interface OrgActionHistory {
  org_id: string;
  action_id: string;
  action_type: string;
  source: string;
  action_summary: string | null;
  action_status: string;
  action_created_at: string;
  executed_at: string | null;
  outcome_type: string | null;
  observed_at: string | null;
  outcome_confidence: number | null;
}

/** What works best? (action types) — view not in types.ts */
export function useActionTypeEffectiveness() {
  return useQuery({
    queryKey: ['learning-action-types'],
    queryFn: async () => {
      // TEMP TYPE ESCAPE — action_type_effectiveness_v view not in types.ts
      const { data, error } = await untypedTable('action_type_effectiveness_v')
        .select('*');
      if (error) throw error;
      return (data || []) as ActionTypeEffectiveness[];
    },
    staleTime: 120_000,
  });
}

/** Signal sources → outcomes — view not in types.ts */
export function useSignalTypeEffectiveness() {
  return useQuery({
    queryKey: ['learning-signal-types'],
    queryFn: async () => {
      // TEMP TYPE ESCAPE — signal_type_effectiveness_v view not in types.ts
      const { data, error } = await untypedTable('signal_type_effectiveness_v')
        .select('*');
      if (error) throw error;
      return (data || []) as SignalTypeEffectiveness[];
    },
    staleTime: 120_000,
  });
}

/** Org-level action history */
export function useOrgActionHistory(orgId: string | undefined) {
  return useQuery({
    queryKey: ['learning-org-history', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_action_history_v')
        .select('*')
        .eq('org_id', orgId)
        .limit(100);
      if (error) throw error;
      return (data || []) as OrgActionHistory[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/** "Orgs with signals but no actions" */
export function useIgnoredSignalOrgs() {
  return useQuery({
    queryKey: ['learning-ignored-orgs'],
    queryFn: async () => {
      const { data: signalOrgs, error: e1 } = await supabase
        .from('org_watchlist_signals')
        .select('org_id')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
      if (e1) throw e1;

      const signalOrgIds = [...new Set((signalOrgs || []).map((s) => s.org_id))];
      if (signalOrgIds.length === 0) return [];

      const { data: actionOrgs, error: e2 } = await supabase
        .from('org_actions')
        .select('org_id')
        .eq('status', 'executed')
        .in('org_id', signalOrgIds);
      if (e2) throw e2;

      const actionOrgIds = new Set((actionOrgs || []).map(a => a.org_id));
      const ignored = signalOrgIds.filter(id => !actionOrgIds.has(id));

      if (ignored.length === 0) return [];
      const { data: orgs, error: e3 } = await supabase
        .from('opportunities')
        .select('id, organization')
        .in('id', ignored.slice(0, 20));
      if (e3) throw e3;

      return (orgs || []).map(o => ({
        org_id: o.id,
        organization: o.organization,
      }));
    },
    staleTime: 120_000,
  });
}
