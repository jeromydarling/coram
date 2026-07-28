import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { SegmentDefinition } from './useEmailSegments';
import { useImpulsusCapture } from './useImpulsusCapture';
import { useTestimoniumCapture } from './useTestimoniumCapture';

// Build audience via edge function
export function useBuildAudience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      definition,
      manualEmails,
    }: {
      campaignId: string;
      definition: SegmentDefinition;
      manualEmails?: string;
    }) => {
      const response = await supabase.functions.invoke('campaign-audience', {
        body: {
          action: 'build_audience',
          campaign_id: campaignId,
          definition,
          manual_emails: manualEmails,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to build audience');
      }

      return response.data as { audience_count: number; invalid_count: number; duplicate_count: number };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-audience', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      const msg = `Audience built: ${data.audience_count} recipients`;
      const extras = [];
      if (data.invalid_count > 0) extras.push(`${data.invalid_count} invalid`);
      toast.success(extras.length > 0 ? `${msg} (${extras.join(', ')})` : msg);
    },
    onError: (error) => {
      toast.error(`Failed to build audience: ${error.message}`);
    },
  });
}

// Remove recipients via edge function
export function useRemoveRecipients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      recipientIds,
    }: {
      campaignId: string;
      recipientIds: string[];
    }) => {
      const response = await supabase.functions.invoke('campaign-audience', {
        body: {
          action: 'remove_recipients',
          campaign_id: campaignId,
          recipient_ids: recipientIds,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to remove recipients');
      }

      return response.data as { removed_count: number; new_count: number };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-audience', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaign', variables.campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success(`${data.removed_count} recipient(s) removed`);
    },
    onError: (error) => {
      toast.error(`Failed to remove recipients: ${error.message}`);
    },
  });
}

// Preview email rendering
export function usePreviewEmail() {
  return useMutation({
    mutationFn: async ({
      campaignId,
      audienceId,
      email,
    }: {
      campaignId: string;
      audienceId?: string;
      email?: string;
    }) => {
      const response = await supabase.functions.invoke('campaign-audience', {
        body: {
          action: 'preview',
          campaign_id: campaignId,
          audience_id: audienceId,
          email,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate preview');
      }

      return response.data as {
        subject: string;
        body_html: string;
        rendered_to: Record<string, string>;
      };
    },
    onError: (error) => {
      toast.error(`Preview failed: ${error.message}`);
    },
  });
}

// Send test email
export function useSendTestEmail() {
  return useMutation({
    mutationFn: async ({
      campaignId,
      toEmail,
    }: {
      campaignId: string;
      toEmail: string;
    }) => {
      const response = await supabase.functions.invoke('gmail-campaign-send', {
        body: {
          action: 'send_test',
          campaign_id: campaignId,
          to_email: toEmail,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send test email');
      }

      return response.data as { sent: boolean; to: string };
    },
    onSuccess: (data) => {
      toast.success(`Test email sent to ${data.to}`);
    },
    onError: (error) => {
      toast.error(`Failed to send test: ${error.message}`);
    },
  });
}

// Send full campaign
export function useSendCampaign() {
  const queryClient = useQueryClient();
  const { captureImpulsus } = useImpulsusCapture();
  const { captureTestimonium } = useTestimoniumCapture();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await supabase.functions.invoke('gmail-campaign-send', {
        body: {
          action: 'send_campaign',
          campaign_id: campaignId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send campaign');
      }

      return { ...(response.data as {
        sent: boolean;
        success_count: number;
        fail_count: number;
      }), _campaignId: campaignId };
    },
    onSuccess: (data) => {
      const campaignId = data._campaignId;
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-audience', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-events', campaignId] });

      if (data.sent) {
        toast.success(
          `Campaign sent! ${data.success_count} delivered, ${data.fail_count} failed.`
        );
      } else {
        toast.warning(
          `Campaign stopped. ${data.success_count} sent before error.`
        );
      }

      const ts = new Date().toISOString();
      captureImpulsus({
        kind: 'campaign',
        dedupeKey: `camp:${campaignId}:${ts}`,
        source: { campaign_id: campaignId, success_count: data.success_count },
      });
      captureTestimonium({
        sourceModule: 'campaign',
        eventKind: 'campaign_touch',
        summary: `I made a campaign touch — ${data.success_count} delivered.`,
        metadata: { campaign_id: campaignId, success_count: data.success_count },
      });
    },
    onError: (error) => {
      toast.error(`Failed to send campaign: ${error.message}`);
    },
  });
}

// Pause campaign
export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await supabase.functions.invoke('gmail-campaign-send', {
        body: { action: 'pause', campaign_id: campaignId },
      });
      if (response.error) throw new Error(response.error.message || 'Failed to pause');
      return response.data;
    },
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Campaign paused');
    },
    onError: (error) => {
      toast.error(`Failed to pause: ${error.message}`);
    },
  });
}

// Resume campaign
export function useResumeCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await supabase.functions.invoke('gmail-campaign-send', {
        body: { action: 'resume', campaign_id: campaignId },
      });
      if (response.error) throw new Error(response.error.message || 'Failed to resume');
      return response.data;
    },
    onSuccess: (_data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Campaign resumed');
    },
    onError: (error) => {
      toast.error(`Failed to resume: ${error.message}`);
    },
  });
}

// Retry failed recipients
export function useRetryFailedRecipients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await supabase.functions.invoke('gmail-campaign-send', {
        body: { action: 'retry_failed', campaign_id: campaignId },
      });
      if (response.error) throw new Error(response.error.message || 'Failed to retry');
      return response.data as { reset_count: number };
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-audience', campaignId] });
      toast.success(`${data.reset_count} failed recipients queued for retry`);
    },
    onError: (error) => {
      toast.error(`Failed to retry: ${error.message}`);
    },
  });
}

// Get Gmail connection status from profile
export function useGmailConnectionStatus() {
  return useQuery({
    queryKey: ['gmail-connection-status'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { isConnected: false, senderEmail: null };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('gmail_email_address, google_calendar_enabled')
        .eq('user_id', user.id)
        .single();

      return {
        isConnected: !!profile?.google_calendar_enabled,
        senderEmail: profile?.gmail_email_address || null,
      };
    },
    staleTime: 30 * 1000,
  });
}

// Campaign events for monitoring
export function useCampaignEvents(campaignId: string | undefined) {
  return useQuery({
    queryKey: ['campaign-events', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('email_campaign_events')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
    refetchInterval: (query) => {
      // Poll every 5s while campaign is sending
      return query.state.data?.some(
        (e: { event_type: string }) => e.event_type === 'send_started'
      ) ? 5000 : false;
    },
  });
}
