/**
 * usePraeceptumUpdate — Non-blocking guidance memory reporter.
 *
 * WHAT: Sends intervention/resolution/friction_after events to praeceptum-update.
 * WHERE: Called from AssistChip and Signum hooks.
 * WHY: Teaches the system which guidance works — deterministically, not with AI.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

type PraeceptumEventType = 'intervention' | 'resolution' | 'friction_after';

interface PraeceptumParams {
  promptKey: string;
  context: string;
  eventType: PraeceptumEventType;
  archetypeKey?: string;
}

export function usePraeceptumUpdate() {
  const { tenant } = useTenant();

  const reportGuidanceEvent = useCallback(
    async (params: PraeceptumParams) => {
      try {
        const tenantId = tenant?.id;
        if (!tenantId) return;

        await supabase.functions.invoke('praeceptum-update', {
          body: {
            tenant_id: tenantId,
            prompt_key: params.promptKey,
            context: params.context,
            event_type: params.eventType,
            archetype_key: params.archetypeKey,
          },
        });
      } catch {
        // Never block UI
      }
    },
    [tenant?.id],
  );

  return { reportGuidanceEvent };
}
