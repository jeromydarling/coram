/**
 * Retention registration for the public page (migration 0018).
 *
 * One row per workspace, holding four pieces of text a steward wrote about
 * their own group. No personal data: the contact line is deliberately free text
 * for a shared address the group controls rather than a reference to a member,
 * for the reason set out in the migration header.
 *
 * No expiry. A published page is a standing statement, and expiring one would
 * mean a group's page quietly going dark ninety days after they wrote it.
 */

import { registerTable } from '../retention';

registerTable({
  table: 'public_pages',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A workspace’s own public page: tagline, description, how to get involved, and a contact ' +
    'line the group wrote. Off by default and never derived — publishing that a political group ' +
    'exists is a disclosure only they can make. No personal data. Removed with the tenant.',
});
