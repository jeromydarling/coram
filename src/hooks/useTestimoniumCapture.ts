/**
 * useTestimoniumCapture — silent narrative telemetry hook.
 *
 * WHAT: Writes a single testimonium_events row for the current tenant.
 * WHERE: Called from onSuccess handlers across core modules.
 * WHY: Records relationship moments without blocking primary workflows.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

type SourceModule =
  | 'impulsus'
  | 'journey'
  | 'email'
  | 'campaign'
  | 'event'
  | 'voluntarium'
  | 'provisio'
  | 'migration'
  | 'demo_lab'
  | 'local_pulse'
  | 'news_ingest'
  | 'expansion_activation';

interface CaptureParams {
  sourceModule: SourceModule;
  eventKind: string;
  opportunityId?: string;
  metroId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  weight?: number;
}

export function useTestimoniumCapture() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const captureTestimonium = useCallback(
    async (params: CaptureParams) => {
      try {
        const tenantId = tenant?.id;
        if (!tenantId) return;

        const row: Record<string, unknown> = {
          tenant_id: tenantId,
          user_id: user?.id || null,
          source_module: params.sourceModule,
          event_kind: params.eventKind,
          summary: params.summary.slice(0, 240),
          signal_weight: params.weight ?? 1,
          metadata: params.metadata ?? {},
          occurred_at: new Date().toISOString(),
        };

        if (params.opportunityId) row.opportunity_id = params.opportunityId;
        if (params.metroId) row.metro_id = params.metroId;

        const { error } = await supabase
          .from('testimonium_events')
          .insert([row as any]);

        if (error) {
          console.warn('[testimonium] capture failed:', error.message);
        }
      } catch (err) {
        console.warn('[testimonium] capture error:', err);
      }
    },
    [user?.id, tenant?.id],
  );

  return { captureTestimonium };
}
