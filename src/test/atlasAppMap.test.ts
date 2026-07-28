/**
 * atlasAppMap smoke test — guards the atlas↔federation-app mapping invariants.
 *
 * WHAT: Verifies every app has at least one archetype, that lookups are
 *       deterministically sorted, and (soft) that every Atlas archetype has at
 *       least one federation app linked to it.
 * WHY: The map is hand-maintained static content; these checks catch typos and
 *      accidental orphans before they ship to the public SEO surface.
 */
import { describe, it, expect } from 'vitest';
import { ATLAS_APP_LINKS, getAppsForAtlasEntry, getAtlasEntriesForApp } from '@/content/atlasAppMap';
import { MISSION_ATLAS, getCoveredArchetypes } from '@/content/missionAtlas';

describe('atlasAppMap', () => {
  it('every app has at least one archetype', () => {
    for (const app of ATLAS_APP_LINKS) {
      expect(app.archetypes.length, `${app.app_slug} has no archetypes`).toBeGreaterThan(0);
    }
  });

  it('every app slug is unique', () => {
    const slugs = ATLAS_APP_LINKS.map((a) => a.app_slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('getAppsForAtlasEntry returns results sorted by app_slug (deterministic)', () => {
    for (const entry of MISSION_ATLAS) {
      const apps = getAppsForAtlasEntry(entry.archetype, entry.metroType);
      const slugs = apps.map((a) => a.app_slug);
      const sorted = [...slugs].sort((a, b) => a.localeCompare(b));
      expect(slugs).toEqual(sorted);
    }
  });

  it('metro-scoped apps only appear for their declared metro types', () => {
    for (const app of ATLAS_APP_LINKS) {
      if (!app.metro_types) continue;
      const allMetros: Array<'urban' | 'suburban' | 'rural'> = ['urban', 'suburban', 'rural'];
      for (const metro of allMetros) {
        const matched = app.archetypes.some((arch) =>
          getAppsForAtlasEntry(arch, metro).some((a) => a.app_slug === app.app_slug),
        );
        if (matched) {
          expect(app.metro_types).toContain(metro);
        }
      }
    }
  });

  it('getAtlasEntriesForApp is the inverse of getAppsForAtlasEntry', () => {
    for (const app of ATLAS_APP_LINKS) {
      for (const entry of getAtlasEntriesForApp(app.app_slug)) {
        const appsForEntry = getAppsForAtlasEntry(entry.archetype, entry.metroType);
        expect(appsForEntry.map((a) => a.app_slug)).toContain(app.app_slug);
      }
    }
  });

  it('warns (soft) if any covered archetype has no federation app linked', () => {
    const linkedArchetypes = new Set(ATLAS_APP_LINKS.flatMap((a) => a.archetypes));
    const orphans = getCoveredArchetypes().filter((arch) => !linkedArchetypes.has(arch));
    if (orphans.length > 0) {
      // Soft warning, not a hard failure — some archetypes (e.g. library_system)
      // intentionally have no federation app yet.
      // eslint-disable-next-line no-console
      console.warn(`[atlasAppMap] archetypes with no federation app: ${orphans.join(', ')}`);
    }
    expect(Array.isArray(orphans)).toBe(true);
  });
});
