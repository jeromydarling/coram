/**
 * audit — who read what record type, when. Never the values (§3.6).
 *
 * The signature is the enforcement. There is no parameter for a payload, a
 * record id, or a field name, so a handler cannot log one without editing this
 * file — and editing this file is the kind of change a reviewer notices.
 *
 * What a steward gets from this: "an organizer read 400 contact records on
 * Tuesday." What a subpoena gets from this: the same thing. That symmetry is
 * the point.
 */

import type { Session } from './auth';
import { withTenant, type Sql, type Tx } from './rls';

/**
 * Dotted verbs. Kept as a closed union so the log stays greppable and an
 * accidental free-text action cannot appear in one handler only.
 */
export type AuditAction =
  | 'session.start'
  | 'session.end'
  | 'member.invite'
  | 'member.role_change'
  | 'member.remove'
  | 'record.read'
  | 'record.export'
  | 'workspace.update'
  | 'workspace.burn';

export interface AuditEntry {
  action: AuditAction;
  /** Logical record type — 'contact', 'event', 'membership'. Never an id. */
  recordType: string;
  /** How many rows the action touched. A count is not a value. */
  recordCount?: number;
}

/**
 * Write an audit row inside the caller's transaction.
 *
 * Deliberately part of the same transaction as the work it describes: if the
 * read is rolled back, so is the claim that it happened. The RLS insert policy
 * pins tenant and actor to the request context, so neither can be spoofed by a
 * caller passing the wrong thing.
 */
export async function record(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx`
    INSERT INTO public.audit_log (tenant_id, actor_id, actor_role, action, record_type, record_count)
    VALUES (
      coram.current_tenant_id(),
      coram.current_user_id(),
      coram.current_role(),
      ${entry.action},
      ${entry.recordType},
      ${entry.recordCount ?? 1}
    )
  `;
}

/**
 * Audit an action that must be recorded even though the rows it describes are
 * about to stop existing — the burn switch, mainly.
 *
 * Ordinary `record` shares the caller's transaction, so a failed burn would
 * roll back the note that it was attempted. That is right for reads and wrong
 * here. This commits first, in a transaction of its own, and then the caller
 * does the destructive work.
 *
 * It still goes through withTenant: the audit_log insert policy pins tenant and
 * actor to the request context, so an unscoped insert would be denied outright.
 */
export async function recordBefore(sql: Sql, session: Session, entry: AuditEntry): Promise<void> {
  try {
    await withTenant(sql, session, (tx) => record(tx, entry));
  } catch {
    // Never block the user-facing action on the audit write. A steward unable
    // to burn their workspace because a log insert timed out is worse than a
    // gap in the log.
  }
}
