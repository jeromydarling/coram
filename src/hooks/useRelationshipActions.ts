import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RelationshipAction {
  id: string;
  opportunity_id: string;
  action_type: string;
  priority_score: number;
  priority_label: string;
  title: string;
  summary: string;
  suggested_timing: string | null;
  due_date: string | null;
  drivers: Array<{ type?: string; label?: string; source_url?: string | null; weight?: number }>;
  evidence: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useRelationshipActions(opportunityId: string | undefined) {
  return useQuery({
    queryKey: ['relationship-actions', opportunityId],
    queryFn: async (): Promise<RelationshipAction[]> => {
      if (!opportunityId) return [];
      const { data, error } = await supabase
        .from('relationship_actions')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .eq('status', 'open')
        .order('priority_score', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as RelationshipAction[];
    },
    enabled: !!opportunityId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateRelationshipAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'done' | 'dismissed' }) => {
      const { error } = await supabase
        .from('relationship_actions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relationship-actions'] });
    },
  });
}
