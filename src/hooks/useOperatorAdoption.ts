import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAdoptionWeekly() {
  return useQuery({
    queryKey: ['operator-adoption-weekly'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_adoption_weekly')
        .select('*, tenants(slug, name)')
        .order('week_start', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useJobHealth() {
  return useQuery({
    queryKey: ['operator-job-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_job_health')
        .select('*')
        .order('job_key', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useValueMoments(limit = 50) {
  return useQuery({
    queryKey: ['operator-value-moments', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_value_moments')
        .select('*, tenants(slug, name)')
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCommunioMonitoring() {
  return useQuery({
    queryKey: ['operator-communio-monitoring'],
    queryFn: async () => {
      const [memberships, signals] = await Promise.all([
        supabase.from('communio_memberships').select('tenant_id', { count: 'exact', head: true }),
        supabase.from('communio_shared_signals').select('metro_id, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      // Count signals per metro
      const metroMap: Record<string, number> = {};
      for (const s of signals.data || []) {
        const mid = s.metro_id || 'unknown';
        metroMap[mid] = (metroMap[mid] || 0) + 1;
      }
      const topMetros = Object.entries(metroMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([metro_id, count]) => ({ metro_id, count }));

      return {
        optInCount: memberships.count ?? 0,
        sharedSignals7d: signals.data?.length ?? 0,
        topMetros,
      };
    },
  });
}
