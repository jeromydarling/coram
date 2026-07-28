/**
 * missionAtlas — Curated narrative content for the Mission Atlas™.
 *
 * WHAT: Static registry of mission patterns across archetype × metro-type combinations.
 * WHERE: Rendered on /mission-atlas and /mission-atlas/:id detail pages.
 * WHY: Builds semantic SEO authority around mission work without exposing tenant data.
 */

export interface AtlasEntry {
  id: string;
  archetype: string;
  metroType: 'urban' | 'suburban' | 'rural';
  themes: string[];
  signals: string[];
  roles: string[];
  narrative: string;
  weekLink?: string;
}

const ARCHETYPE_DISPLAY: Record<string, string> = {
  church: 'Church / Faith Community',
  catholic_outreach: 'Catholic Outreach',
  digital_inclusion: 'Digital Inclusion',
  social_enterprise: 'Social Enterprise',
  workforce: 'Workforce Development',
  refugee_support: 'Refugee Support',
  education_access: 'Education Access',
  library_system: 'Library System',
  community_network: 'Community Network',
  ministry_outreach: 'Ministry Outreach',
  caregiver_solo: 'Companion (Solo)',
  caregiver_agency: 'Companion Organization',
};

const METRO_TYPE_DISPLAY: Record<string, string> = {
  urban: 'Urban',
  suburban: 'Suburban',
  rural: 'Rural',
};

