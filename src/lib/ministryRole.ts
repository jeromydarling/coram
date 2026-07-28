/**
 * ministryRole — Helpers for tenant-level ministry experience roles (lenses).
 *
 * WHAT: Defines the five planes (Operator/Steward/Shepherd/Companion/Visitor) and navigation visibility rules.
 * WHERE: Used by Sidebar, ProtectedRoute, and onboarding flows.
 * WHY: These are human-centered experience lenses, not permission layers. They control what the user sees, not what data they can access.
 */

export type MinistryRole = 'shepherd' | 'companion' | 'visitor';
export type LensRole = 'steward' | 'shepherd' | 'companion' | 'visitor';

export const LENS_LABELS: Record<LensRole, string> = {
  steward: 'Steward',
  shepherd: 'Shepherd',
  companion: 'Companion',
  visitor: 'Visitor',
};

export const LENS_SUBTITLES: Record<LensRole, string> = {
  steward: 'Workspace Caretaker',
  shepherd: 'Relationship Builder',
  companion: 'Support Role',
  visitor: 'Minimal Access',
};

export const MINISTRY_ROLE_LABELS: Record<MinistryRole, string> = {
  shepherd: 'Shepherd',
  companion: 'Companion',
  visitor: 'Visitor',
};

export const MINISTRY_ROLE_DESCRIPTIONS: Record<MinistryRole, string> = {
  shepherd: 'Vision, planning, oversight',
  companion: 'Daily relationship building',
  visitor: 'Field volunteer experience',
};

/** Onboarding prompts — human language, no enterprise jargon */
export const MINISTRY_ROLE_PROMPTS: Record<MinistryRole, string> = {
  shepherd: 'I guide the mission',
  companion: 'I build relationships',
  visitor: 'I visit and serve people',
};

export function getMinistryRole(profile: { ministry_role?: string | null } | null): MinistryRole {
  const role = profile?.ministry_role;
  if (role === 'shepherd' || role === 'companion' || role === 'visitor') return role;
  return 'companion'; // safe default
}

export function isShepherd(profile: { ministry_role?: string | null } | null): boolean {
  return getMinistryRole(profile) === 'shepherd';
}

export function isCompanion(profile: { ministry_role?: string | null } | null): boolean {
  return getMinistryRole(profile) === 'companion';
}

export function isVisitor(profile: { ministry_role?: string | null } | null): boolean {
  return getMinistryRole(profile) === 'visitor';
}

/**
 * Resolve effective lens from tenant_user_lenses row or fallback to ministry role.
 * Steward role users always get 'steward' lens.
 */
export function getEffectiveLens(
  isSteward: boolean,
  lensRow?: { lens: string } | null,
  profile?: { ministry_role?: string | null } | null,
): LensRole {
  if (isSteward) return 'steward';
  if (lensRow?.lens === 'steward' || lensRow?.lens === 'shepherd' || lensRow?.lens === 'companion' || lensRow?.lens === 'visitor') {
    return lensRow.lens;
  }
  // Fallback to profile ministry_role
  return getMinistryRole(profile) as LensRole;
}

/**
 * Navigation group visibility by lens.
 * Keys are sidebar group labels. Values are the lenses that CAN see them.
 * If a group is not listed, all lenses can see it.
 */
export const NAV_GROUP_VISIBILITY: Record<string, LensRole[]> = {
  'Metros': ['steward', 'shepherd'],
  'Partners': ['steward', 'shepherd', 'companion'],
  'People': ['steward', 'shepherd', 'companion'],
  'Scheduling': ['steward', 'shepherd', 'companion'],
  'Grants': ['steward', 'shepherd', 'companion'],
  'Scientia': ['steward', 'shepherd'],
  'Community': ['steward', 'shepherd', 'companion'],
  'Communio': ['steward', 'shepherd'],
  'Admin': ['steward', 'shepherd'],
};

/**
 * "Other" nav items visibility by href suffix.
 * If not listed, visible to all.
 */
export const NAV_ITEM_VISIBILITY: Record<string, LensRole[]> = {
  '/outreach/campaigns': ['steward', 'shepherd'],
  '/relatio': ['steward', 'shepherd'],
};

/** Standalone items visibility */
export const STANDALONE_VISIBILITY: Record<string, LensRole[]> = {
  '/': ['steward', 'shepherd', 'companion'], // Command Center hidden from visitors
};

/** Routes that visitors should be redirected away from */
export const VISITOR_BLOCKED_ROUTES = [
  'metros', 'pipeline', 'anchors', 'opportunities', 'radar',
  'intel-feed', 'momentum', 'momentum-rankings', 'reports',
  'analytics', 'testimonium', 'communio', 'admin', 'import',
  'outreach', 'grants', 'graph', 'story', 'playbooks',
  'workflow-downloads', 'technical-docs',
];

/** Routes that companions should be redirected away from (SEC-006b) */
export const COMPANION_BLOCKED_ROUTES = [
  'metros', 'communio', 'momentum', 'momentum-rankings',
  'intel-feed', 'graph', 'story', 'narrative-threads',
  'outreach', 'workflow-downloads', 'technical-docs',
];

/** Default landing page per lens */
export const DEFAULT_LANDING: Record<LensRole, string> = {
  steward: '/',           // Command Center (workspace setup accessible from nav)
  shepherd: '/',          // Command Center
  companion: '/',         // Command Center / Dashboard
  visitor: '/visits',     // Simplified visits page
};

export function canSeeNavGroup(groupLabel: string, lens: LensRole): boolean {
  const allowed = NAV_GROUP_VISIBILITY[groupLabel];
  if (!allowed) return true; // not restricted
  return allowed.includes(lens);
}

export function canSeeNavItem(hrefSuffix: string, lens: LensRole): boolean {
  const allowed = NAV_ITEM_VISIBILITY[hrefSuffix];
  if (!allowed) return true;
  return allowed.includes(lens);
}

export function canSeeStandaloneItem(hrefSuffix: string, lens: LensRole): boolean {
  const allowed = STANDALONE_VISIBILITY[hrefSuffix];
  if (!allowed) return true;
  return allowed.includes(lens);
}
