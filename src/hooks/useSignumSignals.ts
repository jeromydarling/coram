/**
 * useSignumSignals — Passive human friction intelligence hook.
 *
 * WHAT: Detects idle pauses, repeated nav, form abandonment, and repeated edits.
 * WHERE: Mounted on key pages (Opportunities, Provisions, Events, Onboarding, Campaigns).
 * WHY: Feeds gentle friction signals into Testimonium without blocking workflows.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useTestimoniumCapture } from '@/hooks/useTestimoniumCapture';
import { usePraeceptumUpdate } from '@/hooks/usePraeceptumUpdate';
import { useLocation } from 'react-router-dom';

interface SignumConfig {
  /** Module name for Testimonium source_module */
  context: string;
  /** Idle threshold in ms before emitting friction_idle (default 60000) */
  idleThresholdMs?: number;
  /** Whether this hook is active */
  enabled?: boolean;
}

export function useSignumSignals({ context, idleThresholdMs = 60_000, enabled = true }: SignumConfig) {
  const { captureTestimonium } = useTestimoniumCapture();
  const { reportGuidanceEvent } = usePraeceptumUpdate();
  const location = useLocation();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionCountRef = useRef(0);
  const idleFiredRef = useRef(false);
  const navCountRef = useRef(0);
  const lastNavRef = useRef('');
  const editCountRef = useRef(0);
  const editTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frictionAfterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAssistPromptRef = useRef<string | null>(null);

  // Reset idle on user interaction
  const resetIdle = useCallback(() => {
    interactionCountRef.current += 1;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleFiredRef.current = false;

    idleTimerRef.current = setTimeout(() => {
      if (idleFiredRef.current) return;
      idleFiredRef.current = true;
      try {
        captureTestimonium({
          sourceModule: 'local_pulse',
          eventKind: 'friction_idle',
          summary: `Idle pause on ${context} page`,
          metadata: {
            context,
            page: location.pathname,
            duration_ms: idleThresholdMs,
            interaction_count: interactionCountRef.current,
            source: 'signum',
          },
          weight: 1,
        });
      } catch {
        // Never throw from telemetry
      }
    }, idleThresholdMs);
  }, [captureTestimonium, context, idleThresholdMs, location.pathname]);

  // Detect repeated navigation collapses/expansions
  const trackNavExpansion = useCallback((target: string) => {
    if (target === lastNavRef.current) {
      navCountRef.current += 1;
      if (navCountRef.current >= 3) {
        try {
          captureTestimonium({
            sourceModule: 'local_pulse',
            eventKind: 'friction_repeat_nav',
            summary: `Repeated navigation in ${context}`,
            metadata: {
              context,
              page: location.pathname,
              repeat_count: navCountRef.current,
              source: 'signum',
            },
            weight: 2,
          });
        } catch {
          // silent
        }
        navCountRef.current = 0;
      }
    } else {
      lastNavRef.current = target;
      navCountRef.current = 1;
    }
  }, [captureTestimonium, context, location.pathname]);

  // Detect rapid repeated edits (same field edited 5+ times in 30s)
  const trackRepeatedEdit = useCallback(() => {
    editCountRef.current += 1;
    if (editTimerRef.current) clearTimeout(editTimerRef.current);
    editTimerRef.current = setTimeout(() => {
      editCountRef.current = 0;
    }, 30_000);

    if (editCountRef.current >= 5) {
      try {
        captureTestimonium({
          sourceModule: 'local_pulse',
          eventKind: 'friction_multi_edit',
          summary: `Repeated edits detected in ${context}`,
          metadata: {
            context,
            page: location.pathname,
            edit_count: editCountRef.current,
            source: 'signum',
          },
          weight: 2,
        });
      } catch {
        // silent
      }
      editCountRef.current = 0;
    }
  }, [captureTestimonium, context, location.pathname]);

  // Track form abandonment (navigating away from a page with unsaved interactions)
  const emitAbandon = useCallback(() => {
    if (interactionCountRef.current >= 3) {
      try {
        captureTestimonium({
          sourceModule: 'local_pulse',
          eventKind: 'friction_abandon_flow',
          summary: `Flow abandoned in ${context}`,
          metadata: {
            context,
            page: location.pathname,
            interaction_count: interactionCountRef.current,
            source: 'signum',
          },
          weight: 2,
        });
      } catch {
        // silent
      }
    }
  }, [captureTestimonium, context, location.pathname]);

  // Track help system opening
  const trackHelpOpen = useCallback(() => {
    try {
      captureTestimonium({
        sourceModule: 'local_pulse',
        eventKind: 'friction_help_open',
        summary: `Help opened on ${context} page`,
        metadata: {
          context,
          page: location.pathname,
          source: 'signum',
        },
        weight: 1,
      });
    } catch {
      // silent
    }
  }, [captureTestimonium, context, location.pathname]);

  // Setup idle detection listeners
  useEffect(() => {
    if (!enabled) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => resetIdle();

    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    resetIdle(); // Start initial timer

    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (editTimerRef.current) clearTimeout(editTimerRef.current);
    };
  }, [enabled, resetIdle]);

  // Emit abandon on unmount if interactions happened
  useEffect(() => {
    if (!enabled) return;
    return () => {
      emitAbandon();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Track when an AssistChip prompt was shown — start 2-min friction_after window
  const trackAssistShown = useCallback((promptKey: string) => {
    lastAssistPromptRef.current = promptKey;
    if (frictionAfterTimerRef.current) clearTimeout(frictionAfterTimerRef.current);
    frictionAfterTimerRef.current = setTimeout(() => {
      lastAssistPromptRef.current = null;
    }, 120_000); // 2 minute window
  }, []);

  // Report resolution — user completed action after assist
  const trackAssistResolution = useCallback((promptKey: string) => {
    try {
      captureTestimonium({
        sourceModule: 'local_pulse',
        eventKind: 'assistant_resolution',
        summary: `Guidance resolved in ${context}`,
        metadata: { context, page: location.pathname, prompt_key: promptKey, source: 'signum' },
        weight: 3,
      });
      reportGuidanceEvent({ promptKey, context, eventType: 'resolution' });
    } catch {
      // silent
    }
    lastAssistPromptRef.current = null;
    if (frictionAfterTimerRef.current) clearTimeout(frictionAfterTimerRef.current);
  }, [captureTestimonium, reportGuidanceEvent, context, location.pathname]);

  // Report friction_after if friction fires within the assist window
  const reportFrictionAfter = useCallback(() => {
    const promptKey = lastAssistPromptRef.current;
    if (!promptKey) return;
    try {
      reportGuidanceEvent({ promptKey, context, eventType: 'friction_after' });
    } catch {
      // silent
    }
    lastAssistPromptRef.current = null;
  }, [reportGuidanceEvent, context]);

  // Clean up friction_after timer
  useEffect(() => {
    return () => {
      if (frictionAfterTimerRef.current) clearTimeout(frictionAfterTimerRef.current);
    };
  }, []);

  return {
    trackNavExpansion,
    trackRepeatedEdit,
    trackHelpOpen,
    trackAssistShown,
    trackAssistResolution,
    reportFrictionAfter,
  };
}
