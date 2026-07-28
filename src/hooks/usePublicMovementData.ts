/**
 * usePublicMovementData — Fetches anonymized communio signals for public marketing surfaces.
 *
 * WHAT: Calls the public-communio-signals edge function for live constellation data.
 * WHERE: ConstellationEmbedSection and other marketing pages.
 * WHY: Replaces hardcoded mock data with real anonymized ecosystem activity.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicMovementTheme {
  theme: string;
  intensity: 'strong' | 'growing' | 'emerging';
}

export interface PublicMovementData {
  themes: PublicMovementTheme[];
  patterns: string[];
  signal_count: number;
  active_metros?: number;
}

const FALLBACK: PublicMovementData = {
  themes: [],
  patterns: [],
  signal_count: 0,
  active_metros: 0,
};

async function fetchPublicMovement(): Promise<PublicMovementData> {
  const { data, error } = await supabase.functions.invoke('public-communio-signals', {
    method: 'GET',
  });

  if (error) {
    console.warn('[PublicMovement] Edge function error, using fallback:', error.message);
    return FALLBACK;
  }

  return data as PublicMovementData;
}

export function usePublicMovementData() {
  return useQuery({
    queryKey: ['public-movement-signals'],
    queryFn: fetchPublicMovement,
    staleTime: 5 * 60 * 1000, // 5 minutes — public data, no rush
    gcTime: 15 * 60 * 1000,
    retry: 1,
    placeholderData: FALLBACK,
  });
}
