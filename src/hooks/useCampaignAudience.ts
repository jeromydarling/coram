import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignAudienceMember {
  id: string;
  campaign_id: string;
  email: string;
  name: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  source: string;
  status: string;
  error_message: string | null;
  failure_category: string | null;
  failure_code: string | null;
  sent_at: string | null;
  provider_message_id: string | null;
  created_at: string | null;
}

export function useCampaignAudience(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-audience', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('email_campaign_audience')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as unknown as CampaignAudienceMember[];
    },
    enabled: !!campaignId,
  });
}
