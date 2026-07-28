import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export type ReplyOutcome = 'useful' | 'neutral' | 'not_useful';

export interface OutreachReply {
  id: string;
  campaign_id: string;
  audience_id: string | null;
  contact_id: string | null;
  thread_id: string;
  gmail_message_id: string;
  received_at: string;
  direction: string;
  outcome: ReplyOutcome | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

/** Fetch replies for a campaign */
export function useCampaignReplies(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['outreach-replies', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('outreach_replies')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OutreachReply[];
    },
    enabled: !!campaignId,
    staleTime: 30_000,
  });
}

/** Fetch replies for a contact */
export function useContactReplies(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact-replies', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('outreach_replies')
        .select('*')
        .eq('contact_id', contactId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OutreachReply[];
    },
    enabled: !!contactId,
    staleTime: 30_000,
  });
}

/** Acknowledge a reply with an outcome */
export function useAcknowledgeReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      replyId,
      outcome,
    }: {
      replyId: string;
      outcome: ReplyOutcome;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('outreach_replies')
        .update({
          outcome,
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', replyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-replies'] });
      queryClient.invalidateQueries({ queryKey: ['contact-replies'] });
      toast.success('Reply acknowledged');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to acknowledge reply');
    },
  });
}
