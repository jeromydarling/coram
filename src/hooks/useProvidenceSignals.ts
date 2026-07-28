/**
 * useProvidenceSignals — Hooks for Providence overlay (Gardener-only).
 *
 * WHAT: Fetches narrative thread signals for the Gardener Atlas/Constellation.
 * WHERE: GardenPulsePage Providence overlay.
 * WHY: Quiet narrative glue connecting moments of care — never exposed to tenants.
 *
 * NOTE: providence_signals is NOT in types.ts.
 * Uses ProvidenceSignalSnapshot for compile-time safety.
 */

import { useQuery } from '@tanstack/react-query';
import { untypedTable } from '@/lib/untypedTable';
import type { ProvidenceSignalSnapshot } from '@/lib/types/publicMovement';

// Re-export for backward compat
export type ProvidenceSignal = ProvidenceSignalSnapshot;

const THREAD_NARRATIVES: Record<string, string> = {
  care_thread: 'Several moments of care gathered here — visits, notes, or acts of provision that unfolded over time.',
  presence_thread: 'A pattern of presence emerged — repeated attention to a place or community.',
  provision_thread: 'Resources and provisions flowed toward a shared need.',
  restoration_thread: 'Something was reclaimed — a relationship renewed or work reopened.',
  voice_thread: 'Voices gathered — reflections and notes wove into a quiet conversation.',
};

export function useProvidenceSignals(enabled: boolean = true) {
  return useQuery({
    queryKey: ['providence-signals'],
    enabled,
    queryFn: async () => {
      // TEMP TYPE ESCAPE — providence_signals not in types.ts
      const { data, error } = await untypedTable('providence_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ProvidenceSignal[];
    },
  });
}

export function getThreadNarrative(threadType: string): string {
  return THREAD_NARRATIVES[threadType] ?? 'A thread has formed — moments of care connecting over time.';
}

export function getThreadLabel(threadType: string): string {
  const labels: Record<string, string> = {
    care_thread: 'Care',
    presence_thread: 'Presence',
    provision_thread: 'Provision',
    restoration_thread: 'Restoration',
    voice_thread: 'Voice',
  };
  return labels[threadType] ?? 'Thread';
}
