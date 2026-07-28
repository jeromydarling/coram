/**
 * navMap — Sidebar navigation group mapping for QA prompt generation.
 *
 * WHAT: Maps child nav testIds to their parent collapsible group testIds.
 * WHERE: Used by QA prompt builder to suggest correct nav expansion steps.
 * WHY: Radix Collapsible unmounts children when closed; tests must expand groups first.
 */

/** Map of child data-testid → parent group data-testid */
export const NAV_ITEM_TO_GROUP: Record<string, string> = {
  // Metros
  'nav-metros': 'nav-group-metros',
  'nav-intel-feed': 'nav-group-metros',
  'nav-narratives': 'nav-group-metros',
  'nav-momentum': 'nav-group-metros',
  // Partners
  'nav-opportunities': 'nav-group-partners',
  'nav-radar': 'nav-group-partners',
  'nav-pipeline': 'nav-group-partners',
  'nav-anchors': 'nav-group-partners',
  'nav-provisions': 'nav-group-partners',
  // People
  'nav-people': 'nav-group-people',
  'nav-find-people': 'nav-group-people',
  'nav-graph': 'nav-group-people',
  'nav-volunteers': 'nav-group-people',
  // Scheduling
  'nav-calendar': 'nav-group-scheduling',
  'nav-events': 'nav-group-scheduling',
  'nav-find-events': 'nav-group-scheduling',
  'nav-activities': 'nav-group-scheduling',
  // Outreach
  // Outreach (flattened — no parent group)
  'nav-campaigns': '',
  // Grants
  'nav-grants': 'nav-group-grants',
  'nav-find-grants': 'nav-group-grants',
  // Scientia
  'nav-testimonium': 'nav-group-scientia',
  'nav-analytics': 'nav-group-scientia',
  'nav-reports': 'nav-group-scientia',
  // Relatio (flattened — no parent group)
  'nav-relatio': '',
  // Communio
  'nav-communio': 'nav-group-communio',
  // Admin
  'nav-import': 'nav-group-admin',
  'nav-admin': 'nav-group-admin',
  'nav-admin-activation': 'nav-group-admin',
  'nav-admin-guide': 'nav-group-admin',
};

/** Group testId → human-readable group label */
export const GROUP_LABELS: Record<string, string> = {
  'nav-group-metros': 'Metros',
  'nav-group-partners': 'Partners',
  'nav-group-people': 'People',
  'nav-group-scheduling': 'Scheduling',
  'nav-group-grants': 'Grants',
  'nav-group-scientia': 'Scientia',
  'nav-group-communio': 'Communio',
  'nav-group-admin': 'Admin',
};
