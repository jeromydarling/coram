/**
 * authorityLinks — Auto-suggestion helper for Field Journal + Authority content linking.
 *
 * WHAT: Scans content text and suggests links to Archetypes, Lexicon, and Mission Atlas.
 * WHERE: Used by Operator Nexus to surface link suggestions for new content.
 * WHY: Ensures every narrative page becomes a semantic bridge without manual editing.
 */
import { CROS_LEXICON } from '@/content/lexicon';
import { MISSION_ATLAS } from '@/content/missionAtlas';

export interface SuggestedLink {
  type: 'lexicon' | 'archetype' | 'atlas' | 'role';
  label: string;
  path: string;
  reason: string;
}

const ARCHETYPE_MAP: Record<string, { label: string; path: string }> = {
  church: { label: 'Church / Faith Community', path: '/archetypes/church/deep' },
  catholic_outreach: { label: 'Catholic Outreach', path: '/archetypes/catholic-outreach/deep' },
  nonprofit: { label: 'Nonprofit Program', path: '/archetypes/nonprofit/deep' },
  social_enterprise: { label: 'Social Enterprise', path: '/archetypes/social-enterprise/deep' },
  workforce: { label: 'Workforce Development', path: '/archetypes/workforce/deep' },
  digital_inclusion: { label: 'Digital Inclusion', path: '/archetypes/digital-inclusion/deep' },
};

const ROLE_MAP: Record<string, { label: string; path: string }> = {
  Shepherd: { label: 'Shepherd', path: '/roles/shepherd' },
  Companion: { label: 'Companion', path: '/roles/companion' },
  Visitor: { label: 'Visitor', path: '/roles/visitor' },
  Steward: { label: 'Steward', path: '/roles/steward' },
  Leader: { label: 'Leader', path: '/roles' },
};

/**
 * Given an archetype key and role list, suggest relevant cross-links.
 */
export function suggestLinksForContent(opts: {
  archetype?: string;
  roles?: string[];
  text?: string;
}): SuggestedLink[] {
  const links: SuggestedLink[] = [];

  // Archetype link
  if (opts.archetype && ARCHETYPE_MAP[opts.archetype]) {
    const a = ARCHETYPE_MAP[opts.archetype];
    links.push({ type: 'archetype', label: a.label, path: a.path, reason: `Content relates to the ${a.label} archetype.` });
  }

  // Role links
  if (opts.roles) {
    opts.roles.forEach((role) => {
      const r = ROLE_MAP[role];
      if (r) links.push({ type: 'role', label: r.label, path: r.path, reason: `The ${r.label} role is referenced.` });
    });
  }

  // Lexicon term matches
  if (opts.text) {
    const lower = opts.text.toLowerCase();
    CROS_LEXICON.forEach((entry) => {
      if (lower.includes(entry.title.toLowerCase())) {
        links.push({ type: 'lexicon', label: entry.title, path: `/lexicon/${entry.slug}`, reason: `Term "${entry.title}" appears in content.` });
      }
    });
  }

  // Atlas matches
  if (opts.archetype) {
    MISSION_ATLAS.filter((a) => a.archetype === opts.archetype).forEach((a) => {
      links.push({ type: 'atlas', label: `${a.archetype} — ${a.metroType}`, path: `/mission-atlas/${a.id}`, reason: 'Matching archetype in Mission Atlas.' });
    });
  }

  return links;
}
