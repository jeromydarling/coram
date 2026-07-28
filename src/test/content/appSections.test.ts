/**
 * App sections content integrity tests.
 *
 * WHAT: Tests APP_SECTIONS registry for completeness and consistency.
 * WHERE: src/lib/appSections.ts
 * WHY: Prevents broken help pages and missing section metadata.
 */
import { describe, it, expect } from 'vitest';
import { APP_SECTIONS, getSection, getSectionsForGroup } from '@/lib/appSections';
import type { LensRole } from '@/lib/ministryRole';

const VALID_ROLES: LensRole[] = ['steward', 'shepherd', 'companion', 'visitor'];

describe('APP_SECTIONS registry', () => {
  it('has a non-trivial number of sections', () => {
    expect(APP_SECTIONS.length).toBeGreaterThan(20);
  });

  it('every section has id, title, and description', () => {
    for (const section of APP_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.description).toBeTruthy();
      expect(section.description.length).toBeGreaterThan(10);
    }
  });

  it('no duplicate section ids', () => {
    const ids = APP_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('visibleTo only contains valid roles', () => {
    for (const section of APP_SECTIONS) {
      if (section.visibleTo) {
        for (const role of section.visibleTo) {
          expect(VALID_ROLES).toContain(role);
        }
      }
    }
  });

  it('every section has a navGroup', () => {
    for (const section of APP_SECTIONS) {
      expect(section.navGroup).toBeTruthy();
    }
  });
});

describe('getSection()', () => {
  it('finds existing section', () => {
    const section = getSection('command-center');
    expect(section).toBeDefined();
    expect(section?.title).toBe('Command Center');
  });

  it('returns undefined for unknown id', () => {
    expect(getSection('nonexistent')).toBeUndefined();
  });
});

describe('getSectionsForGroup()', () => {
  it('returns matching sections', () => {
    const partners = getSectionsForGroup('Partners');
    expect(partners.length).toBeGreaterThan(0);
    for (const section of partners) {
      expect(section.navGroup).toBe('Partners');
    }
  });

  it('returns empty array for unknown group', () => {
    expect(getSectionsForGroup('Nonexistent')).toEqual([]);
  });
});
