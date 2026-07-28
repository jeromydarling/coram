/**
 * Library Concepts — Canonical civic language definitions for CROS™.
 *
 * WHAT: Static content for the public narrative library.
 * WHERE: Used by LibraryConceptPage.tsx at /library/:conceptSlug.
 * WHY: Establishes CROS™ as an ontology source for civic relationship language.
 */

export interface LibraryConcept {
  slug: string;
  title: string;
  definition: string;
  roleConnections: { role: string; connection: string }[];
  archetypeConnections: { archetype: string; connection: string }[];
  realWorldExamples: string[];
  relatedSlugs: string[];
}

export const libraryConcepts: LibraryConcept[] = [
  {
    slug: 'relationship-memory',
    title: 'Relationship Memory',
    definition: 'Relationship Memory is the practice of preserving the human context of every interaction — not as data points, but as chapters in a living story. It ensures that no conversation, visit, or moment of care is ever truly forgotten.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds draw on relationship memory to notice drift and maintain the longer narrative of community life.' },
      { role: 'Companion', connection: 'Companions use relationship memory daily — remembering last conversations, follow-up commitments, and the small details that make people feel known.' },
      { role: 'Visitor', connection: 'Visitors contribute to relationship memory through field notes and voice recordings that capture moments others might miss.' },
    ],
    archetypeConnections: [
      { archetype: 'Church / Faith Community', connection: 'Pastoral care depends on remembering who is hurting, who is growing, and who has been absent.' },
      { archetype: 'Refugee Support Organization', connection: 'Settlement teams must remember complex family histories, needs, and progress across long timelines.' },
    ],
    realWorldExamples: [
      'A parish visitor remembers that a family mentioned a job loss three weeks ago — and follows up with gentle support.',
      'A workforce coordinator recalls that a graduate preferred evening shifts — and matches them accordingly.',
    ],
    relatedSlugs: ['narrative-intelligence', 'drift-detection', 'journey-chapter'],
  },
  {
    slug: 'narrative-intelligence',
    title: 'Narrative Relational Intelligence',
    definition: 'NRI is intelligence that emerges from human experience — reflections, events attended, conversations, and community signals. Unlike artificial intelligence, NRI is grounded in lived relationships and serves the people who created it.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds receive NRI as narrative summaries — thematic patterns that reveal where the community is moving.' },
      { role: 'Companion', connection: 'Companions benefit from NRI suggestions that surface follow-up opportunities based on relationship history.' },
      { role: 'Steward', connection: 'Stewards configure and maintain the systems that allow NRI to function reliably.' },
    ],
    archetypeConnections: [
      { archetype: 'Social Enterprise', connection: 'NRI helps social enterprises track trust-building patterns across partner relationships.' },
      { archetype: 'Education Access Program', connection: 'NRI surfaces attendance and engagement patterns that help educators respond proactively.' },
    ],
    realWorldExamples: [
      'NRI notices that three families in a neighborhood have all mentioned transportation barriers — suggesting a systemic pattern worth addressing.',
      'A monthly narrative summary reveals that volunteer engagement peaks during school breaks.',
    ],
    relatedSlugs: ['relationship-memory', 'community-awareness', 'testimonium'],
  },
  {
    slug: 'community-awareness',
    title: 'Community Awareness',
    definition: 'Community Awareness is the practice of staying attuned to the civic rhythms of a region — local events, shifting needs, seasonal patterns, and the quiet signals that precede larger changes.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds use community awareness to guide strategic direction and anticipate seasonal needs.' },
      { role: 'Companion', connection: 'Companions stay aware of local events that create natural touchpoints for relationship building.' },
      { role: 'Visitor', connection: 'Visitors bring ground-level awareness back from the field — what they see, hear, and sense.' },
    ],
    archetypeConnections: [
      { archetype: 'Library System', connection: 'Libraries track program demand shifts and community interest patterns to adapt their offerings.' },
      { archetype: 'Digital Inclusion Nonprofit', connection: 'Digital inclusion teams monitor connectivity gaps and device needs across neighborhoods.' },
    ],
    realWorldExamples: [
      'A surge in ESL class registrations signals a new wave of arrivals in a neighborhood.',
      'Local event discovery reveals three community organizations hosting food drives in the same week — an opportunity for coordination.',
    ],
    relatedSlugs: ['narrative-intelligence', 'civic-gravity', 'metro-narrative'],
  },
  {
    slug: 'drift-detection',
    title: 'Drift Detection',
    definition: 'Drift Detection is the gentle art of noticing when someone or something begins to fade — a volunteer who stops showing up, a partner who goes quiet, a community pattern that shifts without announcement.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds are the primary recipients of drift signals — they hold the longer view and notice absence.' },
      { role: 'Companion', connection: 'Companions act on drift signals by reaching out with care, not urgency.' },
    ],
    archetypeConnections: [
      { archetype: 'Church / Faith Community', connection: 'Noticing when a family stops attending is one of the most important acts of pastoral care.' },
      { archetype: 'Workforce Development', connection: 'Detecting when a recent graduate disengages from support services can prevent a cascade of setbacks.' },
    ],
    realWorldExamples: [
      'A weekly reflection reveals that a long-standing volunteer has not been mentioned in three weeks.',
      'Journey chapter analysis shows a partner organization has not logged any activity in 45 days.',
    ],
    relatedSlugs: ['relationship-memory', 'narrative-intelligence', 'journey-chapter'],
  },
  {
    slug: 'journey-chapter',
    title: 'Journey Chapter',
    definition: 'A Journey Chapter is a meaningful segment of a relationship\u2019s story — not a sales stage, but a human season. Chapters capture where a relationship has been, where it is now, and what it might need next.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds read journey chapters to understand the arc of community relationships over time.' },
      { role: 'Companion', connection: 'Companions write journey chapters through their daily work — each follow-up adds a line to the story.' },
      { role: 'Steward', connection: 'Stewards ensure journey data is clean and chapters reflect reality.' },
    ],
    archetypeConnections: [
      { archetype: 'Refugee Support Organization', connection: 'Settlement journeys unfold over months and years — chapters capture each phase of integration.' },
      { archetype: 'Education Access Program', connection: 'Student journeys track engagement from first contact through program completion.' },
    ],
    realWorldExamples: [
      'A partner\u2019s journey moves from "Initial Conversation" to "Active Collaboration" after a shared community event.',
      'A refugee family\u2019s chapter updates from "Arrival Support" to "Community Integration" as they join local programs.',
    ],
    relatedSlugs: ['relationship-memory', 'drift-detection', 'testimonium'],
  },
  {
    slug: 'civic-gravity',
    title: 'Civic Gravity',
    definition: 'Civic Gravity is the pull that forms when multiple organizations in a region begin working toward similar goals — not through coordination, but through the natural convergence of mission and place.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds sense civic gravity through narrative patterns — when themes converge across unrelated organizations.' },
      { role: 'Steward', connection: 'Stewards track civic gravity through metro-level data and momentum signals.' },
    ],
    archetypeConnections: [
      { archetype: 'Social Enterprise', connection: 'Social enterprises often create civic gravity by attracting aligned organizations to a shared neighborhood.' },
      { archetype: 'Library System', connection: 'Libraries are natural gravity centers — their programming reflects and amplifies community needs.' },
    ],
    realWorldExamples: [
      'Three nonprofits in the same metro independently begin focusing on housing — a civic gravity pattern emerges.',
      'A neighborhood\u2019s volunteer activity doubles after a community garden project creates a gathering point.',
    ],
    relatedSlugs: ['community-awareness', 'metro-narrative', 'communio'],
  },
  {
    slug: 'testimonium',
    title: 'Testimonium',
    definition: 'Testimonium is the practice of structured storytelling — transforming the quiet daily work of community care into narratives that honor the mission, inform leadership, and inspire continued service.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds use Testimonium narratives for board reports, grant applications, and mission reflection.' },
      { role: 'Companion', connection: 'Companions\u2019 daily work becomes the raw material for Testimonium stories — their follow-ups and reflections feed the narrative engine.' },
      { role: 'Visitor', connection: 'Visitors\u2019 field notes and voice recordings provide the most vivid source material for Testimonium.' },
    ],
    archetypeConnections: [
      { archetype: 'Church / Faith Community', connection: 'Testimonium helps parishes articulate their impact without reducing people to statistics.' },
      { archetype: 'Digital Inclusion Nonprofit', connection: 'Impact narratives from Testimonium demonstrate the human side of digital equity work.' },
    ],
    realWorldExamples: [
      'A quarterly Testimonium report shows how a single Companion\u2019s consistent follow-ups reconnected twelve families to community services.',
      'An annual narrative export reveals seasonal patterns in volunteer engagement that inform next year\u2019s strategy.',
    ],
    relatedSlugs: ['narrative-intelligence', 'journey-chapter', 'civic-gravity'],
  },
  {
    slug: 'metro-narrative',
    title: 'Metro Narrative',
    definition: 'A Metro Narrative is the aggregated civic story of a region — the themes, momentum, and patterns that emerge when multiple organizations contribute their anonymized signals to a shared understanding of place.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds read metro narratives to understand their organization\u2019s role within the larger civic ecosystem.' },
      { role: 'Steward', connection: 'Stewards contribute to metro narratives by maintaining clean, accurate data that feeds the aggregation layer.' },
    ],
    archetypeConnections: [
      { archetype: 'Workforce Development', connection: 'Metro narratives reveal labor market shifts and training demand patterns across a region.' },
      { archetype: 'Library System', connection: 'Library systems both contribute to and benefit from metro narratives about community information needs.' },
    ],
    realWorldExamples: [
      'A metro narrative reveals that outreach teams across Cincinnati are all focusing on home visits this season.',
      'Aggregated signals show rising interest in ESL services across three neighborhoods — a pattern no single organization could see alone.',
    ],
    relatedSlugs: ['civic-gravity', 'community-awareness', 'communio'],
  },
  {
    slug: 'communio',
    title: 'Communio',
    definition: 'Communio is the practice of shared awareness between organizations — an opt-in network where anonymized signals flow between missions that serve the same communities, creating collective intelligence without compromising privacy.',
    roleConnections: [
      { role: 'Shepherd', connection: 'Shepherds decide what to share and observe patterns across the broader network.' },
      { role: 'Steward', connection: 'Stewards configure Communio sharing levels and ensure privacy guardrails are maintained.' },
    ],
    archetypeConnections: [
      { archetype: 'Church / Faith Community', connection: 'Parishes in the same diocese can share anonymized outreach patterns to coordinate care without duplicating effort.' },
      { archetype: 'Refugee Support Organization', connection: 'Settlement agencies can share arrival patterns and service gaps to better prepare their communities.' },
    ],
    realWorldExamples: [
      'Two nonprofits in the same metro discover through Communio that they\u2019re both serving the same neighborhood — and begin coordinating.',
      'A shared signal reveals that volunteer availability drops across all organizations during the same two-week period each year.',
    ],
    relatedSlugs: ['civic-gravity', 'metro-narrative', 'community-awareness'],
  },
];

export function getConceptBySlug(slug: string): LibraryConcept | undefined {
  return libraryConcepts.find((c) => c.slug === slug);
}

export function getRelatedConcepts(slugs: string[]): LibraryConcept[] {
  return libraryConcepts.filter((c) => slugs.includes(c.slug));
}
