/**
 * useCompassPosture — Infers the current NRI companion posture.
 *
 * WHAT: Derives one of four postures (Care, Narrative, Discernment, Restoration)
 *       from the current route, recent action breadcrumbs, and tenant orientation.
 * WHERE: AIChatDrawer header, AIChatButton glow logic.
 * WHY: Gives the assistant a legible orientation without gamification.
 */

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useRecentActions } from './useRecoveryIntelligence';
import { useRelationalOrientation } from './useRelationalOrientation';
import { useTenant } from '@/contexts/TenantContext';
import { buildOrientedWeights, dominantDirection } from '@/lib/compassDirection';
import { isFirstMonth } from '@/lib/tenantAge';
import type { CompassDirection } from '@/lib/compassDirection';

export type CompassPosture = CompassDirection; // north=Narrative, east=Discernment, south=Care, west=Restoration

export const POSTURE_LABELS: Record<CompassPosture, string> = {
  north: 'Narrative posture',
  east: 'Discernment posture',
  south: 'Care posture',
  west: 'Restoration posture',
};

// Routes that strongly signal a particular posture
const NARRATIVE_ROUTES = [
  '/reports', '/intelligence', '/testimonium', '/communio',
  '/operator/nexus', '/operator/garden-pulse', '/operator/atlas',
  '/operator/constellation',
];

const CARE_ROUTES = [
  '/activities', '/visits', '/people', '/events', '/provisions',
  '/outreach', '/admin/activation', '/volunteers', '/projects',
  '/contacts', '/opportunities', '/calendar', '/grants',
];

const DISCERNMENT_ROUTES = [
  '/settings', '/integrations', '/admin/integrations',
  '/operator/machina',
];

// Action event types that signal restoration posture
const RESTORATION_EVENTS = new Set([
  'entity_deleted', 'entity_restored',
]);

export function useCompassPosture(): {
  posture: CompassPosture;
  label: string;
} {
  const location = useLocation();
  const { data: recentActions } = useRecentActions();
  const { orientation } = useRelationalOrientation();
  const { tenant } = useTenant();
  const earlyMode = tenant?.created_at ? isFirstMonth(tenant.created_at) : false;

  const posture = useMemo<CompassPosture>(() => {
    const path = location.pathname;

    // 1) Check recent actions for restoration signals (highest priority)
    if (recentActions && recentActions.length > 0) {
      const twoMinAgo = Date.now() - 2 * 60 * 1000;
      const recentRestorationAction = recentActions.find((a: any) => {
        const meta = a.metadata as Record<string, unknown> | null;
        const eventName = a.event_name;
        const createdAt = new Date(a.created_at).getTime();
        return (
          createdAt > twoMinAgo &&
          (RESTORATION_EVENTS.has(eventName) ||
           (meta && RESTORATION_EVENTS.has(String(meta.event_type ?? ''))))
        );
      });
      if (recentRestorationAction) return 'west';

      // 2) Use recent action kinds with orientation-aware weighting
      const recentKinds = recentActions
        .slice(0, 20)
        .map((a: any) => a.event_name as string)
        .filter(Boolean);

      // Phase 26B: Lower minimum threshold for first month
      const minKindsRequired = earlyMode ? 1 : 3;

      if (recentKinds.length >= minKindsRequired) {
        const weights = buildOrientedWeights(recentKinds, orientation);

        // Phase 26B: Apply early sensitivity multiplier (+25%)
        if (earlyMode) {
          weights.north *= 1.25;
          weights.east *= 1.25;
          weights.south *= 1.25;
          weights.west *= 1.25;
        }

        const total = weights.north + weights.east + weights.south + weights.west;
        if (total > 0) {
          return dominantDirection(weights);
        }
      }
    }

    // 3) Route-based inference (fallback)
    if (NARRATIVE_ROUTES.some(r => path.startsWith(r))) return 'north';
    if (DISCERNMENT_ROUTES.some(r => path.startsWith(r))) return 'east';
    if (CARE_ROUTES.some(r => path.startsWith(r))) return 'south';

    // 4) Default — Care posture (gentle doing)
    return 'south';
  }, [location.pathname, recentActions, orientation, earlyMode]);

  return {
    posture,
    label: POSTURE_LABELS[posture],
  };
}
