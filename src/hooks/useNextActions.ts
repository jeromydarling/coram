import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

export interface NextAction {
  id: string;
  org_id: string;
  source_type: string;
  source_id: string;
  action_type: string;
  summary: string;
  severity: number;
  confidence: number;
  predicted_success_rate: number | null;
  score: number;
  status: string;
  snoozed_until: string | null;
  created_at: string;
  last_evaluated_at: string;
}

/** Top next actions across all orgs for current user, ranked by score */
export function useTopNextActions(limit = 10) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['next-actions-top', user?.id, limit],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_next_actions')
        .select('*')
        .eq('status', 'open')
        .eq('user_id', user!.id)
        .order('score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as NextAction[];
    },
    staleTime: 60_000,
  });
}

/** Next actions for a specific org */
export function useOrgNextActions(orgId: string | undefined) {
  return useQuery({
    queryKey: ['next-actions-org', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('org_next_actions')
        .select('*')
        .eq('org_id', orgId)
        .order('score', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as NextAction[];
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}

/** Update next action status */
export function useUpdateNextAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      snoozed_until,
    }: {
      id: string;
      status: 'executed' | 'dismissed' | 'snoozed';
      snoozed_until?: string;
    }) => {
      const update: Record<string, unknown> = { status };
      if (snoozed_until) update.snoozed_until = snoozed_until;
      const { error } = await supabase
        .from('org_next_actions')
        .update(update)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['next-actions-top'] });
      qc.invalidateQueries({ queryKey: ['next-actions-org'] });
      toast.success('Action updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update action');
    },
  });
}
