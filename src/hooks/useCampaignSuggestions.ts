import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface CampaignSuggestion {
  id: string;
  org_id: string;
  source_type: string;
  source_id: string;
  suggestion_type: string;
  title: string;
  subject: string;
  body_template: string;
  reason: string;
  confidence: number;
  status: string;
  snoozed_until: string | null;
  converted_campaign_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCampaignSuggestions(filters?: { status?: string; orgId?: string }) {
  return useQuery({
    queryKey: ['campaign-suggestions', filters],
    queryFn: async () => {
      let query = supabase
        .from('campaign_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.orgId) {
        query = query.eq('org_id', filters.orgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CampaignSuggestion[];
    },
    refetchInterval: 30_000,
  });
}

export function useOrgCampaignSuggestions(orgId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-suggestions-org', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('campaign_suggestions')
        .select('*')
        .eq('org_id', orgId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as CampaignSuggestion[];
    },
    enabled: !!orgId,
  });
}

export function useSuggestionAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      suggestion_id: string;
      action: 'convert' | 'dismiss' | 'snooze';
      days?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('campaign-suggestion-convert', {
        body: params,
      });
      if (error) throw error;
      return data as { ok: boolean; campaign_id?: string; action?: string; error?: string };
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-suggestions-org'] });
      if (vars.action === 'convert' && data.campaign_id) {
        toast.success('Draft campaign created');
      } else if (vars.action === 'dismiss') {
        toast.success('Suggestion dismissed');
      } else if (vars.action === 'snooze') {
        toast.success('Suggestion snoozed for 7 days');
      }
    },
    onError: (err) => {
      toast.error(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    },
  });
}
