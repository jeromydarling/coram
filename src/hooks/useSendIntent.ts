import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface SendIntent {
  id: string;
  campaign_id: string;
  created_by: string;
  created_at: string;
  intent_status: 'proposed' | 'acknowledged' | 'consumed' | 'expired';
  rationale: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_reasons: string[];
  requires_ack: boolean;
  acked_at: string | null;
  consumed_at: string | null;
  expires_at: string;
}

export interface RiskEvalResult {
  risk_level: 'low' | 'medium' | 'high';
  risk_reasons: string[];
  audience_size: number;
  transient_failure_rate: number | null;
  org_success_rate: number | null;
  subject_reuse_count: number | null;
  inputs_hash: string;
}

// Fetch active intent for a campaign
export function useActiveIntent(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['send-intent', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from('email_campaign_send_intents')
        .select('*')
        .eq('campaign_id', campaignId)
        .in('intent_status', ['proposed', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // Check client-side expiry
      if (new Date(data.expires_at) < new Date()) {
        return null; // Expired
      }

      return data as unknown as SendIntent;
    },
    enabled: !!campaignId,
    refetchInterval: 15_000, // Check expiry
  });
}

// Evaluate campaign risk
export function useEvaluateCampaignRisk() {
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await supabase.functions.invoke('evaluate-campaign-risk', {
        body: { campaign_id: campaignId },
      });
      if (response.error) throw new Error(response.error.message || 'Risk evaluation failed');
      return response.data as RiskEvalResult;
    },
    onError: (error) => {
      toast.error(`Risk evaluation failed: ${error.message}`);
    },
  });
}

// Fetch cached risk eval
export function useCachedRiskEval(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['risk-eval', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from('email_campaign_risk_eval')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle();

      if (error) throw error;
      return data as {
        risk_level: string;
        risk_reasons: string[];
        audience_size: number;
        inputs_hash: string;
      } | null;
    },
    enabled: !!campaignId,
  });
}

// Create send intent
export function useCreateSendIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      rationale,
    }: {
      campaignId: string;
      rationale?: string;
    }) => {
      const response = await supabase.functions.invoke('create-send-intent', {
        body: { campaign_id: campaignId, rationale },
      });
      if (response.error) throw new Error(response.error.message || 'Failed to create send intent');
      return response.data as {
        intent: SendIntent;
        risk: { risk_level: string; risk_reasons: string[]; audience_size: number };
      };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['send-intent', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['risk-eval', variables.campaignId] });
    },
    onError: (error) => {
      toast.error(`Failed to create send intent: ${error.message}`);
    },
  });
}

// Acknowledge send intent
export function useAcknowledgeSendIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await supabase.functions.invoke('acknowledge-send-intent', {
        body: { campaign_id: campaignId },
      });
      if (response.error) throw new Error(response.error.message || 'Failed to acknowledge');
      return response.data as { ok: boolean };
    },
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['send-intent', campaignId] });
      toast.success('Send intent acknowledged');
    },
    onError: (error) => {
      toast.error(`Failed to acknowledge: ${error.message}`);
    },
  });
}
