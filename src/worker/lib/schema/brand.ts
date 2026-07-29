/**
 * Retention registration for brand tokens (migration 0011).
 *
 * Workspace configuration rather than a module. It holds no personal data —
 * colours, a name the group chose for itself, and an R2 key for a logo of
 * their own — so it is kept for as long as the workspace exists and removed
 * with it by the tenant cascade.
 */

import { registerTable } from '../retention';

registerTable({
  table: 'brand_profiles',
  retentionDays: null,
  pii: 'none',
  timestampColumn: 'created_at',
  tenantColumn: 'tenant_id',
  purge: 'delete',
  reason:
    'A workspace’s own colours, wordmark and logo. No personal data, and no reason to expire ' +
    'while the workspace exists — the flyer composer and every public event page read it. ' +
    'Removed with the tenant by cascade; the logo object is cleared by the burn path.',
});
