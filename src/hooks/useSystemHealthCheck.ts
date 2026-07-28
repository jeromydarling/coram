/**
 * useSystemHealthCheck — Polls the health endpoint for uptime monitoring.
 *
 * WHAT: Fetches /system-health-check and exposes status for Operator surfaces.
 * WHERE: Used in Operator Nexus system health panel.
 * WHY: Gives the Gardener calm visibility into system wellness.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HealthCheckResult {
  ok: boolean;
  timestamp: string;
  version: string;
  checks: {
    database: {
      ok: boolean;
      latency_ms: number;
      error?: string;
    };
  };
}

export function useSystemHealthCheck(enabled = true) {
  return useQuery<HealthCheckResult>({
    queryKey: ['system-health-check'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('system-health-check');
      if (error) throw error;
      return data as HealthCheckResult;
    },
    refetchInterval: 60_000,
    enabled,
    retry: 1,
  });
}
