/**
 * useCompassGlow — Detects "helpful movement" to trigger a soft compass glow.
 *
 * WHAT: Reads recent action breadcrumbs and sets a time-bounded glow state.
 * WHERE: AIChatButton (compass launcher).
 * WHY: Calm presence indicator — the companion can help, not that it demands attention.
 *
 * PRIVACY: Respects tenant_privacy_settings via the existing eventStream layer.
 *          If recent actions are disabled, only route-based idle hints apply.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRecentActions } from './useRecoveryIntelligence';

/** Action event types that trigger a glow, with duration in ms. */
const GLOW_TRIGGERS: Record<string, number> = {
  entity_deleted: 2 * 60 * 1000,
  entity_restored: 2 * 60 * 1000,
  import_completed: 2 * 60 * 1000,
  entity_created: 2 * 60 * 1000,
  publish: 90 * 1000,
};

const COOLDOWN_MS = 3 * 60 * 1000; // 3-minute cooldown after glow expires

export function useCompassGlow(drawerOpen: boolean): boolean {
  const { data: recentActions } = useRecentActions();
  const [glowing, setGlowing] = useState(false);
  const expiryRef = useRef<number>(0);
  const cooldownRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Never glow when drawer is open — user is already engaged
    if (drawerOpen) {
      setGlowing(false);
      clearTimer();
      return;
    }

    const now = Date.now();

    // Respect cooldown
    if (now < cooldownRef.current) return;

    // Already glowing and not expired
    if (glowing && now < expiryRef.current) return;

    // Check recent actions for a glow trigger
    if (!recentActions || recentActions.length === 0) {
      if (glowing) setGlowing(false);
      return;
    }

    for (const action of recentActions) {
      const eventName = action.event_name;
      const duration = GLOW_TRIGGERS[eventName];
      if (!duration) continue;

      const actionTime = new Date(action.created_at).getTime();
      const expiresAt = actionTime + duration;

      if (now < expiresAt) {
        // Trigger glow
        setGlowing(true);
        expiryRef.current = expiresAt;

        clearTimer();
        timerRef.current = setTimeout(() => {
          setGlowing(false);
          cooldownRef.current = Date.now() + COOLDOWN_MS;
        }, expiresAt - now);
        return;
      }
    }

    // No valid trigger found
    if (glowing) setGlowing(false);
  }, [recentActions, drawerOpen, glowing, clearTimer]);

  // Cleanup on unmount
  useEffect(() => clearTimer, [clearTimer]);

  return glowing;
}
