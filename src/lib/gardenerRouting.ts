/**
 * gardenerRouting — Client-side routing ladder for gardener ticket assignment.
 *
 * WHAT: Pure function that determines which gardener(s) should receive a ticket.
 * WHERE: Used by ticket creation flows, inbox, and notification dispatch.
 * WHY: Ensures tickets reach the right gardener without manual triage.
 *
 * The routing ladder (in order of priority):
 * 1. Explicit primary assignment for tenant
 * 2. Metro scope match
 * 3. Archetype scope match
 * 4. Specialty scope match (e.g. 'integrations')
 * 5. On-call gardener
 * 6. Primary gardener (fallback)
 */

export interface GardenerRecord {
  id: string;
  display_name: string;
  is_active: boolean;
  is_on_call: boolean;
  is_primary: boolean;
}

export interface GardenerScope {
  gardener_id: string;
  scope_type: 'metro' | 'archetype' | 'specialty';
  scope_key: string;
}

export interface TenantAssignment {
  tenant_id: string;
  gardener_id: string;
  assignment_type: 'primary' | 'secondary' | 'temporary';
  ends_at: string | null;
}

export interface RoutingContext {
  tenant_id: string;
  metro_id?: string | null;
  archetype?: string | null;
  ticket_type?: string;
  module_key?: string;
}

export interface RoutingResult {
  gardener_ids: string[];
  reason: string;
}

export function routeToGardener(
  context: RoutingContext,
  gardeners: GardenerRecord[],
  scopes: GardenerScope[],
  assignments: TenantAssignment[]
): RoutingResult {
  const active = gardeners.filter(g => g.is_active);
  if (active.length === 0) {
    return { gardener_ids: [], reason: 'no_active_gardeners' };
  }

  const activeIds = new Set(active.map(g => g.id));

  // 1. Explicit primary assignment
  const explicitPrimary = assignments.find(
    a => a.tenant_id === context.tenant_id
      && a.assignment_type === 'primary'
      && activeIds.has(a.gardener_id)
      && (!a.ends_at || new Date(a.ends_at) > new Date())
  );
  if (explicitPrimary) {
    return { gardener_ids: [explicitPrimary.gardener_id], reason: 'explicit_primary_assignment' };
  }

  // 2. Metro match
  if (context.metro_id) {
    const metroMatch = scopes.find(
      s => s.scope_type === 'metro' && s.scope_key === context.metro_id && activeIds.has(s.gardener_id)
    );
    if (metroMatch) {
      return { gardener_ids: [metroMatch.gardener_id], reason: 'metro_scope_match' };
    }
  }

  // 3. Archetype match
  if (context.archetype) {
    const archMatch = scopes.find(
      s => s.scope_type === 'archetype' && s.scope_key === context.archetype && activeIds.has(s.gardener_id)
    );
    if (archMatch) {
      return { gardener_ids: [archMatch.gardener_id], reason: 'archetype_scope_match' };
    }
  }

  // 4. Specialty match (e.g. module_key maps to specialty)
  if (context.module_key) {
    const specMatch = scopes.find(
      s => s.scope_type === 'specialty' && s.scope_key === context.module_key && activeIds.has(s.gardener_id)
    );
    if (specMatch) {
      return { gardener_ids: [specMatch.gardener_id], reason: 'specialty_scope_match' };
    }
  }

  // 5. On-call
  const onCall = active.find(g => g.is_on_call);
  if (onCall) {
    return { gardener_ids: [onCall.id], reason: 'on_call_fallback' };
  }

  // 6. Primary fallback
  const primary = active.find(g => g.is_primary);
  if (primary) {
    return { gardener_ids: [primary.id], reason: 'primary_fallback' };
  }

  // Last resort: first active gardener
  return { gardener_ids: [active[0].id], reason: 'first_available_fallback' };
}
