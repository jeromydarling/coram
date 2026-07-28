import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface DeleteSuggestionResult {
  deleted: number;
  suggestionIds: string[];
}

export function useDeleteSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (suggestionIds: string | string[]): Promise<DeleteSuggestionResult> => {
      const ids = Array.isArray(suggestionIds) ? suggestionIds : [suggestionIds];
      
      if (ids.length === 0) {
        throw new Error('No suggestion IDs provided');
      }
      
      // RLS enforces: only pending or dismissed suggestions can be deleted
      // Using { count: 'exact' } to get accurate delete count
      const { error, count } = await supabase
        .from('ai_suggestions')
        .delete({ count: 'exact' })
        .in('id', ids)
        .in('status', ['pending', 'dismissed']); // Extra client-side safety
      
      if (error) {
        throw error;
      }
      
      return {
        deleted: count || 0,
        suggestionIds: ids,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      
      if (data.deleted === 0) {
        toast.warning('No suggestions were deleted (may already be processed)');
      } else if (data.deleted === 1) {
        toast.success('Suggestion deleted');
      } else {
        toast.success(`Deleted ${data.deleted} suggestions`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete suggestion');
    },
  });
}
