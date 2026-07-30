/**
 * Is the whole product actually reachable?
 *
 * This file exists because of a specific complaint, and the complaint was
 * right: the app shipped with six read-only screens against a spec that names
 * eleven modules, and nothing anywhere would have caught that. A schema, an
 * API, row-level security and a passing test suite are not a product if there
 * is no way to open the thing.
 *
 * So these assertions are deliberately about coverage rather than behaviour.
 * They read App.tsx as text — crude, and the point: a route that exists only in
 * a developer's intention does not match a regex.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GROUPS, MODULES, TONE_BG, TONE_TEXT, TONE_WASH, moduleAt } from '@/lib/modules';

const APP = readFileSync(join(process.cwd(), 'src/app/App.tsx'), 'utf8');

describe('§5 is a closed list of eleven', () => {
  it('has eleven modules, no more and no fewer', () => {
    expect(MODULES).toHaveLength(11);
  });

  it('numbers them 5.1 through 5.11', () => {
    expect(MODULES.map((m) => m.section)).toEqual([
      '5.1',
      '5.2',
      '5.3',
      '5.4',
      '5.5',
      '5.6',
      '5.7',
      '5.8',
      '5.9',
      '5.10',
      '5.11',
    ]);
  });

  it('gives each one a distinct route', () => {
    expect(new Set(MODULES.map((m) => m.path)).size).toBe(11);
  });

  it('puts every module in a group the sidebar renders', () => {
    for (const m of MODULES) expect(GROUPS).toContain(m.group);
  });
});

describe('every module has somewhere to go', () => {
  /*
   * The failure this catches: adding a module to the registry, seeing it appear
   * in the sidebar, and shipping — because a NavLink to a path with no Route
   * renders happily and then redirects to the overview when clicked.
   */
  it.each(MODULES.map((m) => [m.name, m.path] as const))(
    '%s is mounted at %s in App.tsx',
    (_name, path) => {
      expect(APP).toContain(`path="${path}"`);
    },
  );

  it('mounts the workspace settings the sidebar links to', () => {
    expect(APP).toContain('path="/settings"');
  });
});

describe('tones', () => {
  /*
   * Tailwind cannot see a class name assembled at runtime, so `bg-${tone}`
   * silently produces no CSS. The three maps are the documented escape hatch
   * and every tone in use has to appear in all of them.
   */
  it('has a written-out class for every tone in use', () => {
    for (const m of MODULES) {
      expect(TONE_TEXT[m.tone]).toBe(`text-${m.tone}`);
      expect(TONE_BG[m.tone]).toBe(`bg-${m.tone}`);
      expect(TONE_WASH[m.tone]).toBe(`bg-${m.tone}/10`);
    }
  });

  /*
   * Six colours across eleven modules means repeats. Repeats are fine; two
   * neighbours in the sidebar sharing one reads as an accident.
   */
  it('never puts the same tone on two adjacent sidebar entries', () => {
    for (const group of GROUPS) {
      const tones = MODULES.filter((m) => m.group === group).map((m) => m.tone);
      for (let i = 1; i < tones.length; i += 1) {
        expect(tones[i]).not.toBe(tones[i - 1]);
      }
    }
  });
});

describe('moduleAt', () => {
  it('finds the module for an exact path', () => {
    expect(moduleAt('/people')?.latin).toBe('Membra');
  });

  it('finds it for a child route, so /people/import stays People', () => {
    expect(moduleAt('/people/import')?.latin).toBe('Membra');
  });

  it('returns nothing for the overview, which belongs to no single module', () => {
    expect(moduleAt('/')).toBeUndefined();
  });

  /*
   * A prefix match on `/` would make every route the first module and tint the
   * whole app vermillion. `/messages` must not match `/me`-anything either.
   */
  it('does not match a path that merely starts with a module path', () => {
    expect(moduleAt('/peopleish')).toBeUndefined();
  });
});
