import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';

interface CreateFollowupParams {
  event_id: string;
  import_batch_id?: string;
  template_mode?: 'generic' | 'company_kb' | 'org_knowledge';
  org_knowledge_org_id?: string;
  selected_subject_index?: number;
}

interface FollowupResult {
  ok: boolean;
  campaign_id: string;
  audience_count: number;
  subject_variants?: string[];
}

export function useCreateEventFollowupCampaign() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (params: CreateFollowupParams) => {
      const { data, error } = await supabase.functions.invoke('create-event-followup-campaign', {
        body: params,
      });

      if (error) throw new Error(error.message || 'Failed to create campaign');
      if (data?.error) throw new Error(data.error);
      return data as FollowupResult;
    },
    onSuccess: (data) => {
      toast.success(`Draft campaign created with ${data.audience_count} recipients`);
      navigate(`/outreach/campaigns/${data.campaign_id}`);
    },
    onError: (error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    },
  });
}
