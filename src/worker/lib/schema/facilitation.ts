/**
 * Retention registration for agendas (migration 0019).
 *
 * Two years rather than forever, which is shorter than the minutes an agenda
 * becomes and that is the point: the minutes are the record the group adopted
 * and meant to keep, and the agenda is the working document that produced them.
 * Keeping both indefinitely would double the amount of "what this group
 * discussed and when" sitting in the database for no additional benefit to
 * anybody in it.
 *
 * The item notes are about items, never about people — see the migration
 * header on why the speaking stack is not in this table and never will be.
 */

import { registerTable } from '../retention';

registerTable({
  table: 'agendas',
  retentionDays: 730,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A meeting agenda: what was to be discussed, how long each item was given, and what happened ' +
    'on it. No attendance, no speaking record, nothing about any person — the facilitator’s ' +
    'stack is never sent to a server at all. Two years, because the minutes the group adopts are ' +
    'the record worth keeping and this is the working document behind them.',
});
