/**
 * Retention registration for the watch list (migration 0017).
 *
 * Topics and sources are the workspace's own configuration — the words a group
 * worked out and the feeds they chose — and they hold nothing about anybody.
 * They have no expiry and they leave with the tenant.
 *
 * Items are public documents and they expire at ninety days, which is the
 * shortest retention of anything that is not a Custos case. The reasoning is in
 * the migration header and is worth repeating here because this is the file a
 * reviewer reads: the thing a group keeps is the event or the bill an item
 * became, not the item. A feed retained forever is a dated record of what a
 * group was interested in, which is exactly the kind of row §3.4 exists to
 * prevent us accumulating by inattention.
 */

import { registerTable } from '../retention';

registerTable({
  table: 'watch_topics',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'The words a group watches for — "eviction", "rent board", a bill number. Their own ' +
    'configuration and their own political position, with no personal data in it. Kept for as ' +
    'long as the workspace exists; removed with the tenant by cascade.',
});

registerTable({
  table: 'watch_sources',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Where to look: a state bill feed or the URL of a council agenda. Public endpoints chosen by ' +
    'the group, plus whether the last poll worked. No personal data. Removed with the tenant.',
});

/*
 * Ninety days.
 *
 * `public_record` rather than `none` because these rows are documents produced
 * by a government, and the distinction matters for what the audit log may
 * record about them: a hearing notice is not a workspace setting, and a
 * reviewer asking "what is in this table" should be told it is public record
 * rather than configuration.
 *
 * `dismissed_by` is the only membership reference and it exists so two
 * organizers do not both chase the same hearing. It goes with the row.
 */
registerTable({
  table: 'watch_items',
  retentionDays: 90,
  pii: 'public_record',
  timestampColumn: 'first_seen_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'Bills, hearings and agendas that matched a group’s topics: a title, a link, a date, and a ' +
    'two-sentence summary of a public document. Ninety days, because a feed is not an archive — ' +
    'what a group keeps is the event or the bill an item became, and those have no expiry. ' +
    'Holding the feed longer would build a dated record of what a group was watching, at no ' +
    'benefit to them.',
});
