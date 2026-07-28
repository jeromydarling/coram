import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface ResendCandidate {
  id: string;
  campaign_id: string;
  email: string;
  name: string | null;
  failure_category: string | null;
  failure_code: string | null;
  error_message: string | null;
  created_at: string | null;
}

export function useResendCandidates(campaignId: string | undefined) {
  return useQuery<ResendCandidate[]>({
    queryKey: ['resend-candidates', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('resend_candidates_v1')
        .select('id, campaign_id, email, name, failure_category, failure_code, error_message, created_at')
        .eq('campaign_id', campaignId);

      if (error) throw error;
      return (data || []) as unknown as ResendCandidate[];
    },
    enabled: false, // manual trigger only
  });
}

export function useRequeueCandidates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      audienceIds,
    }: {
      campaignId: string;
      audienceIds: string[];
    }) => {
      // Reset eligible failed rows to queued
      // deno-lint-ignore no-explicit-any
      const { data, error } = await (supabase
        .from('email_campaign_audience') as any)
        .update({
          status: 'queued',
          error_message: null,
          failure_category: null,
          failure_code: null,
          failure_raw: null,
          sent_at: null,
        })
        .in('id', audienceIds)
        .eq('status', 'failed')
        .select('id');

      if (error) throw error;

      const requeuedCount = data?.length ?? 0;

      // Log event
      if (requeuedCount > 0) {
        await supabase.from('email_campaign_events').insert({
          campaign_id: campaignId,
          event_type: 'requeued_failed',
          message: `${requeuedCount} recipients requeued for resend`,
          meta: { requeued_count: requeuedCount, audience_ids: audienceIds },
        });
      }

      return { requeued_count: requeuedCount };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-audience', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['resend-candidates', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaign', variables.campaignId] });
      toast.success(`${data.requeued_count} recipient(s) requeued for resend`);
    },
    onError: (error) => {
      toast.error(`Requeue failed: ${error.message}`);
    },
  });
}
