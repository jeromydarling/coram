import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface SyncAndAnalyzeResult {
  syncedEmails: number;
  analyzed: number;
  suggestions_created: number;
}

export function useSyncAndAnalyzeEmails() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (): Promise<SyncAndAnalyzeResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      // Step 1: Sync Gmail to pull new emails
      toast.info('Syncing emails from Gmail...');
      
      const syncResponse = await supabase.functions.invoke('gmail-sync', {
        body: { action: 'sync' },
      });
      
      if (syncResponse.error) {
        throw new Error(syncResponse.error.message || 'Gmail sync failed');
      }
      
      // gmail-sync returns { syncedCount, matchedCount, rematchedCount, message }
      const syncedEmails =
        (typeof syncResponse.data?.syncedCount === 'number' ? syncResponse.data.syncedCount : undefined) ??
        (typeof syncResponse.data?.synced === 'number' ? syncResponse.data.synced : 0);
      
      // Step 2: Run AI analysis on synced emails
      toast.info('Analyzing emails for insights...');
      
      const analyzeResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profunda-ai?mode=analyze`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      
      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.message || errorData.error || 'Analysis failed');
      }
      
      const analyzeData = await analyzeResponse.json();
      
      return {
        syncedEmails,
        analyzed: analyzeData.analyzed || 0,
        suggestions_created: analyzeData.suggestions_created || 0,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['ai-bundles'] });
      queryClient.invalidateQueries({ queryKey: ['email-insights-stats'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-replies'] });
      queryClient.invalidateQueries({ queryKey: ['contact-replies'] });
      // Email history queries use the 'email_communications' key.
      queryClient.invalidateQueries({ queryKey: ['email_communications'], exact: false });
      
      if (data.syncedEmails === 0 && data.analyzed === 0) {
        toast.info('No new emails to analyze');
      } else if (data.suggestions_created > 0) {
        toast.success(`Synced ${data.syncedEmails} emails, created ${data.suggestions_created} suggestions`);
      } else {
        toast.success(`Synced ${data.syncedEmails} emails, analyzed ${data.analyzed}`);
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('GMAIL_AI_DISABLED')) {
        toast.error('Enable Gmail AI in Settings first');
      } else if (error.message.includes('GMAIL_NOT_CONNECTED') || error.message.includes('not connected')) {
        toast.error('Connect Gmail via Calendar page first');
      } else {
        toast.error(error.message || 'Sync & analyze failed');
      }
    },
  });
}