export const MISSION_ATLAS: AtlasEntry[] = [
  {
    id: 'church-urban',
    archetype: 'church',
    metroType: 'urban',
    themes: ['pastoral care', 'community meals', 'neighborhood presence'],
    signals: ['presence', 'reconnection', 'care_momentum'],
    roles: ['shepherd', 'companion', 'visitor'],
    narrative:
      'Urban faith communities often anchor their mission in consistent presence — showing up at food pantries, neighborhood gatherings, and hospital visits. The rhythm is relational, not programmatic. Shepherds hold the longer story of families across generations, while companions walk alongside individuals navigating housing, employment, or grief. Visitors carry the ministry of showing up — brief, intentional encounters that say "you are not forgotten."',
    weekLink: '/week/shepherd',
  },
  {
    id: 'church-rural',
    archetype: 'church',
    metroType: 'rural',
    themes: ['pastoral care', 'relationship networks', 'seasonal rhythms'],
    signals: ['story_signals', 'narrative_growth'],
    roles: ['shepherd', 'companion'],
    narrative:
      'In rural communities, churches serve as both spiritual home and civic anchor. Relationships span decades and are interwoven with land, weather, and shared history. The shepherd role here is deeply generational — knowing not just a person but their family story. Ministry often follows seasonal patterns: harvest gatherings, winter visitation, spring renewal programs.',
  },
  {
    id: 'catholic-outreach-urban',
    archetype: 'catholic_outreach',
    metroType: 'urban',
    themes: ['visitation', 'community care', 'food assistance', 'reconciliation'],
    signals: ['presence', 'reconnection', 'care_momentum'],
    roles: ['shepherd', 'companion', 'visitor'],
    narrative:
      'Urban Catholic outreach ministries often begin with visitation rhythms — deacons and lay ministers calling on the homebound, visiting hospitals, and staffing parish food pantries. The companion role is central: walking alongside families through RCIA, bereavement, and sacramental preparation. Presence signals tend to be strong where volunteer visitation is consistent.',
    weekLink: '/week/catholic-visitor',
  },
  {
    id: 'catholic-outreach-rural',
    archetype: 'catholic_outreach',
    metroType: 'rural',
    themes: ['parish clusters', 'traveling ministry', 'sacramental presence'],
    signals: ['visit_activity', 'care'],
    roles: ['shepherd', 'visitor'],
    narrative:
      'Rural Catholic communities frequently share pastors across parish clusters, making intentional presence a logistical act of devotion. Visitors may drive significant distances to bring communion to the homebound. The narrative here is one of persistence and fidelity — maintaining sacramental presence across geography.',
  },
  {
    id: 'social-enterprise-urban',
    archetype: 'social_enterprise',
    metroType: 'urban',
    themes: ['workforce training', 'partnership networks', 'impact measurement'],
    signals: ['partnership', 'momentum', 'impact'],
    roles: ['shepherd', 'companion', 'steward'],
    narrative:
      'Urban social enterprises operate at the intersection of mission and market. Shepherds maintain relationships with both beneficiaries and business partners. Stewards ensure that technology provisions and data flows serve the mission rather than bureaucracy. Momentum signals often emerge when partnership networks activate around a shared workforce goal.',
    weekLink: '/week/social-outreach',
  },
  {
    id: 'social-enterprise-suburban',
    archetype: 'social_enterprise',
    metroType: 'suburban',
    themes: ['community hubs', 'volunteer coordination', 'local business partnerships'],
    signals: ['engagement', 'partnership'],
    roles: ['companion', 'steward'],
    narrative:
      'Suburban social enterprises often anchor around community hubs — coworking spaces, maker labs, or training centers. The companion role focuses on connecting participants to local employers, while stewards build the infrastructure that sustains these bridges. Engagement signals grow when community events become regular touchpoints.',
  },
  {
    id: 'workforce-urban',
    archetype: 'workforce',
    metroType: 'urban',
    themes: ['job placement', 'skills training', 'retention support'],
    signals: ['placement', 'retention', 'momentum'],
    roles: ['shepherd', 'companion', 'visitor'],
    narrative:
      'Urban workforce development organizations measure success not in placements alone but in sustained employment. Shepherds track the longer journey — from intake through training, placement, and the critical first 90 days. Companions provide wraparound support for transportation, childcare, and financial literacy. Retention momentum signals reveal whether the ecosystem is truly supporting lasting change.',
  },
  {
    id: 'refugee-support-urban',
    archetype: 'refugee_support',
    metroType: 'urban',
    themes: ['resettlement', 'language access', 'cultural integration', 'legal advocacy'],
    signals: ['care', 'visit_activity', 'integration'],
    roles: ['shepherd', 'companion', 'visitor'],
    narrative:
      'Refugee support in urban contexts demands a web of relationships — caseworkers, volunteers, interpreters, and community sponsors. The shepherd holds the family\'s complete story across agencies and systems. Visitors provide the consistent human contact that counteracts the isolation of displacement. Integration signals emerge slowly, measured in school enrollments, employment milestones, and community connections.',
  },
  {
    id: 'education-access-urban',
    archetype: 'education_access',
    metroType: 'urban',
    themes: ['tutoring networks', 'mentorship', 'college readiness'],
    signals: ['enrollment', 'progress', 'graduation'],
    roles: ['shepherd', 'companion', 'steward'],
    narrative:
      'Education access programs in urban areas create structured pathways from early literacy through college readiness. Shepherds maintain multi-year relationships with students and families. Companions serve as tutors and mentors — consistent presences in after-school programs and summer academies. Progress signals track not just grades but engagement, attendance patterns, and family involvement.',
  },
  {
    id: 'library-system-suburban',
    archetype: 'library_system',
    metroType: 'suburban',
    themes: ['digital literacy', 'community programming', 'civic engagement'],
    signals: ['engagement', 'community', 'access'],
    roles: ['shepherd', 'companion', 'steward'],
    narrative:
      'Suburban library systems increasingly serve as community relationship hubs — offering not just books but digital literacy classes, job search support, and civic meeting spaces. Stewards manage the technology provisions that keep these services accessible. Engagement signals often correlate with programming diversity and volunteer presence.',
  },
  {
    id: 'community-network-urban',
    archetype: 'community_network',
    metroType: 'urban',
    themes: ['coalition building', 'shared geography', 'cross-org coordination'],
    signals: ['collaboration', 'partnership', 'community'],
    roles: ['shepherd', 'companion', 'steward'],
    narrative:
      'Urban community networks weave together multiple organizations serving the same geography — food banks, housing advocates, workforce programs, and faith communities. The shepherd role here is connective: seeing how one family\'s story touches three different agencies. Companions maintain the cross-org handoffs that prevent people from falling through cracks. Stewards build the shared infrastructure that makes collaboration sustainable rather than heroic.',
    weekLink: '/week/community-connector',
  },
  {
    id: 'community-network-suburban',
    archetype: 'community_network',
    metroType: 'suburban',
    themes: ['neighborhood hubs', 'mutual aid', 'volunteer networks'],
    signals: ['engagement', 'community', 'care'],
    roles: ['companion', 'steward'],
    narrative:
      'Suburban community networks often emerge around neighborhood hubs — schools, libraries, community centers, and houses of worship. The work is less about formal coalition and more about mutual awareness: knowing who serves what, sharing referrals naturally, and building the trust that makes collaboration feel organic rather than institutional.',
  },
  {
    id: 'community-network-rural',
    archetype: 'community_network',
    metroType: 'rural',
    themes: ['geographic isolation', 'resource sharing', 'seasonal coordination'],
    signals: ['visit_activity', 'care', 'presence'],
    roles: ['shepherd', 'visitor'],
    narrative:
      'In rural settings, community networks compensate for geographic isolation. A single visitor may connect a family to a food pantry, a job training program, and a mental health resource — all different organizations, all requiring coordination. The shepherd holds the map of these relationships across distance, ensuring no community pocket is forgotten.',
  },
  {
    id: 'ministry-outreach-urban',
    archetype: 'ministry_outreach',
    metroType: 'urban',
    themes: ['pastoral care', 'food assistance', 'neighborhood ministry', 'prayer networks'],
    signals: ['presence', 'reconnection', 'care_momentum'],
    roles: ['shepherd', 'companion', 'visitor'],
    narrative:
      'Urban ministry outreach operates in density — many needs, many neighbors, many opportunities for presence. Teams may staff food pantries, visit hospitals, lead prayer groups, and coordinate with social services in the same week. CROS helps these teams hold the relational thread across encounters, so that the family seen at the food pantry on Tuesday is remembered when they appear at the prayer group on Thursday.',
    weekLink: '/week/ministry-visitor',
  },
  {
    id: 'ministry-outreach-rural',
    archetype: 'ministry_outreach',
    metroType: 'rural',
    themes: ['traveling ministry', 'home visitation', 'seasonal outreach'],
    signals: ['visit_activity', 'story_signals'],
    roles: ['shepherd', 'visitor'],
    narrative:
      'Rural ministry outreach is defined by distance and devotion. A visitor may drive an hour to bring communion to a homebound parishioner, then another forty minutes to check on a family in crisis. The rhythm is slower but the relationships run deeper. The shepherd role is generational — knowing not just a person but their family across decades.',
  },
  {
    id: 'companion-solo-urban',
    archetype: 'caregiver_solo',
    metroType: 'urban',
    themes: ['accompaniment documentation', 'growth journals', 'season tracking'],
    signals: ['care', 'presence'],
    roles: ['visitor'],
    narrative:
      'Solo companions in urban contexts carry an invisible load — mentoring, sponsoring, visiting, and holding the emotional weight of accompaniment without institutional support. CROS provides a private, sacred space for documenting the journey: voice notes after meaningful conversations, season summaries that honor the growth, and gentle signals that remind the companion they are not alone. No organization sees this data. It belongs entirely to the person walking alongside another.',
  },
  {
    id: 'companion-org-urban',
    archetype: 'caregiver_agency',
    metroType: 'urban',
    themes: ['team coordination', 'accompaniment continuity', 'dignity-first documentation'],
    signals: ['care', 'engagement', 'momentum'],
    roles: ['shepherd', 'companion', 'steward'],
    narrative:
      'Companion organizations coordinate multiple team members serving vulnerable populations — mentors, sponsors, home visitors, coaches, and companions for aging adults. The steward manages scheduling and coordination. The companion maintains the daily relationship thread. The shepherd sees the bigger picture: which people are thriving, which team members need support, which relationships need attention. CROS protects companion journal privacy while giving leadership the aggregate signals they need.',
  },
  {
    id: 'companion-org-suburban',
    archetype: 'caregiver_agency',
    metroType: 'suburban',
    themes: ['home-based accompaniment', 'family coordination', 'volunteer supplementation'],
    signals: ['visit_activity', 'care', 'engagement'],
    roles: ['companion', 'visitor', 'steward'],
    narrative:
      'Suburban companion organizations often serve people in their homes across spread-out neighborhoods. Travel time between visits shapes the daily rhythm. Companions coordinate with family members — adult children, spouses, neighbors — to ensure continuity. CROS tracks the relationship web around each person without exposing private logs to anyone outside the direct accompaniment team.',
  },
  {
    id: 'workforce-suburban',
    archetype: 'workforce',
    metroType: 'suburban',
    themes: ['employer partnerships', 'training facilities', 'transportation bridges'],
    signals: ['placement', 'partnership', 'momentum'],
    roles: ['companion', 'steward'],
    narrative:
      'Suburban workforce development often wrestles with the transportation gap — training centers in one area, employers in another, participants scattered across car-dependent neighborhoods. Companions help bridge this practical gap while maintaining the human relationship. Stewards build the partnership infrastructure that connects training completers to employer networks. Momentum signals reveal whether placements are sticking beyond the first month.',
  },
  {
    id: 'digital-inclusion-urban',
    archetype: 'digital_inclusion',
    metroType: 'urban',
    themes: ['device access', 'digital literacy', 'community technology'],
    signals: ['engagement', 'access', 'community'],
    roles: ['companion', 'visitor', 'steward'],
    narrative:
      'Urban digital inclusion work happens at the intersection of access and trust — getting devices into hands matters less than getting people comfortable using them. Visitors go to senior centers, public housing, and community rooms to teach, listen, and adapt. Companions follow up when someone stops showing up. Stewards manage device inventory and track community impact without reducing participants to "digital literacy outcomes."',
  },
  {
    id: 'digital-inclusion-suburban',
    archetype: 'digital_inclusion',
    metroType: 'suburban',
    themes: ['library partnerships', 'senior outreach', 'broadband advocacy'],
    signals: ['engagement', 'partnership'],
    roles: ['companion', 'steward'],
    narrative:
      'Suburban digital inclusion often partners with libraries, senior centers, and school districts. The work is less about hardware distribution and more about sustained digital comfort — helping people feel confident navigating telehealth, online banking, and video calls with grandchildren. Companions provide the patient, repeated support that builds lasting digital confidence.',
  },
];

/** Get a single atlas entry by ID */
export function getAtlasEntry(id: string): AtlasEntry | undefined {
  return MISSION_ATLAS.find((e) => e.id === id);
}

/** Get all atlas entries for an archetype */
export function getAtlasEntriesByArchetype(archetype: string): AtlasEntry[] {
  return MISSION_ATLAS.filter((e) => e.archetype === archetype);
}

/** Get all unique archetypes that have atlas entries */
export function getCoveredArchetypes(): string[] {
  return [...new Set(MISSION_ATLAS.map((e) => e.archetype))];
}

/** Get archetype display name */
export function getArchetypeDisplay(key: string): string {
  return ARCHETYPE_DISPLAY[key] || key;
}

/** Get metro type display name */
export function getMetroTypeDisplay(key: string): string {
  return METRO_TYPE_DISPLAY[key] || key;
}

/** List archetypes from the graph that have NO atlas entries */
export function getUncoveredArchetypes(allArchetypes: string[]): string[] {
  const covered = getCoveredArchetypes();
  return allArchetypes.filter((a) => !covered.includes(a));
}
