/**
 * useExpansionSignal — Silently captures cross-metro behavioral signals.
 *
 * WHAT: Inserts expansion_signals rows when tenant behavior spans metros.
 * WHERE: Called from opportunity create/update, event attendance, discovery, communio, journey changes.
 * WHY: Powers deterministic Expansion Moment detection without AI generation.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExpansionSignalParams {
  tenantId: string;
  metroId: string;
  signalType: string;
  weight: number;
  sourceModule: string;
}

export function useExpansionSignal() {
  const captureSignal = useCallback(async (params: ExpansionSignalParams) => {
    try {
      const { error } = await supabase
        .from('expansion_signals')
        .insert({
          tenant_id: params.tenantId,
          metro_id: params.metroId,
          signal_type: params.signalType,
          weight: params.weight,
          source_module: params.sourceModule,
        });
      if (error) {
        console.warn('[ExpansionSignal] insert failed:', error.message);
      }
    } catch (err) {
      console.warn('[ExpansionSignal] unexpected error:', err);
    }
  }, []);

  return { captureSignal };
}
