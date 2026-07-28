import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface StorySuggestion {
  id: string;
  opportunity_id: string;
  metro_id: string;
  suggestion_type: 'check_in' | 'event_connect' | 'reflection_prompt';
  summary: string;
  source_context: Record<string, unknown>;
  status: 'pending' | 'acted' | 'dismissed';
  created_at: string;
}

/**
 * Fetches pending story suggestions for given metro IDs.
 * PRIVACY: Only reads summary text (already safe — no raw reflection/email bodies).
 */
export function useStorySuggestions(metroIds: string[]) {
  return useQuery({
    queryKey: ['story-suggestions', metroIds.sort().join(',')],
    queryFn: async (): Promise<StorySuggestion[]> => {
      if (!metroIds.length) return [];
      const { data, error } = await supabase
        .from('relationship_story_suggestions')
        .select('id, opportunity_id, metro_id, suggestion_type, summary, source_context, status, created_at')
        .in('metro_id', metroIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as StorySuggestion[];
    },
    enabled: metroIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

/** Mark a suggestion as acted or dismissed */
export function useUpdateStorySuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'acted' | 'dismissed' }) => {
      const update: Record<string, unknown> = { status };
      if (status === 'acted') update.acted_at = new Date().toISOString();
      if (status === 'dismissed') update.dismissed_at = new Date().toISOString();
      const { error } = await supabase
        .from('relationship_story_suggestions')
        .update(update)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story-suggestions'] });
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
}
