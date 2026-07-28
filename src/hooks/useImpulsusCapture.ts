/**
 * useImpulsusCapture — silent, best-effort capture hook.
 *
 * WHAT: Writes a single impulsus_entries row on behalf of the current user.
 * WHERE: Called from onSuccess handlers in existing hooks.
 * WHY: Records relationship moments without blocking primary workflows.
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantOptional } from '@/contexts/TenantContext';
import {
  generateImpulsusEntry,
  sanitizeImpulsusSource,
  type ImpulsusKind,
  type ImpulsusContext,
} from '@/lib/impulsusTemplates';

interface CaptureParams {
  kind: ImpulsusKind;
  opportunityId?: string;
  metroId?: string;
  occurredAt?: string;
  dedupeKey?: string;
  source?: Record<string, unknown>;
  context?: ImpulsusContext;
}

// Lightweight cache for settings — avoid re-fetching per capture
interface SettingsCache {
  userId: string;
  data: Record<string, boolean>;
  fetchedAt: number;
}

const SETTINGS_TTL_MS = 60_000; // 1 minute

const settingsKindMap: Record<ImpulsusKind, string> = {
  reflection: 'capture_reflections',
  email: 'capture_email_actions',
  campaign: 'capture_email_actions',
  ai_suggestion: 'capture_ai_suggestions',
  event: 'capture_calendar_events',
  journey: 'capture_reflections', // journey has no dedicated toggle; defaults on
  task: 'capture_email_actions',
};

export function useImpulsusCapture() {
  const { user } = useAuth();
  const tenantCtx = useTenantOptional();
  const tenant = tenantCtx?.tenant ?? null;
  const cacheRef = useRef<SettingsCache | null>(null);

  const captureImpulsus = useCallback(
    async (params: CaptureParams) => {
      try {
        const userId = user?.id;
        if (!userId) return;

        // --- Settings check (cached) ---
        let settings = cacheRef.current;
        if (
          !settings ||
          settings.userId !== userId ||
          Date.now() - settings.fetchedAt > SETTINGS_TTL_MS
        ) {
          const { data } = await supabase
            .from('impulsus_settings')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          settings = {
            userId,
            data: (data || {}) as Record<string, boolean>,
            fetchedAt: Date.now(),
          };
          cacheRef.current = settings;
        }

        const toggleKey = settingsKindMap[params.kind];
        if (toggleKey && settings.data[toggleKey] === false) return;

        // --- Generate entry ---
        const { title, narrative, tags } = generateImpulsusEntry(params.kind, params.context);
        const safeSource = sanitizeImpulsusSource(params.source || {});

        const row: Record<string, unknown> = {
          user_id: userId,
          kind: params.kind,
          title,
          narrative,
          tags,
          source: safeSource,
          occurred_at: params.occurredAt || new Date().toISOString(),
        };

        if (params.opportunityId) row.opportunity_id = params.opportunityId;
        if (params.metroId) row.metro_id = params.metroId;

        // Only include dedupe_key when it's a non-empty string
        if (params.dedupeKey && params.dedupeKey.trim().length > 0) {
          row.dedupe_key = params.dedupeKey;
        }

        // --- Insert (catch 23505 unique violation as success) ---
        const { error } = await supabase
          .from('impulsus_entries')
          .insert(row as any);

        if (error) {
          // Unique violation = dedupe working correctly
          if (error.code === '23505') return;
          console.warn('[impulsus] capture failed:', error.message);
        }

        // Silent testimonium capture alongside impulsus
        try {
          const tenantId = tenant?.id;
          if (tenantId) {
            const moduleMap: Record<string, string> = {
              reflection: 'impulsus',
              email: 'email',
              campaign: 'campaign',
              ai_suggestion: 'email',
              event: 'event',
              journey: 'journey',
              task: 'email',
            };
            const summaryMap: Record<string, string> = {
              reflection: 'I left a reflection.',
              email: 'I sent an email.',
              campaign: 'I made a campaign touch.',
              ai_suggestion: 'I acted on an AI suggestion.',
              event: 'I showed up to an event.',
              journey: 'I moved a partner forward.',
              task: 'I created a task from an insight.',
            };
            await supabase.from('testimonium_events').insert({
              tenant_id: tenantId,
              user_id: userId,
              source_module: moduleMap[params.kind] || 'impulsus',
              event_kind: `${params.kind}_added`,
              summary: summaryMap[params.kind] || 'A moment was captured.',
              metadata: {},
              occurred_at: params.occurredAt || new Date().toISOString(),
              opportunity_id: params.opportunityId || null,
              metro_id: params.metroId || null,
            });
          }
        } catch { /* silent */ }
      } catch (err) {
        console.warn('[impulsus] capture error:', err);
      }
    },
    [user?.id],
  );

  return { captureImpulsus };
}
