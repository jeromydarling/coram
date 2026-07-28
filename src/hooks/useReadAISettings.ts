 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from '@/components/ui/sonner';
 
 /**
  * Check if user has a webhook key configured (doesn't expose the actual key for security)
  * The key is write-only - users can create/regenerate but never read it
  */
 export function useHasWebhookKey() {
   const { user } = useAuth();
 
   return useQuery({
     queryKey: ['has-webhook-key', user?.id],
     queryFn: async () => {
       if (!user?.id) return false;
 
       const { data, error } = await supabase
         .rpc('has_webhook_key', { p_user_id: user.id });
 
       if (error) throw error;
       return data ?? false;
     },
     enabled: !!user?.id
   });
 }
 
 /**
  * Regenerate webhook key using secure RPC function.
  * The new key is never returned to the client for security reasons.
  * Users must copy the webhook URL from the Read.ai/Zapier setup instructions.
  */
 export function useRegenerateWebhookKey() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async () => {
       if (!user?.id) throw new Error('Not authenticated');
 
       // Regenerate key via RPC - key is never returned to client
       const { error } = await supabase
         .rpc('regenerate_webhook_key', { p_user_id: user.id });
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['has-webhook-key'] });
       toast.success('Webhook key regenerated. Your previous webhook URL will no longer work.');
     },
     onError: (error: Error) => {
       toast.error(error.message || 'Failed to regenerate key');
     }
   });
 }

export function useNameAliases() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['name-aliases', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('name_aliases')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return (data?.name_aliases || []) as string[];
    },
    enabled: !!user?.id
  });
}

export function useUpdateNameAliases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (aliases: string[]) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          name_aliases: aliases,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['name-aliases'] });
      toast.success('Name aliases updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update aliases');
    }
  });
}
