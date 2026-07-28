/**
 * useDiscoverySignal — Community-shaped discernment signals for discovery results.
 *
 * WHAT: Lets tenants express relevance/noise on search results via calm, non-scoring signals.
 * WHERE: Used on FindPage discovery results (events, grants, people, opportunities).
 * WHY: Discovery evolves through tenant participation, not operator control.
 *       No virality, no rankings — just gentle keyword weighting over time.
 */
import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

export type DiscoverySignalType = 'relevance' | 'curiosity' | 'noise' | 'alignment';

interface UseDiscoverySignalOptions {
  searchType: string;
}

/**
 * Returns helpers to emit and track discovery signals on search results.
 * Signals are fire-and-forget, deduplicated per result per session.
 */
export function useDiscoverySignal({ searchType }: UseDiscoverySignalOptions) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const sentRef = useRef<Set<string>>(new Set());
  const [signalledResults, setSignalledResults] = useState<Record<string, DiscoverySignalType>>({});

  const emit = useCallback(
    (resultId: string, signalType: DiscoverySignalType, contentKey?: string) => {
      if (!user?.id || !tenant?.id) return;

      // Dedupe within session
      const dedupeKey = `${resultId}:${signalType}`;
      if (sentRef.current.has(dedupeKey)) return;
      sentRef.current.add(dedupeKey);

      // Track locally for UI state
      setSignalledResults(prev => ({ ...prev, [resultId]: signalType }));

      // Fire-and-forget upsert — void wrapper suppresses unhandled promise noise
      // TEMP TYPE ESCAPE — discovery_signals not in generated types.ts
      void Promise.resolve(
        supabase
          .from('discovery_signals' as any)
          .upsert(
            {
              user_id: user.id,
              tenant_id: tenant.id,
              search_result_id: resultId,
              signal_type: signalType,
              content_key: contentKey ?? null,
              search_type: searchType,
            },
            { onConflict: 'user_id,search_result_id,signal_type' }
          )
      ).catch(() => {});

      // Gentle acknowledgment
      if (signalType === 'relevance') {
        toast.success('Noted — we\'ll surface more like this', { duration: 2000 });
      } else if (signalType === 'noise') {
        toast.success('Noted — we\'ll adjust', { duration: 2000 });
      }
    },
    [user?.id, tenant?.id, searchType],
  );

  return { emit, signalledResults };
}
