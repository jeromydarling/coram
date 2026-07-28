/**
 * operatorZoneRegistry — Central zone enforcement for operator pages.
 *
 * WHAT: Registry mapping every operator route to its canonical zone.
 * WHERE: Used by OperatorLayout, future compliance checks.
 * WHY: Prevents navigation sprawl; every page must declare a home zone.
 */

export type OperatorZone = 'cura' | 'machina' | 'crescere' | 'scientia' | 'silentium';

export interface ZoneEntry {
  zone: OperatorZone;
  label: string;
  description: string;
}

/** Route prefix → zone mapping. Order matters: first match wins. */
const ZONE_ROUTES: [string, OperatorZone][] = [
  // Cura — Daily stewardship
  ['/operator/nexus/presence', 'cura'],
  ['/operator/nexus/lumen', 'cura'],
  ['/operator/nexus/friction', 'cura'],
  ['/operator/nexus/adoption', 'cura'],
  ['/operator/nexus/guidance', 'cura'],
  ['/operator/nexus/knowledge', 'cura'],
  ['/operator/nexus/playbooks', 'cura'],
  ['/operator/nexus/rhythm', 'cura'],
  ['/operator/nexus/support', 'cura'],
  ['/operator/nexus/arrival', 'cura'],
  ['/operator/nexus/recovery', 'cura'],
  ['/operator/nexus/expansion', 'cura'],
  ['/operator/nexus/notifications', 'cura'],
  ['/operator/nexus/examen', 'cura'],
  ['/operator/nexus/garden-pulse', 'cura'],
  ['/operator/nexus', 'cura'],
  ['/operator/activation', 'cura'],
  ['/operator/communio', 'cura'],

  // Machina — System engine
  ['/operator/qa', 'machina'],
  ['/operator/error-desk', 'machina'],
  ['/operator/platform', 'machina'],
  ['/operator/integrations', 'machina'],
  ['/operator/people', 'crescere'],
  ['/operator/apps', 'crescere'],
  ['/operator/console/apps', 'crescere'],
  ['/operator/intake', 'machina'],
  ['/operator/automation', 'machina'],
  ['/operator/system', 'machina'],
  ['/operator/nexus/simulation', 'machina'],

  // Scientia — Insight & understanding
  ['/operator/nexus/analytics', 'scientia'],
  ['/operator/nexus/federation-analytics', 'scientia'],
  ['/operator/nexus/narrative', 'scientia'],
  ['/operator/nexus/content', 'scientia'],
  ['/operator/nexus/studio', 'scientia'],
  ['/operator/nexus/civitas', 'scientia'],
  ['/operator/testimonium', 'scientia'],
  ['/operator/nexus/discovery-insights', 'scientia'],
  ['/operator/nexus/narrative-ecosystem', 'scientia'],

  // Silentium — Dev utilities
  ['/operator/tour', 'silentium'],
  ['/operator/scenario-lab', 'silentium'],
  ['/operator/overrides', 'silentium'],
  ['/operator/time-machine', 'silentium'],
  ['/operator/manuals', 'silentium'],
  ['/operator/how-to', 'silentium'],
];

/**
 * Look up the canonical zone for a given operator route.
 * Returns 'crescere' as default (growth & economics).
 */
export function resolveZone(pathname: string): OperatorZone {
  for (const [prefix, zone] of ZONE_ROUTES) {
    if (pathname.startsWith(prefix)) return zone;
  }
  // Default zone for unclassified routes
  if (pathname.startsWith('/operator')) return 'crescere';
  return 'crescere';
}

/**
 * Dev-mode warning: log if a route has no explicit zone assignment.
 * Call once on page mount in OperatorLayout.
 */
export function warnUnregisteredRoute(pathname: string): void {
  if (import.meta.env.DEV && pathname.startsWith('/operator')) {
    const matched = ZONE_ROUTES.some(([prefix]) => pathname.startsWith(prefix));
    if (!matched && pathname !== '/operator') {
      console.warn(
        `[Zone Registry] Route "${pathname}" has no explicit zone assignment. ` +
        `Defaulting to "crescere". Register it in operatorZoneRegistry.ts.`
      );
    }
  }
}

/** Human-readable zone metadata */
export const ZONE_META: Record<OperatorZone, { label: string; purpose: string }> = {
  cura:      { label: 'Cura',      purpose: 'What should I focus on today?' },
  machina:   { label: 'Machina',   purpose: 'Is the system running correctly?' },
  crescere:  { label: 'Crescere',  purpose: 'Is the ecosystem growing well?' },
  scientia:  { label: 'Scientia',  purpose: 'What is the system teaching us?' },
  silentium: { label: 'Silentium', purpose: 'Internal tooling & dev utilities' },
};
