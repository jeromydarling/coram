/**
 * Role Access Matrix — ministry role hierarchy and route blocking tests.
 *
 * WHAT: Validates requireRole(), nav visibility, and VISITOR_BLOCKED_ROUTES.
 * WHERE: src/lib/roleGuards.ts, src/lib/ministryRole.ts
 * WHY: Ensures role hierarchy is correctly enforced across the app.
 */
import { describe, it, expect } from 'vitest';
import {
  requireRole,
  requireAnyRole,
  isVisitorLens,
  hasTeamAccess,
  hasLeadershipAccess,
} from '@/lib/roleGuards';
import {
  VISITOR_BLOCKED_ROUTES,
  NAV_GROUP_VISIBILITY,
  canSeeNavGroup,
  canSeeNavItem,
  getMinistryRole,
  getEffectiveLens,
} from '@/lib/ministryRole';
import type { LensRole } from '@/lib/ministryRole';

describe('Role hierarchy — requireRole()', () => {
  it('steward meets all requirements', () => {
    expect(requireRole('steward', 'steward')).toBe(true);
    expect(requireRole('shepherd', 'steward')).toBe(true);
    expect(requireRole('companion', 'steward')).toBe(true);
    expect(requireRole('visitor', 'steward')).toBe(true);
  });

  it('shepherd meets shepherd and below', () => {
    expect(requireRole('steward', 'shepherd')).toBe(false);
    expect(requireRole('shepherd', 'shepherd')).toBe(true);
    expect(requireRole('companion', 'shepherd')).toBe(true);
    expect(requireRole('visitor', 'shepherd')).toBe(true);
  });

  it('companion meets companion and below', () => {
    expect(requireRole('steward', 'companion')).toBe(false);
    expect(requireRole('shepherd', 'companion')).toBe(false);
    expect(requireRole('companion', 'companion')).toBe(true);
    expect(requireRole('visitor', 'companion')).toBe(true);
  });

  it('visitor meets only visitor', () => {
    expect(requireRole('steward', 'visitor')).toBe(false);
    expect(requireRole('shepherd', 'visitor')).toBe(false);
    expect(requireRole('companion', 'visitor')).toBe(false);
    expect(requireRole('visitor', 'visitor')).toBe(true);
  });

  it('returns false for unknown roles', () => {
    expect(requireRole('unknown' as LensRole, 'steward')).toBe(false);
    expect(requireRole('steward', 'unknown' as LensRole)).toBe(false);
  });
});

describe('requireAnyRole()', () => {
  it('returns true if current role is in allowed list', () => {
    expect(requireAnyRole(['steward', 'shepherd'], 'shepherd')).toBe(true);
  });
  it('returns false if current role is not in allowed list', () => {
    expect(requireAnyRole(['steward', 'shepherd'], 'visitor')).toBe(false);
  });
});

describe('Role helper functions', () => {
  it('isVisitorLens detects visitor only', () => {
    expect(isVisitorLens('visitor')).toBe(true);
    expect(isVisitorLens('companion')).toBe(false);
  });
  it('hasTeamAccess requires companion+', () => {
    expect(hasTeamAccess('steward')).toBe(true);
    expect(hasTeamAccess('companion')).toBe(true);
    expect(hasTeamAccess('visitor')).toBe(false);
  });
  it('hasLeadershipAccess requires shepherd+', () => {
    expect(hasLeadershipAccess('steward')).toBe(true);
    expect(hasLeadershipAccess('shepherd')).toBe(true);
    expect(hasLeadershipAccess('companion')).toBe(false);
    expect(hasLeadershipAccess('visitor')).toBe(false);
  });
});

describe('VISITOR_BLOCKED_ROUTES', () => {
  const criticalRoutes = ['metros', 'pipeline', 'anchors', 'admin', 'reports', 'communio'];

  it('blocks all critical CRM routes from visitors', () => {
    for (const route of criticalRoutes) {
      expect(VISITOR_BLOCKED_ROUTES).toContain(route);
    }
  });

  it('does NOT block visits (visitor landing)', () => {
    expect(VISITOR_BLOCKED_ROUTES).not.toContain('visits');
  });
});

describe('Nav group visibility', () => {
  it('Admin is only visible to steward + shepherd', () => {
    expect(canSeeNavGroup('Admin', 'steward')).toBe(true);
    expect(canSeeNavGroup('Admin', 'shepherd')).toBe(true);
    expect(canSeeNavGroup('Admin', 'companion')).toBe(false);
    expect(canSeeNavGroup('Admin', 'visitor')).toBe(false);
  });

  it('Partners is visible to steward, shepherd, companion', () => {
    expect(canSeeNavGroup('Partners', 'steward')).toBe(true);
    expect(canSeeNavGroup('Partners', 'companion')).toBe(true);
    expect(canSeeNavGroup('Partners', 'visitor')).toBe(false);
  });

  it('unlisted groups are visible to all', () => {
    expect(canSeeNavGroup('NonExistentGroup', 'visitor')).toBe(true);
  });
});

describe('getMinistryRole()', () => {
  it('returns the stored role', () => {
    expect(getMinistryRole({ ministry_role: 'shepherd' })).toBe('shepherd');
    expect(getMinistryRole({ ministry_role: 'visitor' })).toBe('visitor');
  });
  it('defaults to companion for null/missing', () => {
    expect(getMinistryRole(null)).toBe('companion');
    expect(getMinistryRole({ ministry_role: null })).toBe('companion');
    expect(getMinistryRole({ ministry_role: 'garbage' })).toBe('companion');
  });
});

describe('getEffectiveLens()', () => {
  it('steward role always yields steward lens', () => {
    expect(getEffectiveLens(true, null, null)).toBe('steward');
    expect(getEffectiveLens(true, { lens: 'visitor' }, null)).toBe('steward');
  });
  it('uses lens row when present', () => {
    expect(getEffectiveLens(false, { lens: 'shepherd' }, null)).toBe('shepherd');
  });
  it('falls back to ministry role when no lens row', () => {
    expect(getEffectiveLens(false, null, { ministry_role: 'visitor' })).toBe('visitor');
  });
});
