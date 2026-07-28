import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export function useBounceDetect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data, error } = await supabase.functions.invoke('gmail-bounce-detect', {
        body: { campaign_id: campaignId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { bounced_count: number; bounced_emails: string[]; total_scanned: number };
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-audience', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });

      if (data.bounced_count > 0) {
        toast.warning(`Found ${data.bounced_count} bounced email${data.bounced_count > 1 ? 's' : ''}`);
      } else {
        toast.success(`Scanned ${data.total_scanned} messages — no bounces found`);
      }
    },
    onError: (error) => {
      toast.error(`Bounce detection failed: ${error.message}`);
    },
  });
}
