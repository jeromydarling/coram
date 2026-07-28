import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, parseISO } from 'date-fns';

interface StaleNextStep {
  id: string;
  organization: string;
  next_step: string;
  stage: string | null;
  updated_at: string;
  daysSinceUpdate: number;
  metroName?: string;
}

/**
 * Finds opportunities with a next_step but no recent activity (>14 days since update).
 * These are opportunities where the RIM wrote a next step but hasn't acted on it.
 */
export function useStaleNextSteps(thresholdDays = 14) {
  return useQuery({
    queryKey: ['stale-next-steps', thresholdDays],
    queryFn: async (): Promise<StaleNextStep[]> => {
      const { data, error } = await supabase
        .from('opportunities')
        .select('id, organization, next_step, stage, updated_at, metros(metro)')
        .not('next_step', 'is', null)
        .not('next_step', 'eq', '')
        .not('stage', 'eq', 'Closed - Not a Fit')
        .not('stage', 'eq', 'Stable Producer')
        .order('updated_at', { ascending: true })
        .limit(50);

      if (error) throw error;

      const today = new Date();
      return (data || [])
        .map(opp => ({
          id: opp.id,
          organization: opp.organization,
          next_step: opp.next_step!,
          stage: opp.stage,
          updated_at: opp.updated_at,
          daysSinceUpdate: differenceInDays(today, parseISO(opp.updated_at)),
          metroName: (opp.metros as any)?.metro,
        }))
        .filter(opp => opp.daysSinceUpdate >= thresholdDays)
        .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });
}
