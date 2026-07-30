/**
 * The public demo workspace's credentials.
 *
 * Shared between the marketing page that publishes them and the seed script
 * that creates the account, so the two cannot drift — a demo page advertising a
 * password that no longer works is worse than no demo page.
 *
 * These are deliberately in the repository rather than in a secret. They are
 * printed on a public web page; treating them as a secret would be theatre.
 * What makes that safe is the role, not the password: the account is an
 * `observer` (§4.1), which is read-only and sees no individual contact records,
 * and every person in the workspace is invented.
 */
export const DEMO_EMAIL = 'demo@coram.app';
export const DEMO_PASSWORD = 'see-the-whole-thing';
export const DEMO_SLUG = 'demo-eastside';
export const DEMO_TENANT_NAME = 'Eastside Tenants Union';
