/**
 * PublicMovementSnapshot — Typed interface for public_movement_cache.
 *
 * WHAT: Readonly cache of anonymized movement data for marketing embeds.
 * WHERE: Atlas, Constellation, Providence, Compass embed components.
 * WHY: Marketing surfaces must NEVER query raw tenant tables — only this cache.
 *
 * NOTE: public_movement_cache is NOT yet in types.ts.
 * When it is added, this interface can be replaced with the generated type.
 * Until then, embed components should import from here for type safety.
 */

export interface PublicMovementSnapshot {
  id: string;
  cache_key: string;
  metro_id: string | null;
  metro_name: string | null;
  archetype_key: string | null;
  movement_type: 'constellation' | 'atlas' | 'providence' | 'compass' | string;
  snapshot_data: {
    node_count?: number;
    edge_count?: number;
    momentum_status?: string;
    narrative_phrase?: string;
    thread_types?: string[];
    compass_directions?: string[];
    [key: string]: unknown;
  };
  computed_at: string;
  expires_at: string | null;
  created_at: string;
}

/**
 * ProvidenceSignalSnapshot — Typed for providence_signals table.
 *
 * NOTE: providence_signals is NOT yet in types.ts.
 * This interface provides compile-time safety until regeneration.
 */
export interface ProvidenceSignalSnapshot {
  id: string;
  tenant_id: string;
  thread_type: string;
  entity_types: string[];
  signal_count: number;
  narrative_phrase: string | null;
  period_start: string;
  period_end: string;
  created_at: string;
}

/**
 * Valid thread types for Providence signals.
 */
export const PROVIDENCE_THREAD_TYPES = [
  'care_thread',
  'presence_thread',
  'provision_thread',
  'restoration_thread',
  'voice_thread',
] as const;

export type ProvidenceThreadType = typeof PROVIDENCE_THREAD_TYPES[number];

export function isProvidenceThreadType(value: string): value is ProvidenceThreadType {
  return (PROVIDENCE_THREAD_TYPES as readonly string[]).includes(value);
}
