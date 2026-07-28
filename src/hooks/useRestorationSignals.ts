/**
 * useRestorationSignals — Hooks for the Restoration Narrative Layer.
 *
 * WHAT: Generates calm narrative signals when entities are restored.
 * WHERE: Called from restore actions (recycle bin, reopen, recover).
 * WHY: Transforms recovery moments into quiet narrative threads for
 *      Gardener Atlas, Constellation, and NRI reflections.
 *
 * PRIVACY: No PII, no entity names, no user identifiers in signals.
 */
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Entity → Restoration Type Map ──────────────────
const RESTORATION_MAP: Record<string, string> = {
  contacts: 'relationship_restored',
  opportunities: 'relationship_restored',
  voice_notes: 'voice_returned',
  activities: 'work_reopened',
  projects: 'work_reopened',
  events: 'work_reopened',
  provisions: 'care_recovered',
  communio_profile: 'structure_restored',
  volunteers: 'care_recovered',
  grants: 'work_reopened',
  reflections: 'voice_returned',
};

/**
 * Generate a restoration signal after a successful restore.
 * Fire-and-forget — never blocks the restore action.
 */
export function useEmitRestorationSignal() {
  const emit = useCallback(async (params: {
    tenantId?: string;
    entityType: string;
    sourceEventId?: string;
  }) => {
    try {
      const restorationType = RESTORATION_MAP[params.entityType] ?? 'structure_restored';

      await supabase
        .from('restoration_signals')
        .insert({
          tenant_id: params.tenantId ?? null,
          source_entity_type: params.entityType,
          restoration_type: restorationType,
          narrative_weight: 'low',
          source_event_ids: params.sourceEventId ? [params.sourceEventId] : [],
          visible_scope: 'tenant_only',
          created_by_system: true,
        });
    } catch {
      // Silent — never block the user action
    }
  }, []);

  return { emitRestorationSignal: emit };
}

export interface RestorationSignal {
  id: string;
  tenant_id: string | null;
  source_entity_type: string;
  restoration_type: string;
  narrative_weight: string;
  visible_scope: string;
  created_at: string;
}

/**
 * Fetch recent restoration signals for Gardener views.
 * Returns aggregated counts by type for narrative use.
 */
export function useRestorationSignals(options?: { limit?: number }) {
  const limit = options?.limit ?? 30;

  return useQuery({
    queryKey: ['restoration-signals', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restoration_signals')
        .select('id, tenant_id, source_entity_type, restoration_type, narrative_weight, visible_scope, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as RestorationSignal[];
    },
  });
}

/**
 * Aggregate restoration signals into narrative-safe counts.
 * No PII, no entity names — only type + count.
 */
export function aggregateRestorationNarrative(signals: RestorationSignal[]): {
  total: number;
  byType: Record<string, number>;
  narrativePhrase: string;
} {
  const byType: Record<string, number> = {};
  signals.forEach(s => {
    byType[s.restoration_type] = (byType[s.restoration_type] || 0) + 1;
  });

  const total = signals.length;

  let narrativePhrase = '';
  if (total === 0) {
    narrativePhrase = '';
  } else if (total === 1) {
    narrativePhrase = 'A quiet moment of restoration occurred.';
  } else if (total <= 5) {
    narrativePhrase = `Several communities quietly reclaimed what they thought was lost.`;
  } else {
    narrativePhrase = `Across the garden, ${total} moments of restoration have unfolded — care remembered.`;
  }

  return { total, byType, narrativePhrase };
}
