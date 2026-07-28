/**
 * getAdaptivePromptOrder — Deterministic prompt prioritization.
 *
 * WHAT: Fetches guidance memory for a tenant+context and returns prompts sorted by confidence.
 * WHERE: Used by AssistChip to decide which prompt to show.
 * WHY: Surfaces guidance that historically helps, without AI — just math.
 */

import { supabase } from '@/integrations/supabase/client';

export interface GuidanceMemoryEntry {
  prompt_key: string;
  confidence_score: number;
  intervention_count: number;
  resolution_count: number;
  friction_after_count: number;
}

/**
 * Returns prompt keys sorted by confidence_score DESC.
 * Prefers prompts with intervention_count > 5 AND confidence_score > 0.6
 * Falls back to defaultOrder if no data.
 */
export async function getAdaptivePromptOrder(
  tenantId: string,
  context: string,
  defaultOrder: string[],
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('praeceptum_guidance_memory')
      .select('prompt_key, confidence_score, intervention_count, resolution_count, friction_after_count')
      .eq('tenant_id', tenantId)
      .eq('context', context)
      .order('confidence_score', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return defaultOrder;
    }

    const entries = data as GuidanceMemoryEntry[];

    // Separate high-confidence from the rest
    const highConf = entries.filter(
      (e) => e.intervention_count > 5 && e.confidence_score > 0.6,
    );
    const rest = entries.filter(
      (e) => !(e.intervention_count > 5 && e.confidence_score > 0.6),
    );

    const ordered = [...highConf, ...rest].map((e) => e.prompt_key);

    // Append any defaults not yet in the list
    for (const key of defaultOrder) {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    }

    return ordered;
  } catch {
    return defaultOrder;
  }
}
