import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OperatorSchedule {
  id: string;
  key: string;
  cadence: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_stats: Record<string, unknown>;
  last_error: Record<string, unknown> | null;
  updated_at: string;
}

export interface SystemHealthEvent {
  id: string;
  schedule_key: string;
  tenant_id: string | null;
  metro_id: string | null;
  status: string;
  stats: Record<string, unknown>;
  error: Record<string, unknown> | null;
  occurred_at: string;
}

export function useOperatorSchedules() {
  return useQuery<OperatorSchedule[]>({
    queryKey: ['operator-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operator_schedules')
        .select('*')
        .order('key');
      if (error) throw error;
      return (data || []) as unknown as OperatorSchedule[];
    },
    refetchInterval: 60_000,
  });
}

export function useSystemHealthEvents(scheduleKey?: string, limit = 50) {
  return useQuery<SystemHealthEvent[]>({
    queryKey: ['system-health-events', scheduleKey, limit],
    queryFn: async () => {
      let q = supabase
        .from('system_health_events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(limit);
      if (scheduleKey) q = q.eq('schedule_key', scheduleKey);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as SystemHealthEvent[];
    },
    refetchInterval: 60_000,
  });
}
