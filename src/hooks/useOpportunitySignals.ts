import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OpportunitySignal {
  id: string;
  run_id: string;
  opportunity_id: string | null;
  signal_type: string;
  signal_value: string | null;
  confidence: number | null;
  source_url: string | null;
  detected_at: string;
  created_at: string;
}

export interface OpportunitySignalSummary {
  opportunity_id: string;
  count: number;
  latest_at: string;
  signals: OpportunitySignal[];
}

/**
 * Batch-fetch the latest 3 signals per opportunity for a set of IDs.
 * Returns a Map keyed by opportunity_id.
 */
export function useOpportunitySignalsBatch(opportunityIds: string[]) {
  return useQuery({
    queryKey: ['opportunity-signals-batch', opportunityIds],
    queryFn: async (): Promise<Map<string, OpportunitySignalSummary>> => {
      if (opportunityIds.length === 0) return new Map();

      // Fetch latest signals for all given opportunity IDs, ordered by detected_at desc
      const { data, error } = await supabase
        .from('opportunity_signals')
        .select('id, run_id, opportunity_id, signal_type, signal_value, confidence, source_url, detected_at, created_at')
        .in('opportunity_id', opportunityIds)
        .order('detected_at', { ascending: false })
        .limit(opportunityIds.length * 3); // rough upper bound

      if (error) throw error;

      const map = new Map<string, OpportunitySignalSummary>();

      for (const row of (data || []) as OpportunitySignal[]) {
        const oppId = row.opportunity_id;
        if (!oppId) continue;

        const existing = map.get(oppId);
        if (existing) {
          if (existing.signals.length < 3) {
            existing.signals.push(row);
            existing.count++;
          } else {
            existing.count++;
          }
          if (row.detected_at > existing.latest_at) {
            existing.latest_at = row.detected_at;
          }
        } else {
          map.set(oppId, {
            opportunity_id: oppId,
            count: 1,
            latest_at: row.detected_at,
            signals: [row],
          });
        }
      }

      return map;
    },
    enabled: opportunityIds.length > 0,
    staleTime: 60_000, // cache for 1 minute per page load
  });
}

/**
 * Fetch all signals for a single opportunity (for the detail drawer).
 */
export function useOpportunitySignalsDetail(opportunityId: string | null) {
  return useQuery({
    queryKey: ['opportunity-signals-detail', opportunityId],
    queryFn: async () => {
      if (!opportunityId) return [];

      const { data, error } = await supabase
        .from('opportunity_signals')
        .select('id, run_id, opportunity_id, signal_type, signal_value, confidence, source_url, detected_at, created_at')
        .eq('opportunity_id', opportunityId)
        .order('detected_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as OpportunitySignal[];
    },
    enabled: !!opportunityId,
    staleTime: 60_000,
  });
}
