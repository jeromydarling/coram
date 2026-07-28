import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface ManualIntakeResult {
  success: boolean;
  source_id: string;
  suggestions: Array<{
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    title?: string;
    organization?: string;
    confidence: number;
  }>;
  message: string;
}

export function useManualIntake() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (text: string): Promise<ManualIntakeResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profunda-ai?mode=manual`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      );
      
      if (response.status === 429) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Rate limit exceeded. Please wait and try again.');
      }
      
      if (response.status === 503) {
        throw new Error('Service temporarily unavailable. Please try again later.');
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Manual intake failed');
      }
      
      const data = await response.json() as ManualIntakeResult;
      if (!data.success) throw new Error('Manual intake failed');
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      
      if (data.suggestions.length === 0) {
        toast.warning('No contact information could be extracted');
      } else {
        toast.success(`Extracted ${data.suggestions.length} contact(s) from text`);
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('Rate limit')) {
        toast.error(error.message);
      } else {
        toast.error(error.message || 'Failed to process text');
      }
    },
  });
}
