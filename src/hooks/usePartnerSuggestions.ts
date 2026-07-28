import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PartnerSuggestion {
  id: string;
  metro_id: string;
  narrative_id: string;
  opportunity_id: string;
  suggestion_type: 'check_in' | 'offer_support' | 'introduce_partner' | 'share_resource';
  reasoning: string;
  ai_confidence: number;
  suggested_message_md: string | null;
  created_at: string;
  dismissed: boolean;
  // Joined from opportunities
  organization?: string;
}

export function usePartnerSuggestions(narrativeId: string | undefined) {
  return useQuery({
    queryKey: ['partner-suggestions', narrativeId],
    queryFn: async (): Promise<PartnerSuggestion[]> => {
      if (!narrativeId) return [];
      const { data, error } = await supabase
        .from('narrative_partner_suggestions')
        .select(`
          id, metro_id, narrative_id, opportunity_id,
          suggestion_type, reasoning, ai_confidence,
          suggested_message_md, created_at, dismissed,
          opportunities!inner(organization)
        `)
        .eq('narrative_id', narrativeId)
        .eq('dismissed', false)
        .order('ai_confidence', { ascending: false })
        .limit(5);

      if (error) throw error;

      return (data ?? []).map((row: Record<string, unknown>) => {
        const opp = row.opportunities as { organization: string } | null;
        return {
          id: row.id as string,
          metro_id: row.metro_id as string,
          narrative_id: row.narrative_id as string,
          opportunity_id: row.opportunity_id as string,
          suggestion_type: row.suggestion_type as PartnerSuggestion['suggestion_type'],
          reasoning: row.reasoning as string,
          ai_confidence: row.ai_confidence as number,
          suggested_message_md: row.suggested_message_md as string | null,
          created_at: row.created_at as string,
          dismissed: row.dismissed as boolean,
          organization: opp?.organization,
        };
      });
    },
    enabled: !!narrativeId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from('narrative_partner_suggestions')
        .update({ dismissed: true })
        .eq('id', suggestionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-suggestions'] });
    },
  });
}
