import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface OrgInsight {
  id: string;
  org_id: string;
  insight_type: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  summary: string;
  explanation: string | null;
  explanation_model: string | null;
  source: Record<string, unknown>;
  generated_at: string;
  valid_until: string;
  status: string;
}

export interface OrgRecommendedAction {
  id: string;
  org_id: string;
  insight_id: string;
  action_type: string;
  title: string;
  description: string;
  cta_label: string;
  cta_context: Record<string, unknown>;
  status: string;
  created_at: string;
}

/** Load open insights for an org */
export function useOrgInsights(orgId: string | undefined) {
  return useQuery({
    queryKey: ['org-insights', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_insights')
        .select('*')
        .eq('org_id', orgId)
        .in('status', ['open', 'converted'])
        .order('generated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as OrgInsight[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/** Load actions for given insight IDs */
export function useOrgActions(insightIds: string[]) {
  return useQuery({
    queryKey: ['org-actions', insightIds],
    queryFn: async () => {
      if (insightIds.length === 0) return [];
      const { data, error } = await supabase
        .from('org_recommended_actions')
        .select('*')
        .in('insight_id', insightIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OrgRecommendedAction[];
    },
    enabled: insightIds.length > 0,
    staleTime: 60_000,
  });
}

/** Generate insights for an org */
export function useGenerateOrgInsights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orgId, force = false }: { orgId: string; force?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('generate-org-insights', {
        body: { org_id: orgId, force },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to generate insights');
      return data as { ok: boolean; cached: boolean; insights: OrgInsight[]; actions: OrgRecommendedAction[] };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['org-insights', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['org-actions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-actions'] });
      if (_data.cached) {
        toast.info('Insights are current — no changes detected');
      } else if (_data.insights.length > 0) {
        toast.success(`${_data.insights.length} insight(s) generated`);
      } else {
        toast.info('No actionable insights found for this organization');
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to generate insights');
    },
  });
}

/** Explain an insight via AI */
export function useExplainInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ insightId }: { insightId: string }) => {
      const { data, error } = await supabase.functions.invoke('explain-org-insight', {
        body: { insight_id: insightId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to generate explanation');
      return data as { ok: boolean; cached: boolean; explanation: string; model: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-insights'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to explain insight');
    },
  });
}

/** Update action status (complete/dismiss) */
export function useUpdateActionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ actionId, status, orgId, actionType }: {
      actionId: string;
      status: 'completed' | 'dismissed';
      orgId: string;
      actionType: string;
    }) => {
      // Update action
      const { error: updateErr } = await supabase
        .from('org_recommended_actions')
        .update({ status })
        .eq('id', actionId);
      if (updateErr) throw updateErr;

      // Record feedback
      const { error: feedbackErr } = await supabase
        .from('org_action_feedback')
        .insert({
          org_id: orgId,
          action_type: actionType,
          outcome: status,
        });
      if (feedbackErr) console.error('Feedback insert failed:', feedbackErr.message);

      return { actionId, status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['org-actions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-actions'] });
      toast.success(`Action ${data.status === 'completed' ? 'completed' : 'dismissed'}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update action');
    },
  });
}

/** Execute an action via edge function (deterministic CTA) */
export function useExecuteAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ actionId }: { actionId: string }) => {
      const { data, error } = await supabase.functions.invoke('execute-org-action', {
        body: { action_id: actionId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || 'Failed to execute action');
      return data as { ok: boolean; action_type: string; navigate_to?: string; campaign_id?: string; task_id?: string; already_executed?: boolean };
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['org-actions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-actions'] });
      queryClient.invalidateQueries({ queryKey: ['org-insights'] });
      if (_data.already_executed) {
        toast.info('Action was already executed');
      } else {
        toast.success(`Action executed: ${_data.action_type.replace(/_/g, ' ')}`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to execute action');
    },
  });
}

/** Dashboard: all open actions across orgs */
export function useDashboardActions(limit = 30) {
  return useQuery({
    queryKey: ['dashboard-actions', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_recommended_actions')
        .select(`
          id, org_id, insight_id, action_type, title, description, cta_label, cta_context, status, created_at,
          org_insights!inner (insight_type, title, severity, confidence, org_id)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as Array<OrgRecommendedAction & { org_insights: Pick<OrgInsight, 'insight_type' | 'title' | 'severity' | 'confidence' | 'org_id'> }>;
    },
    staleTime: 60_000,
  });
}
