/**
 * useCommunioActivityLog — silent activity logger for Communio governance.
 *
 * WHAT: Provides a best-effort insert into communio_activity_log for membership and sharing events.
 * WHERE: Called from Communio page hooks (memberships, signals, events).
 * WHY: Captures behavioral patterns for admin governance visibility without blocking primary workflows.
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ActionType = 'joined' | 'left' | 'shared_signal' | 'shared_event' | 'changed_level';

export function useCommunioActivityLog() {
  const log = useCallback(
    async (params: {
      tenantId: string;
      groupId: string;
      actionType: ActionType;
      sharingLevel?: string;
    }) => {
      try {
        await supabase
          .from('communio_activity_log')
          .insert({
            tenant_id: params.tenantId,
            group_id: params.groupId,
            action_type: params.actionType,
            sharing_level: params.sharingLevel ?? null,
          });
      } catch {
        // Best-effort — never block primary workflow
      }
    },
    [],
  );

  return { logCommunioActivity: log };
}
