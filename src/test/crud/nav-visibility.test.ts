/**
 * Navigation visibility by lens role.
 *
 * WHAT: Tests that each lens sees exactly the right nav groups.
 * WHERE: src/lib/ministryRole.ts NAV_GROUP_VISIBILITY.
 * WHY: Prevents navigation sprawl across roles.
 */
import { describe, it, expect } from 'vitest';
import {
  NAV_GROUP_VISIBILITY,
  NAV_ITEM_VISIBILITY,
  STANDALONE_VISIBILITY,
  canSeeNavGroup,
  canSeeNavItem,
  canSeeStandaloneItem,
} from '@/lib/ministryRole';
import type { LensRole } from '@/lib/ministryRole';

const ALL_ROLES: LensRole[] = ['steward', 'shepherd', 'companion', 'visitor'];

describe('NAV_GROUP_VISIBILITY completeness', () => {
  it('every visibility entry uses only valid lens roles', () => {
    for (const [group, roles] of Object.entries(NAV_GROUP_VISIBILITY)) {
      for (const role of roles) {
        expect(ALL_ROLES).toContain(role);
      }
    }
  });

  it('steward can see all restricted groups', () => {
    for (const group of Object.keys(NAV_GROUP_VISIBILITY)) {
      expect(canSeeNavGroup(group, 'steward')).toBe(true);
    }
  });

  it('visitor cannot see Admin, Metros, Communio, or Scientia groups', () => {
    const hiddenFromVisitor = ['Admin', 'Metros', 'Communio', 'Scientia'];
    for (const group of hiddenFromVisitor) {
      expect(canSeeNavGroup(group, 'visitor')).toBe(false);
    }
  });

  it('flattened items (Campaigns, Relatio) are restricted via NAV_ITEM_VISIBILITY', () => {
    expect(canSeeNavItem('/outreach/campaigns', 'visitor')).toBe(false);
    expect(canSeeNavItem('/outreach/campaigns', 'companion')).toBe(false);
    expect(canSeeNavItem('/outreach/campaigns', 'steward')).toBe(true);
    expect(canSeeNavItem('/relatio', 'visitor')).toBe(false);
    expect(canSeeNavItem('/relatio', 'steward')).toBe(true);
  });

  it('companion can see Partners, People, and Scheduling', () => {
    expect(canSeeNavGroup('Partners', 'companion')).toBe(true);
    expect(canSeeNavGroup('People', 'companion')).toBe(true);
    expect(canSeeNavGroup('Scheduling', 'companion')).toBe(true);
  });

  it('Scientia is hidden from companion and visitor', () => {
    expect(canSeeNavGroup('Scientia', 'companion')).toBe(false);
    expect(canSeeNavGroup('Scientia', 'visitor')).toBe(false);
  });

  it('Scientia is visible to steward and shepherd', () => {
    expect(canSeeNavGroup('Scientia', 'steward')).toBe(true);
    expect(canSeeNavGroup('Scientia', 'shepherd')).toBe(true);
  });
});

describe('NAV_ITEM_VISIBILITY', () => {
  it('unlisted items are visible to everyone', () => {
    expect(canSeeNavItem('/some-new-page', 'visitor')).toBe(true);
  });
});

describe('STANDALONE_VISIBILITY', () => {
  it('Command Center (/) is hidden from visitors', () => {
    expect(canSeeStandaloneItem('/', 'visitor')).toBe(false);
  });

  it('Command Center (/) is visible to companion+', () => {
    expect(canSeeStandaloneItem('/', 'companion')).toBe(true);
    expect(canSeeStandaloneItem('/', 'steward')).toBe(true);
  });
});
