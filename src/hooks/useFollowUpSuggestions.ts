import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed' | 'snoozed';

export interface FollowUpSuggestion {
  id: string;
  org_id: string;
  source_type: string;
  source_id: string;
  suggested_action_key: string;
  suggested_template_key: string | null;
  suggested_audience_type: string | null;
  reason: string;
  status: SuggestionStatus;
  snoozed_until: string | null;
  converted_campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Fetch follow-up suggestions with optional filters */
export function useFollowUpSuggestions(opts: {
  orgId?: string;
  status?: string;
  limit?: number;
} = {}) {
  const { orgId, status = 'pending', limit = 50 } = opts;
  return useQuery({
    queryKey: ['follow-up-suggestions', orgId, status, limit],
    queryFn: async () => {
      let query = supabase
        .from('follow_up_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (orgId) query = query.eq('org_id', orgId);
      if (status && status !== 'all') query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FollowUpSuggestion[];
    },
    staleTime: 60_000,
  });
}

/** Update a follow-up suggestion status */
export function useFollowUpAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
      days,
    }: {
      id: string;
      action: 'accept' | 'dismiss' | 'snooze';
      days?: number;
    }) => {
      const updates: Record<string, unknown> = {};
      if (action === 'accept') {
        updates.status = 'accepted';
      } else if (action === 'dismiss') {
        updates.status = 'dismissed';
      } else if (action === 'snooze') {
        updates.status = 'snoozed';
        const until = new Date();
        until.setDate(until.getDate() + (days || 7));
        updates.snoozed_until = until.toISOString();
      }

      const { error } = await supabase
        .from('follow_up_suggestions')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-suggestions'] });
      toast.success('Suggestion updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update suggestion');
    },
  });
}
