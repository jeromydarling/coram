import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AutomationSummary {
  runs_24h: number;
  failed_24h: number;
  rate_limited_24h: number;
  skipped_24h: number;
  processed_24h: number;
  stuck_runs: number;
}

export interface PulseSummary {
  total_sources: number;
  active_sources: number;
  disabled_sources: number;
  retrying_sources: number;
  last_crawl_at: string | null;
}

export interface NarrativeSummary {
  total_metros_with_narratives: number;
  rebuilt_this_week: number;
  cached_metros: number;
}

export interface DriftSummary {
  total_scores: number;
  scored_this_week: number;
  avg_drift: number | null;
}

export interface SystemHealthData {
  automation: AutomationSummary;
  pulse: PulseSummary;
  narrative: NarrativeSummary;
  drift: DriftSummary;
}

export function useSystemHealth() {
  return useQuery<SystemHealthData>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_health');
      if (error) throw error;
      return data as unknown as SystemHealthData;
    },
    refetchInterval: 60_000,
  });
}
