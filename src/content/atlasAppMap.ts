/**
 * atlasAppMap — Bidirectional mapping between Mission Atlas patterns and Federation apps.
 *
 * WHAT: Static registry linking each CROS Federation satellite app to the Mission Atlas
 *       archetypes (and optionally metro types) it serves, plus helpers to resolve
 *       apps↔atlas-entries in both directions.
 * WHERE: Read by the Mission Atlas detail page (apps strip), the Atlas index page
 *        (federation-app-count pill), and the atlas-back-links snapshot generator.
 * WHY: Creates discovery between the public Atlas SEO surface and the federation of
 *      satellite apps — without any database schema changes or live data.
 *
 * Maintenance: archetype keys must match those used in missionAtlas.ts
 * (church, catholic_outreach, digital_inclusion, social_enterprise, workforce,
 *  refugee_support, education_access, library_system, community_network,
 *  ministry_outreach, caregiver_solo, caregiver_agency). Primary domains and
 *  display names are sourced from the CROS Federation registry.
 */
import type { AtlasEntry } from './missionAtlas';
import { MISSION_ATLAS } from './missionAtlas';

export interface AtlasAppLink {
  app_slug: string;
  display_name: string;
  primary_domain: string;       // e.g. "propria.land"
  tagline: string;              // ≤ 90 chars, dignified CROS voice
  archetypes: string[];
  metro_types?: ('urban' | 'suburban' | 'rural')[]; // omit = serves all
}

