import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface AnalyzeResult {
  success: boolean;
  analyzed: number;
  suggestions_created: number;
  failed_emails: number;
  message: string;
}

export function useAnalyzeEmails() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (): Promise<AnalyzeResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
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
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Analysis failed');
      }
      
      const data = await response.json() as AnalyzeResult;
      if (!data.success) throw new Error(data.message || 'Analysis failed');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['email-insights-stats'] });
      
      if (data.analyzed === 0) {
        toast.info(data.message);
      } else {
        toast.success(data.message);
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('GMAIL_AI_DISABLED')) {
        toast.error('Enable Gmail AI to analyze emails');
      } else if (error.message.includes('GMAIL_NOT_CONNECTED')) {
        toast.error('Connect Gmail first to use email analysis');
      } else {
        toast.error(error.message || 'Failed to analyze emails');
      }
    },
  });
}
