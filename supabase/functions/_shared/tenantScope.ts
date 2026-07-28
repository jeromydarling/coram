/**
 * tenantScope — Shared tenant boundary enforcement for edge functions.
 *
 * WHAT: Helper to ensure all queries are properly scoped to a tenant.
 * WHERE: Used by edge functions that process tenant-specific data.
 * WHY: Prevents cross-tenant data leaks by enforcing tenant_id filtering at the query level.
 */

/**
 * Wraps a Supabase query builder to enforce tenant_id filtering.
 * Usage:
 *   const query = enforceTenantScope(supabase.from('activities'), tenantId);
 *   const { data } = await query.select('*');
 */
export function enforceTenantScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  tenantId: string,
  column = 'tenant_id',
): T {
  if (!tenantId) {
    throw new Error(`[tenantScope] tenant_id is required but was empty`);
  }
  return query.eq(column, tenantId);
}

/**
 * Validates that a tenant_id is a valid UUID format.
 */
export function isValidTenantId(tenantId: unknown): tenantId is string {
  if (typeof tenantId !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
}

/**
 * Guard that throws if tenant_id is missing or invalid.
 */
export function requireTenantId(tenantId: unknown): asserts tenantId is string {
  if (!isValidTenantId(tenantId)) {
    throw new Error(`[tenantScope] Invalid or missing tenant_id: ${String(tenantId)}`);
  }
}
