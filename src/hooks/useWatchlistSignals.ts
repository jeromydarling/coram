import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WatchlistSignalRow {
  id: string;
  org_id: string;
  diff_id: string | null;
  snapshot_id: string | null;
  signal_type: string;
  summary: string;
  confidence: number;
  created_at: string;
}

export function useWatchlistSignals(windowHours: number = 168) {
  return useQuery<WatchlistSignalRow[]>({
    queryKey: ['watchlist-signals', windowHours],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('org_watchlist_signals')
        .select('*')
        .gte('created_at', new Date(Date.now() - windowHours * 3600 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as WatchlistSignalRow[];
    },
    refetchInterval: 30_000,
  });
}