export const ATLAS_APP_LINKS: AtlasAppLink[] = [
  {
    app_slug: 'propria',
    display_name: 'Propria',
    primary_domain: 'propria.land',
    tagline: 'What is one’s own — vocation, calling, and land stewardship.',
    archetypes: ['caregiver_solo', 'caregiver_agency', 'ministry_outreach'],
  },
  {
    app_slug: 'communicare',
    display_name: 'Communicare',
    primary_domain: 'mycommuni.care',
    tagline: 'Farm shares and the neighbors they feed.',
    archetypes: ['caregiver_agency', 'ministry_outreach'],
  },
  {
    app_slug: 'custodia',
    display_name: 'Custodia',
    primary_domain: 'custodia.land',
    tagline: 'Care for creation and the people in its keeping.',
    archetypes: ['caregiver_agency', 'refugee_support'],
  },
  {
    app_slug: 'refugium',
    display_name: 'Refugium',
    primary_domain: 'refugium.app',
    tagline: 'A place of shelter — refuge and belonging.',
    archetypes: ['refugee_support', 'ministry_outreach'],
  },
  {
    app_slug: 'resurrectio',
    display_name: 'Resurrectio',
    primary_domain: 'resurrectio.app',
    tagline: 'Reentry, recovery, restoration.',
    archetypes: ['catholic_outreach', 'ministry_outreach'],
  },
  {
    app_slug: 'convivium',
    display_name: 'Convivium',
    primary_domain: 'convivium.app',
    tagline: 'The shared table — gathering people around a meal.',
    archetypes: ['catholic_outreach', 'community_network'],
  },
  {
    app_slug: 'transitus',
    display_name: 'Transitus',
    primary_domain: 'transitus.app',
    tagline: 'Passages and pilgrimage — accompaniment at life’s thresholds.',
    archetypes: ['catholic_outreach', 'ministry_outreach'],
  },
  {
    app_slug: 'vigilia',
    display_name: 'Vigilia',
    primary_domain: 'vigilia.app',
    tagline: 'A liturgy of attention — senior care and family rituals.',
    archetypes: ['catholic_outreach', 'ministry_outreach'],
  },
  {
    app_slug: 'sanctum',
    display_name: 'Sanctum',
    primary_domain: 'sanctum.app',
    tagline: 'Community spaces ready when ministry needs a home.',
    archetypes: ['ministry_outreach', 'church'],
  },
  {
    app_slug: 'communis',
    display_name: 'Communis',
    primary_domain: 'communis.app',
    tagline: 'Shared signal across the network — cooperative life together.',
    archetypes: ['community_network', 'church', 'catholic_outreach'],
  },
  {
    app_slug: 'bitoku',
    display_name: 'Bitoku',
    primary_domain: 'bitoku.app',
    tagline: 'Virtue formation through essays and reflection.',
    archetypes: ['community_network', 'social_enterprise'],
  },
  {
    app_slug: 'hortus',
    display_name: 'Hortus',
    primary_domain: 'hortus.app',
    tagline: 'Cultivated growth — community gardens and a rule of life.',
    archetypes: ['community_network', 'social_enterprise'],
  },
  {
    app_slug: 'culina',
    display_name: 'Culina',
    primary_domain: 'culina.app',
    tagline: 'Shared commercial kitchens for makers and neighbors.',
    archetypes: ['social_enterprise', 'community_network'],
  },
  {
    app_slug: '8s',
    display_name: '8 Seconds',
    primary_domain: '8s.rodeo',
    tagline: 'Youth rodeo — grit, mentorship, and rural belonging.',
    archetypes: ['social_enterprise'],
    metro_types: ['rural'],
  },
  {
    app_slug: 'inmotu',
    display_name: 'Inmotu',
    primary_domain: 'inmotu.racing',
    tagline: 'Grassroots motorsports for youth and amateur racers.',
    archetypes: ['social_enterprise'],
  },
  {
    app_slug: 'successio',
    display_name: 'Successio',
    primary_domain: 'successio.app',
    tagline: 'Succession planning that keeps craft and livelihood alive.',
    archetypes: ['social_enterprise', 'workforce'],
  },
  {
    app_slug: 'fabrica-forge',
    display_name: 'Fabrica Forge',
    primary_domain: 'fabrica.app',
    tagline: 'The workshop — making, craft, and cathedral build.',
    archetypes: ['workforce', 'social_enterprise'],
  },
  {
    app_slug: 'rehearso',
    display_name: 'Rehearso',
    primary_domain: 'rehearso.app',
    tagline: 'Practice toward the moment — preparation and form.',
    archetypes: ['education_access', 'social_enterprise'],
  },
  {
    app_slug: 'theschola',
    display_name: 'The Schola',
    primary_domain: 'theschola.app',
    tagline: 'A learning community rooted in the Catholic tradition.',
    archetypes: ['education_access', 'catholic_outreach'],
  },
  {
    app_slug: 'directio',
    display_name: 'Directio',
    primary_domain: 'godirectio.com',
    tagline: 'Driver education that meets each state where it stands.',
    archetypes: ['catholic_outreach', 'education_access'],
  },
  {
    app_slug: 'thegreatnave',
    display_name: 'The Great Nave',
    primary_domain: 'thegreatnave.app',
    tagline: 'A journey through opera, ballet, and sacred music.',
    archetypes: ['catholic_outreach', 'ministry_outreach'],
  },
  {
    app_slug: 'via-publica',
    display_name: 'Via Publica',
    primary_domain: 'viapublica.com',
    tagline: 'The public way — civic life and the common road.',
    archetypes: ['digital_inclusion', 'community_network'],
  },
];

/**
 * Apps serving a given archetype × metro-type pairing, sorted by app_slug
 * for deterministic rendering. An app with no `metro_types` serves all metros.
 */
export function getAppsForAtlasEntry(
  archetype: string,
  metroType: 'urban' | 'suburban' | 'rural',
): AtlasAppLink[] {
  return ATLAS_APP_LINKS
    .filter((a) => a.archetypes.includes(archetype))
    .filter((a) => !a.metro_types || a.metro_types.includes(metroType))
    .sort((a, b) => a.app_slug.localeCompare(b.app_slug));
}

/**
 * Atlas entries served by a given app (the reverse direction), used by the
 * satellite back-links snapshot + edge function.
 */
export function getAtlasEntriesForApp(app_slug: string): AtlasEntry[] {
  const app = ATLAS_APP_LINKS.find((a) => a.app_slug === app_slug);
  if (!app) return [];
  return MISSION_ATLAS.filter((e) =>
    app.archetypes.includes(e.archetype) &&
    (!app.metro_types || app.metro_types.includes(e.metroType)),
  );
}
