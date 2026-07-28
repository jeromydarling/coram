/**
 * NAV_ITEM_TO_GROUP — maps sidebar nav testids to their collapsible parent group.
 * Must stay in sync with the app's sidebar structure.
 *
 * Group trigger testid pattern: [data-testid="nav-group-{group}-trigger"]
 * Group content testid pattern: [data-testid="nav-group-{group}-content"]
 *
 * Current sidebar groups (Sidebar.tsx):
 *   Metros → nav-group-metros
 *   Partners → nav-group-partners
 *   People → nav-group-people
 *   Scheduling → nav-group-scheduling
 *   Grants → nav-group-grants
 *   Scientia → nav-group-scientia
 *   Communio → nav-group-communio
 *   Admin → nav-group-admin
 *
 * Flattened standalone items (no group):
 *   Campaigns (formerly Outreach)
 *   Relatio (formerly Relatio group)
 */
export const NAV_ITEM_TO_GROUP: Record<string, string> = {
  // Metros group
  'nav-metros': 'nav-group-metros',
  'nav-intel-feed': 'nav-group-metros',
  'nav-narratives': 'nav-group-metros',
  'nav-momentum': 'nav-group-metros',

  // Partners group
  'nav-opportunities': 'nav-group-partners',
  'nav-radar': 'nav-group-partners',
  'nav-pipeline': 'nav-group-partners',
  'nav-anchors': 'nav-group-partners',
  'nav-provisions': 'nav-group-partners',

  // People group
  'nav-people': 'nav-group-people',
  'nav-find-people': 'nav-group-people',
  'nav-graph': 'nav-group-people',
  'nav-volunteers': 'nav-group-people',

  // Scheduling group
  'nav-calendar': 'nav-group-scheduling',
  'nav-events': 'nav-group-scheduling',
  'nav-find-events': 'nav-group-scheduling',
  'nav-activities': 'nav-group-scheduling',
  'nav-projects': 'nav-group-scheduling',

  // Outreach (flattened — standalone, no parent group)
  'nav-campaigns': '',

  // Grants group
  'nav-grants': 'nav-group-grants',
  'nav-find-grants': 'nav-group-grants',

  // Scientia group
  'nav-testimonium': 'nav-group-scientia',
  'nav-analytics': 'nav-group-scientia',
  'nav-intelligence': 'nav-group-scientia',  // alias
  'nav-reports': 'nav-group-scientia',

  // Relatio (flattened — standalone, no parent group)
  'nav-relatio': '',

  // Communio group
  'nav-communio': 'nav-group-communio',
  'nav-caregiver-network': 'nav-group-communio',

  // Admin group
  'nav-admin': 'nav-group-admin',
  'nav-admin-activation': 'nav-group-admin',
  'nav-admin-guide': 'nav-group-admin',
  'nav-import': 'nav-group-admin',

  // Top-level items (no parent group)
  'nav-home': '',
  'nav-settings': '',
  'nav-help': '',
};
