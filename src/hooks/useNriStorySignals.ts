import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NriStorySignal {
  id: string;
  tenant_id: string;
  metro_id: string | null;
  opportunity_id: string | null;
  kind: 'check_in' | 'connection' | 'heads_up' | 'celebration';
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  created_at: string;
}

export function useNriStorySignals(limit = 10) {
  return useQuery<NriStorySignal[]>({
    queryKey: ['nri-story-signals', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nri_story_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as NriStorySignal[];
    },
    refetchInterval: 5 * 60_000,
  });
}
