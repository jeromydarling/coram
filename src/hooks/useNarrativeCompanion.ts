/**
 * useNarrativeCompanion — Core detection logic for Narrative Companion Mode.
 *
 * WHAT: Monitors friction patterns and selects the right micro-guidance card.
 * WHERE: Rendered inside CompanionTray on every page.
 * WHY: Non-intrusive, role-aware guidance that helps users discover features.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useCompanionMode } from './useCompanionMode';
import { MICRO_GUIDANCE_REGISTRY, type MicroGuide } from '@/content/microGuidanceRegistry';
import { supabase } from '@/integrations/supabase/client';

const IDLE_THRESHOLD_MS = 35_000;
const RAGE_CLICK_THRESHOLD = 4;
const RAGE_CLICK_WINDOW_MS = 3_000;
const SESSION_KEY_PREFIX = 'companion_shown_';

type TriggerType = 'friction_idle' | 'friction_rage_click' | 'first_time_page' | 'repeat_attempt' | 'manual_open';

function getUserRole(profile: any): string {
  return profile?.ministry_role || 'companion';
}

function getRouteBase(pathname: string): string {
  // Normalize: /tenant-slug/opportunities/123 → /opportunities
  const parts = pathname.split('/').filter(Boolean);
  // Skip tenant slug if present
  if (parts.length >= 2) return '/' + parts[1];
  if (parts.length === 1) return '/' + parts[0];
  return '/';
}

export function useNarrativeCompanion() {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const { isActive, isHipaaSensitive } = useCompanionMode();
  const location = useLocation();

  const [activeGuide, setActiveGuide] = useState<MicroGuide | null>(null);
  const [currentTrigger, setCurrentTrigger] = useState<TriggerType | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimestamps = useRef<number[]>([]);
  const shownThisSession = useRef<Set<string>>(new Set());

  const routeBase = getRouteBase(location.pathname);
  const role = getUserRole(profile);
  const archetype = tenant?.archetype ?? null;

  // Session-level "already shown on this route" check
  const sessionKey = SESSION_KEY_PREFIX + routeBase;
  const alreadyShownOnRoute = useCallback(() => {
    return shownThisSession.current.has(sessionKey);
  }, [sessionKey]);

  // Dismiss stored in localStorage for persistent dismissals
  const isDismissed = useCallback((guideKey: string) => {
    try {
      const dismissed = localStorage.getItem(`companion_dismissed_${guideKey}`);
      return dismissed === 'true';
    } catch { return false; }
  }, []);

  // First-time page check
  const isFirstTimePage = useCallback(() => {
    try {
      const key = `companion_visited_${routeBase}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, 'true');
        return true;
      }
      return false;
    } catch { return false; }
  }, [routeBase]);

  // Select best matching guide
  const selectGuide = useCallback((trigger: TriggerType): MicroGuide | null => {
    if (alreadyShownOnRoute()) return null;

    const candidates = MICRO_GUIDANCE_REGISTRY
      .filter(g => {
        if (isDismissed(g.key)) return false;
        if (!g.roleTargets.includes(role as any)) return false;
        if (g.routes !== '*' && !g.routes.some(r => routeBase.startsWith(r) || routeBase === r)) return false;
        if (!g.triggers.includes(trigger)) return false;
        if (isHipaaSensitive && !g.hipaaSafe) return false;
        return true;
      })
      .sort((a, b) => a.priority - b.priority);

    return candidates[0] ?? null;
  }, [role, routeBase, isHipaaSensitive, alreadyShownOnRoute, isDismissed]);

  // Log event
  const logEvent = useCallback(async (guide: MicroGuide, trigger: TriggerType, action: string) => {
    if (!user?.id || !tenant?.id) return;
    try {
      await supabase.from('micro_guidance_events').insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role,
        archetype_key: archetype,
        route: routeBase,
        guide_key: guide.key,
        trigger_type: trigger,
        action,
        context: {},
      });
    } catch { /* silent — telemetry is non-critical */ }
  }, [user?.id, tenant?.id, role, archetype, routeBase]);

  // Show a guide
  const showGuide = useCallback((trigger: TriggerType) => {
    const guide = selectGuide(trigger);
    if (!guide) return;
    setActiveGuide(guide);
    setCurrentTrigger(trigger);
    shownThisSession.current.add(sessionKey);
    logEvent(guide, trigger, 'shown');
  }, [selectGuide, sessionKey, logEvent]);

  // Accept action
  const acceptGuide = useCallback(() => {
    if (activeGuide && currentTrigger) {
      logEvent(activeGuide, currentTrigger, 'accepted');
    }
    setActiveGuide(null);
    setCurrentTrigger(null);
  }, [activeGuide, currentTrigger, logEvent]);

  // Dismiss action
  const dismissGuide = useCallback((permanent = false) => {
    if (activeGuide && currentTrigger) {
      logEvent(activeGuide, currentTrigger, 'dismissed');
      if (permanent) {
        try { localStorage.setItem(`companion_dismissed_${activeGuide.key}`, 'true'); } catch {}
      }
    }
    setActiveGuide(null);
    setCurrentTrigger(null);
  }, [activeGuide, currentTrigger, logEvent]);

  // Reset on route change
  useEffect(() => {
    setActiveGuide(null);
    setCurrentTrigger(null);

    if (!isActive) return;

    // Check first-time page
    const firstTime = isFirstTimePage();
    if (firstTime) {
      // Small delay so page renders first
      const t = setTimeout(() => showGuide('first_time_page'), 2000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeBase, isActive]);

  // Idle detection
  useEffect(() => {
    if (!isActive || activeGuide) return;

    const resetIdle = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        showGuide('friction_idle');
      }, IDLE_THRESHOLD_MS);
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      events.forEach(e => window.removeEventListener(e, resetIdle));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, activeGuide, routeBase]);

  // Rage-click detection
  useEffect(() => {
    if (!isActive || activeGuide) return;

    const handleClick = () => {
      const now = Date.now();
      clickTimestamps.current.push(now);
      clickTimestamps.current = clickTimestamps.current.filter(t => now - t < RAGE_CLICK_WINDOW_MS);
      if (clickTimestamps.current.length >= RAGE_CLICK_THRESHOLD) {
        showGuide('friction_rage_click');
        clickTimestamps.current = [];
      }
    };

    window.addEventListener('click', handleClick, { passive: true });
    return () => window.removeEventListener('click', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, activeGuide, routeBase]);

  return {
    activeGuide,
    currentTrigger,
    acceptGuide,
    dismissGuide,
    isActive,
  };
}
