import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SimilarOpportunity {
  id: string;
  organization: string;
  stage?: string | null;
  metros?: { metro: string } | null;
}

export function useDuplicateCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [similarOpportunities, setSimilarOpportunities] = useState<SimilarOpportunity[]>([]);

  const checkForDuplicates = useCallback(async (
    organizationName: string,
    excludeId?: string
  ): Promise<SimilarOpportunity[]> => {
    if (!organizationName || organizationName.trim().length < 3) {
      setSimilarOpportunities([]);
      return [];
    }

    setIsChecking(true);
    try {
      const trimmedName = organizationName.trim().toLowerCase();
      
      // Search for similar organization names
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, organization, stage, metros(metro)')
        .ilike('organization', `%${trimmedName}%`)
        .limit(5);

      if (error) throw error;

      // Filter out exact matches and the current record if editing
      const filtered = (data || [])
        .filter(opp => {
          if (excludeId && opp.id === excludeId) return false;
          // Check for similar names (Levenshtein distance would be better, but simple contains works)
          const oppName = opp.organization.toLowerCase();
          // Consider similar if: exact match, contains, or starts with same word
          const isSimilar = 
            oppName === trimmedName ||
            oppName.includes(trimmedName) ||
            trimmedName.includes(oppName) ||
            oppName.split(' ')[0] === trimmedName.split(' ')[0];
          return isSimilar;
        });

      setSimilarOpportunities(filtered);
      return filtered;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearDuplicates = useCallback(() => {
    setSimilarOpportunities([]);
  }, []);

  return {
    isChecking,
    similarOpportunities,
    checkForDuplicates,
    clearDuplicates
  };
}
