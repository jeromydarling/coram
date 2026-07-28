/**
 * generate-atlas-back-links-snapshot — Bakes the atlas↔app map into a JSON snapshot.
 *
 * WHAT: Reads src/content/atlasAppMap.ts + src/content/missionAtlas.ts and emits
 *       supabase/functions/_shared/atlas-back-links-data.json — a per-app index of
 *       the Mission Atlas entries each federation app participates in.
 * WHY:  Supabase edge functions cannot import from src/, so the atlas-back-links
 *       function reads this committed snapshot instead. Re-run after editing the map.
 *
 * Run: npm run atlas:snapshot   (alias: tsx scripts/generate-atlas-back-links-snapshot.ts)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ATLAS_APP_LINKS, getAtlasEntriesForApp } from '../src/content/atlasAppMap';
import { getArchetypeDisplay, getMetroTypeDisplay } from '../src/content/missionAtlas';

const SITE_BASE = 'https://thecros.app';

interface BackLinkEntry {
  id: string;
  archetype: string;
  metro_type: string;
  title: string;
  url: string;
}

type Snapshot = Record<string, BackLinkEntry[]>;

function buildSnapshot(): Snapshot {
  const snapshot: Snapshot = {};
  for (const app of ATLAS_APP_LINKS) {
    snapshot[app.app_slug] = getAtlasEntriesForApp(app.app_slug).map((entry) => ({
      id: entry.id,
      archetype: entry.archetype,
      metro_type: entry.metroType,
      title: `${getArchetypeDisplay(entry.archetype)} · ${getMetroTypeDisplay(entry.metroType)}`,
      url: `${SITE_BASE}/mission-atlas/${entry.id}`,
    }));
  }
  return snapshot;
}

function main(): void {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(
    __dirname,
    '../supabase/functions/_shared/atlas-back-links-data.json',
  );
  const snapshot = buildSnapshot();
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  const apps = Object.keys(snapshot).length;
  const links = Object.values(snapshot).reduce((n, arr) => n + arr.length, 0);
  // eslint-disable-next-line no-console
  console.log(`atlas-back-links snapshot written: ${apps} apps, ${links} total links → ${outPath}`);
}

main();
