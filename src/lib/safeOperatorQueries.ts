/**
 * safeOperatorQueries — Centralized safe query helpers for operator surfaces.
 *
 * WHAT: Pre-built query builders that enforce metadata-only access.
 * WHERE: All /operator routes that touch tenant-adjacent data.
 * WHY: Prevents accidental PII leakage even if future code changes bypass UI redaction.
 *
 * RULE: Operator pages MUST use these helpers. Direct .from('recycle_bin') or
 * .from('recycle_bin_payloads') is BANNED in operator code paths.
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Safe metadata-only columns for operator recycle bin queries.
 * NEVER add entity_name or snapshot here.
 */
const OPERATOR_RECYCLE_BIN_COLUMNS = 'id, entity_type, entity_id, tenant_id, deleted_by, deleted_at, restored_at, restored_by, purged_at, created_at' as const;

/**
 * Fetch recycle bin entries for operator view — metadata only.
 * entity_name and snapshot are architecturally excluded.
 */
export async function fetchOperatorRecycleBin(options?: { limit?: number }) {
  const limit = options?.limit ?? 200;

  const { data, error } = await supabase
    .from('recycle_bin')
    .select(OPERATOR_RECYCLE_BIN_COLUMNS)
    .is('purged_at', null)
    .order('deleted_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Defense-in-depth: strip any sensitive fields even if they somehow appear
  return (data ?? []).map((row: any) => ({
    id: row.id,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    tenant_id: row.tenant_id,
    deleted_by: row.deleted_by,
    deleted_at: row.deleted_at,
    restored_at: row.restored_at,
    restored_by: row.restored_by,
    purged_at: row.purged_at,
    created_at: row.created_at,
    entity_name: null,  // Always null for operator
    snapshot: {},        // Always empty for operator
  }));
}

/**
 * Safe recovery ticket columns for operator view.
 * Excludes raw context_json which may contain PII from breadcrumbs.
 */
const OPERATOR_TICKET_COLUMNS = 'id, user_id, tenant_id, type, status, subject, suspected_entity_type, suspected_entity_id, created_at, updated_at' as const;

export async function fetchOperatorRecoveryTickets(options?: { limit?: number }) {
  const limit = options?.limit ?? 50;

  const { data, error } = await supabase
    .from('recovery_tickets')
    .select(OPERATOR_TICKET_COLUMNS)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
