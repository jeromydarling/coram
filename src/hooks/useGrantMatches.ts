import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GrantSuggestion {
  id: string;
  grant_name: string;
  funder_name: string;
  stage: string;
  star_rating: number;
  metro: string | null;
  amount_requested: number | null;
  match_score: number;
  match_reasons: string[];
}

interface GrantMatchResponse {
  opportunity_id: string;
  organization: string;
  suggestions: GrantSuggestion[];
  generatedAt: string;
}

export function useGrantMatches(opportunityId: string | null) {
  return useQuery({
    queryKey: ['grant-matches', opportunityId],
    queryFn: async (): Promise<GrantMatchResponse | null> => {
      if (!opportunityId) return null;
      
      const { data, error } = await supabase.functions.invoke('suggest-grant-matches', {
        body: { opportunity_id: opportunityId }
      });
      
      if (error) {
        console.error('Grant match error:', error);
        return null;
      }
      
      return data as GrantMatchResponse;
    },
    enabled: !!opportunityId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1
  });
}
