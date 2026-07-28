import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface EmailCampaign {
  id: string;
  created_by: string;
  name: string;
  subject: string;
  preheader: string | null;
  html_body: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  segment_id: string | null;
  status: 'draft' | 'audience_ready' | 'syncing' | 'scheduled' | 'sending' | 'paused' | 'sent' | 'failed' | 'canceled';
  scheduled_at: string | null;
  audience_count: number;
  sent_count: number;
  failed_count: number;
  last_sent_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function useEmailCampaigns() {
  return useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as EmailCampaign[];
    }
  });
}

export function useEmailCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['email-campaign', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as unknown as EmailCampaign;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const campaign = query.state.data;
      // Auto-refresh while sending
      if (campaign?.status === 'sending') return 5000;
      return false;
    },
  });
}

export function useCreateEmailCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (campaign: {
      name: string;
      subject: string;
      preheader?: string;
      html_body?: string;
      from_name?: string;
      from_email?: string;
      reply_to?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('email_campaigns')
        .insert({ ...campaign, created_by: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as EmailCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Campaign created');
    },
    onError: (error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    }
  });
}

export function useUpdateEmailCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EmailCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('email_campaigns')
        .update({ ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as EmailCampaign;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['email-campaign', data.id] });
      toast.success('Campaign updated');
    },
    onError: (error) => {
      toast.error(`Failed to update campaign: ${error.message}`);
    }
  });
}

export function useDeleteEmailCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Campaign deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete campaign: ${error.message}`);
    }
  });
}

export function useDuplicateEmailCampaign() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: original, error: fetchError } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      if (!original) throw new Error('Campaign not found');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('email_campaigns')
        .insert({
          name: `${original.name} (Copy)`,
          subject: original.subject,
          preheader: original.preheader,
          html_body: original.html_body,
          from_name: original.from_name,
          from_email: original.from_email,
          reply_to: original.reply_to,
          segment_id: original.segment_id,
          created_by: user.id,
          status: 'draft',
          audience_count: 0,
          scheduled_at: null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as EmailCampaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success('Campaign duplicated');
    },
    onError: (error) => {
      toast.error(`Failed to duplicate campaign: ${error.message}`);
    }
  });
}
