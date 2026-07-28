import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

// Field-restricted update: Only these fields can be updated on pending suggestions
type AllowedUpdateFields = {
  suggested_name?: string;
  suggested_email?: string;
  suggested_phone?: string;
  suggested_title?: string;
  suggested_organization?: string;
  task_title?: string;
  task_description?: string;
  task_priority?: string;
  task_due_date?: string | null;
  followup_reason?: string;
};

interface UpdateSuggestionParams {
  suggestionId: string;
  updates: AllowedUpdateFields;
}

export function useUpdateSuggestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ suggestionId, updates }: UpdateSuggestionParams) => {
      // Whitelist allowed fields (client-side enforcement)
      const allowedFields = [
        'suggested_name',
        'suggested_email',
        'suggested_phone',
        'suggested_title',
        'suggested_organization',
        'task_title',
        'task_description',
        'task_priority',
        'task_due_date',
        'followup_reason',
      ];
      
      const sanitizedUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          sanitizedUpdates[key] = value;
        }
      }
      
      if (Object.keys(sanitizedUpdates).length === 0) {
        throw new Error('No valid fields to update');
      }
      
      // Add updated_at timestamp
      sanitizedUpdates.updated_at = new Date().toISOString();
      
      // RLS enforces: only pending suggestions can be updated
      const { data, error } = await supabase
        .from('ai_suggestions')
        .update(sanitizedUpdates)
        .eq('id', suggestionId)
        .eq('status', 'pending') // Extra client-side safety
        .select()
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Suggestion not found or already processed');
        }
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['ai-bundles'] });
      toast.success('Suggestion updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update suggestion');
    },
  });
}
