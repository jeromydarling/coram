import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

export interface AIUserSettings {
  user_id: string;
  gmail_connected_at: string | null;
  gmail_ai_enabled: boolean;
  gmail_ai_enabled_at: string | null;
  gmail_ai_start_at: string | null;
  auto_approve_threshold: number;
  ocr_auto_followup_enabled: boolean;
  ocr_followup_business_days: number;
  chat_context_window: number;
  ignored_email_domains: string[];
  created_at: string;
  updated_at: string;
}

export function useAIUserSettings() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ai-user-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ai_user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as AIUserSettings | null;
    },
    enabled: !!user?.id,
  });
}

export function useEnableGmailAI() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Use RPC to safely enable Gmail AI (COALESCE preserves existing timestamp)
      const { error } = await supabase.rpc('enable_gmail_ai', {
        p_user_id: user.id,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-user-settings'] });
      toast.success('Gmail AI enabled! Email analysis will start from now.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to enable Gmail AI');
    },
  });
}

export function useUpdateAISettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<AIUserSettings>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('ai_user_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-user-settings'] });
      toast.success('AI settings updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update settings');
    },
  });
}
