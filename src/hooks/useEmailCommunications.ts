import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface EmailCommunication {
  id: string;
  user_id: string;
  contact_id: string | null;
  gmail_message_id: string;
  thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  body_preview: string | null;
  sent_at: string;
  recipient_email: string;
  sender_email: string;
  synced_at: string;
  created_at: string;
  contacts?: {
    id: string;
    name: string;
    email: string | null;
    opportunities?: {
      organization: string;
    } | null;
  } | null;
}

export function useEmailCommunications(contactId?: string) {
  return useQuery({
    queryKey: ['email_communications', contactId],
    queryFn: async () => {
      console.log('[useEmailCommunications] Fetching emails for contactId:', contactId);
      
      let query = supabase
        .from('email_communications')
        .select(`
          *,
          contacts (
            id,
            name,
            email,
            opportunities!contacts_opportunity_id_fkey (
              organization
            )
          )
        `)
        .order('sent_at', { ascending: false });
      
      if (contactId) {
        query = query.eq('contact_id', contactId);
      }
      
      const { data, error } = await query;
      
      console.log('[useEmailCommunications] Result:', { contactId, count: data?.length, error });
      
      if (error) throw error;
      return data as EmailCommunication[];
    },
  });
}

export function useGmailSyncStatus() {
  return useQuery({
    queryKey: ['gmail_sync_status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('gmail_sync_enabled, gmail_last_sync_at, google_calendar_enabled')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });
}

export function useSyncGmail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await supabase.functions.invoke('gmail-sync', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (response.error) {
        throw new Error(response.error.message || 'Failed to sync Gmail');
      }
      
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate all email_communications queries (with and without contactId)
      queryClient.invalidateQueries({ queryKey: ['email_communications'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['gmail_sync_status'] });
      toast.success(data.message || 'Gmail synced successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to sync Gmail');
    },
  });
}
