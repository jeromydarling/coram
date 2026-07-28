/**
 * roleGuards — Frontend role-based access helpers.
 *
 * WHAT: Functions to check if current user's lens/role meets minimum requirements.
 * WHERE: Used in components that need role-based visibility beyond nav filtering.
 * WHY: Prevents Visitor mode from accidentally exposing admin/steward-only features.
 */

import type { LensRole } from './ministryRole';

/** Role hierarchy from most access to least */
const ROLE_HIERARCHY: LensRole[] = ['steward', 'shepherd', 'companion', 'visitor'];

/**
 * Check if the user's effective lens meets or exceeds the required minimum role.
 *
 * requireRole('shepherd', 'companion') → false (companion < shepherd)
 * requireRole('companion', 'steward') → true (steward > companion)
 */
export function requireRole(
  minimumRole: LensRole,
  currentRole: LensRole,
): boolean {
  const minIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  const curIndex = ROLE_HIERARCHY.indexOf(currentRole);
  if (minIndex === -1 || curIndex === -1) return false;
  return curIndex <= minIndex; // Lower index = higher access
}

/**
 * Check if any of the allowed roles match the current role.
 */
export function requireAnyRole(
  allowedRoles: LensRole[],
  currentRole: LensRole,
): boolean {
  return allowedRoles.includes(currentRole);
}

/**
 * Returns true if the current role is Visitor (lowest access).
 */
export function isVisitorLens(currentRole: LensRole): boolean {
  return currentRole === 'visitor';
}

/**
 * Returns true if the current role has at least Companion-level access.
 */
export function hasTeamAccess(currentRole: LensRole): boolean {
  return requireRole('companion', currentRole);
}

/**
 * Returns true if the current role has at least Shepherd-level access.
 */
export function hasLeadershipAccess(currentRole: LensRole): boolean {
  return requireRole('shepherd', currentRole);
}
