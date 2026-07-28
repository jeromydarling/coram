/**
 * useDiscernmentSignal — Anonymous interaction signal emitter for marketing pages.
 *
 * WHAT: Captures anonymous interaction patterns (card opens, CTA clicks, essay reads) without PII.
 * WHERE: Used on public marketing pages (/see-people, /archetypes, /roles, /pricing, /manifesto, /essays/*).
 * WHY: Powers Collective Discernment Signals — NRI interprets aggregate patterns into human-language operator insights.
 */
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Allowed event keys — keep aligned with operator analytics cards */
export type DiscernmentEventKey =
  | 'reflection_card_opened'
  | 'question_expanded'
  | 'essay_read_start'
  | 'essay_read_complete'
  | 'cta_clicked'
  | 'archetype_story_opened'
  | 'page_view';

/**
 * Returns a fire-and-forget signal emitter.
 * No session ID stored — fully anonymous, no cookies, no fingerprinting.
 */
export function useDiscernmentSignal(pageKey: string) {
  const sentRef = useRef<Set<string>>(new Set());

  const emit = useCallback(
    (eventKey: DiscernmentEventKey, contentKey?: string) => {
      const dedupeKey = `${eventKey}:${contentKey ?? ''}`;
      if (sentRef.current.has(dedupeKey)) return;
      sentRef.current.add(dedupeKey);

      // Fire-and-forget — void wrapper suppresses unhandled promise noise
      void Promise.resolve(
        supabase
          .from('marketing_discernment_signals')
          .insert({ page_key: pageKey, event_key: eventKey, content_key: contentKey ?? null })
      ).catch(() => {});
    },
    [pageKey],
  );

  return emit;
}
