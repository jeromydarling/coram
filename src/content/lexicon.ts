/**
 * lexicon — The CROS Lexicon™ content registry.
 *
 * WHAT: Curated definitions of key terms that form the CROS worldview.
 * WHERE: Rendered on /lexicon and /lexicon/:slug pages.
 * WHY: Establishes CROS as the authoritative language source for relational mission work.
 */

export type LexiconCategory = 'Concept' | 'Role' | 'Signal' | 'Practice' | 'Module';

export interface LexiconEntry {
  slug: string;
  title: string;
  category: LexiconCategory;
  summary: string;
  body: string;
  related: string[];
  appearsIn?: string[];
}

const CATEGORY_ORDER: Record<LexiconCategory, number> = {
  Concept: 0,
  Role: 1,
  Signal: 2,
  Practice: 3,
  Module: 4,
};

export const CROS_LEXICON: LexiconEntry[] = [
  // ── Concepts ──
  {
    slug: 'narrative-relational-intelligence',
    title: 'Narrative Relational Intelligence (NRI™)',
    category: 'Concept',
    summary: 'Understanding relationships through story rather than metrics.',
    body: `Narrative Relational Intelligence is the core philosophy behind CROS. It asserts that the deepest understanding of a relationship comes not from data points — open rates, click-throughs, or pipeline stages — but from the stories people tell about each other.

NRI draws from reflections, visit notes, event encounters, and community signals to build a living awareness of how relationships are evolving. It does not predict outcomes. It witnesses movement.

When a shepherd writes, "Maria seemed lighter today — she mentioned her daughter got into college," that reflection becomes part of the relational intelligence. No algorithm generated it. A human noticed it.

NRI is the bridge between technology and tenderness. It is the reason CROS exists.`,
    related: ['testimonium', 'presence-signal', 'reflection', 'shepherd-role'],
    appearsIn: ['/nri', '/archetypes', '/mission-atlas'],
  },
  {
    slug: 'communal-relationship-operating-system',
    title: 'Communal Relationship Operating System (CROS™)',
    category: 'Concept',
    summary: 'A living system that helps organizations care for communities without losing their humanity.',
    body: `CROS is not a CRM. It is a Communal Relationship Operating System — a platform designed for organizations whose primary work is relational.

For the last forty years, technology has been driven by operating systems and artificial intelligence. Both were invented by humans, but both have largely remained cold, data-driven, and impersonal. CROS replaces the operating system paradigm with a human touch.

The word "CROS" represents a crossing — a relationship bridge between an organization and the community it serves. It combines Relationship Memory, Community Awareness, and Narrative Intelligence into a single living system.

Where most platforms track transactions, CROS remembers people. Where traditional AI analyzes data, NRI learns from human experience.`,
    related: ['narrative-relational-intelligence', 'mission-archetype', 'shepherd-role'],
    appearsIn: ['/manifesto', '/cros'],
  },
  {
    slug: 'mission-archetype',
    title: 'Mission Archetype',
    category: 'Concept',
    summary: 'A pattern of mission work that shapes how an organization uses CROS.',
    body: `During onboarding, every CROS organization selects a Mission Archetype — a pattern that describes how they serve their community. Archetypes include Church / Faith Community, Digital Inclusion Nonprofit, Social Enterprise, Workforce Development, Refugee Support, Education Access, and Library System.

Each archetype adjusts the language, default journey stages, discovery keyword sets, and the narrative tone of NRI suggestions throughout the platform. A refugee support organization experiences CROS differently than a parish — not because the technology changes, but because the language adapts to honor the mission.

Archetypes are not rigid categories. They are narrative starting points — invitations to see how others with similar callings navigate relationship work.`,
    related: ['narrative-relational-intelligence', 'journey-chapter', 'civitas'],
    appearsIn: ['/archetypes', '/mission-atlas'],
  },

  // ── Roles ──
  {
    slug: 'shepherd-role',
    title: 'Shepherd',
    category: 'Role',
    summary: 'A guide who tends relationships and listens for narrative shifts.',
    body: `The Shepherd is the person who holds the longer story. In a church, this might be a pastor or deacon. In a workforce program, it might be a case manager. In a refugee resettlement agency, it might be the lead caseworker.

Shepherds don't just manage contacts — they tend relationships across time. They notice when someone has been quiet. They remember the conversation from three months ago. They carry the narrative thread that connects a family's past to their present moment.

In CROS, the Shepherd role unlocks features designed for long-arc awareness: journey chapters, drift detection, and narrative reflections. The system supports the shepherd's memory so they can stay present with people rather than buried in data entry.`,
    related: ['companion-role', 'visitor-role', 'reflection', 'journey-chapter'],
    appearsIn: ['/roles/shepherd', '/mission-atlas'],
  },
  {
    slug: 'companion-role',
    title: 'Companion',
    category: 'Role',
    summary: 'Someone who walks alongside people through daily challenges.',
    body: `The Companion is the person who walks alongside. Where the Shepherd holds the longer story, the Companion is present in the daily texture — accompanying someone to a job interview, helping a family navigate a school enrollment, or sitting with a grieving parishioner.

Companions often work in the space between formal programs and informal care. They are the volunteers, the lay ministers, the community health workers. Their presence is their offering.

In CROS, the Companion role emphasizes activity logging, volunteer coordination, and provisioning — the practical tools that support consistent, caring presence without bureaucratic overhead.`,
    related: ['shepherd-role', 'visitor-role', 'presence-signal', 'voluntarium'],
    appearsIn: ['/roles/companion', '/mission-atlas'],
  },
  {
    slug: 'visitor-role',
    title: 'Visitor',
    category: 'Role',
    summary: 'Someone who carries the ministry of showing up.',
    body: `The Visitor carries the ministry of showing up — brief, intentional encounters that communicate "you are not forgotten." In Catholic outreach, this is the Eucharistic minister bringing communion to the homebound. In a workforce program, this might be the follow-up specialist checking in after placement.

Visitors work in rhythms: weekly hospital rounds, monthly homebound calls, quarterly check-ins with alumni. Their consistency builds trust over time, even when individual visits feel small.

In CROS, the Visitor role centers on visit tracking, presence signals, and the Impulsus journal — capturing the quiet moments that rarely make it into formal reports but always matter to the people involved.`,
    related: ['shepherd-role', 'companion-role', 'presence-signal', 'impulsus'],
    appearsIn: ['/roles/visitor', '/mission-atlas'],
  },
  {
    slug: 'steward-role',
    title: 'Steward',
    category: 'Role',
    summary: 'The person who makes the work easier for others.',
    body: `The Steward is the infrastructure builder — the person who ensures that technology, data, and processes serve the mission rather than complicate it. Stewards configure provisions, manage integrations, and maintain the systems that let shepherds, companions, and visitors focus on people.

The Steward role is often held by an operations director, IT coordinator, or administrative leader. Their work is invisible when done well — and deeply felt when absent.

In CROS, Stewards access Prōvīsiō for technology requests, Relatio for integration management, and Signum for discovery intelligence. They are the bridge between organizational needs and platform capability.`,
    related: ['shepherd-role', 'provisio', 'relatio', 'signum'],
    appearsIn: ['/roles/steward'],
  },

  // ── Signals ──
  {
    slug: 'presence-signal',
    title: 'Presence Signal',
    category: 'Signal',
    summary: 'A sign that consistent human engagement is happening.',
    body: `A Presence Signal emerges when an organization maintains consistent relational contact with the people it serves. It is not a metric to be maximized — it is a pattern to be noticed.

Presence signals arise from visit logs, event attendance, volunteer hours, and reflection entries. When a team records visits consistently, the system recognizes a rhythm of presence. When that rhythm breaks, the system can gently surface a drift detection — not as an alarm, but as an invitation to notice.

Presence signals are the heartbeat of NRI. They do not measure success. They witness movement.`,
    related: ['narrative-relational-intelligence', 'drift-detection', 'visitor-role'],
    appearsIn: ['/signals', '/mission-atlas'],
  },
  {
    slug: 'drift-detection',
    title: 'Drift Detection',
    category: 'Signal',
    summary: 'A gentle notice that a relational rhythm has changed.',
    body: `Drift Detection is CROS's way of noticing when something has gone quiet. It does not trigger alarms or create urgency. It simply surfaces the observation: "You haven't recorded a visit with the Rodriguez family in six weeks."

The power of drift detection is in its gentleness. It trusts the shepherd to interpret the signal. Maybe the family is traveling. Maybe the relationship has naturally concluded. Maybe it's time to reach out. The system doesn't decide — it invites reflection.

Drift detection operates across journeys, visits, and reflection patterns. It is available in CROS Insight and higher tiers.`,
    related: ['presence-signal', 'journey-chapter', 'shepherd-role'],
    appearsIn: ['/nri'],
  },
  {
    slug: 'momentum-signal',
    title: 'Momentum Signal',
    category: 'Signal',
    summary: 'A pattern of growing engagement across a metro or archetype.',
    body: `Momentum Signals indicate that something is building — new partnerships forming, visit frequency increasing, or volunteer engagement rising across a geographic area. Unlike urgency metrics, momentum signals are observed over weeks, not hours.

In the public Signals page, momentum data is anonymized and aggregated across the entire ecosystem. No individual organization is identified. The signal simply witnesses: "Three metros are showing renewed momentum this month."

Momentum is not a target. It is a tide to be noticed and honored.`,
    related: ['presence-signal', 'civitas', 'mission-archetype'],
    appearsIn: ['/signals', '/mission-atlas'],
  },

  // ── Practices ──
  {
    slug: 'reflection',
    title: 'Reflection',
    category: 'Practice',
    summary: 'A written moment of awareness about a relationship or encounter.',
    body: `Reflections are the sacred currency of CROS. They are brief written notes — not CRM activity logs, not task updates — but genuine moments of human noticing. "She seemed hopeful today." "He asked about the job fair for the first time." "The family brought cookies to the office."

Reflections are private by default. They belong to the person who wrote them. They are never shared with donors, never aggregated for board reports, never used for performance evaluation. They exist to help the writer remember what matters.

Over time, reflections become the raw material of NRI — the narrative layer that turns data into story, and story into wisdom.`,
    related: ['narrative-relational-intelligence', 'shepherd-role', 'impulsus'],
    appearsIn: ['/nri', '/testimonium-feature'],
  },
  {
    slug: 'journey-chapter',
    title: 'Journey Chapter',
    category: 'Practice',
    summary: 'A named stage in someone\'s relational journey with your organization.',
    body: `Journey Chapters replace the traditional CRM pipeline. Instead of "Lead → Qualified → Won/Lost," CROS uses stages that honor the human story: "First Encounter," "Growing Trust," "Active Partnership," "Quiet Season," "Renewed Connection."

Each Mission Archetype comes with default journey stages that reflect its unique vocabulary. A church might use "Inquiry → Welcome → Formation → Commitment." A workforce program might use "Intake → Training → Placement → Retention."

Journey chapters are not linear. People move backward, sideways, and in circles. CROS honors that complexity rather than forcing it into a funnel.`,
    related: ['mission-archetype', 'drift-detection', 'shepherd-role'],
    appearsIn: ['/archetypes'],
  },

  // ── Modules ──
  {
    slug: 'testimonium',
    title: 'Testimonium',
    category: 'Module',
    summary: 'The narrative storytelling and insight layer.',
    body: `Testimonium is CROS's narrative telemetry system — a way of witnessing the stories that emerge from relationship work without reducing them to analytics. It aggregates patterns across reflections, visits, events, and journey movements to generate narrative summaries.

These summaries are never comparative. They never say "you're doing better than last month." Instead, they offer observations: "Reflection activity has been centered on themes of reconciliation and follow-up this week."

Testimonium serves both the organization and the public ecosystem. Anonymized, aggregated signals from Testimonium feed the public Signals page and Living Archetype stories.`,
    related: ['narrative-relational-intelligence', 'reflection', 'presence-signal'],
    appearsIn: ['/testimonium-feature', '/signals'],
  },
  {
    slug: 'impulsus',
    title: 'Impulsus',
    category: 'Module',
    summary: 'A private impact scrapbook journal.',
    body: `Impulsus is the private journal layer of CROS — a space where individuals can capture moments of impact that don't fit into formal reporting. A photo from a community meal. A voice note after a difficult home visit. A sketch of an idea for next month's outreach.

Impulsus entries are never shared by default. They are not aggregated, not analyzed, not included in any organizational report. They exist solely for the person who created them — a private witness to the work they do.

Impulsus is available in CROS Story tier and above.`,
    related: ['reflection', 'visitor-role', 'shepherd-role'],
    appearsIn: ['/impulsus'],
  },
  {
    slug: 'civitas',
    title: 'Civitas',
    category: 'Module',
    summary: 'The community layer — metros, local pulse, and narrative awareness.',
    body: `Civitas is the community awareness layer of CROS. It encompasses metro tracking, Local Pulse event discovery, and the Metro Narrative engine. Civitas helps organizations understand not just their own relationships but the broader community context in which those relationships exist.

What events are happening nearby? What civic shifts are underway? What narratives are emerging across the metro? Civitas surfaces these signals so that shepherds, companions, and visitors can show up informed and present.

Civitas data is never used for targeting or marketing. It exists to build awareness — the kind of knowing that makes presence meaningful.`,
    related: ['momentum-signal', 'mission-archetype', 'signum'],
    appearsIn: ['/archetypes'],
  },
  {
    slug: 'signum',
    title: 'Signum',
    category: 'Module',
    summary: 'Signals and discovery intelligence.',
    body: `Signum is the discovery intelligence layer of CROS. It helps organizations find new connections — potential partners, community events, grant opportunities, and volunteer prospects — through signal-based awareness rather than aggressive prospecting.

Signum does not scrape or cold-outreach. It surfaces opportunities that align with an organization's mission archetype and existing relationship patterns. Think of it as a gentle radar, not a lead generation engine.

Discovery in CROS is always relational. Signum ensures that new connections begin with context, not cold contact.`,
    related: ['civitas', 'steward-role', 'momentum-signal'],
    appearsIn: ['/signum'],
  },
  {
    slug: 'provisio',
    title: 'Prōvīsiō',
    category: 'Module',
    summary: 'Technology provisions for communities.',
    body: `Prōvīsiō is the internal technology request system within CROS. When an organization needs a new device deployed, a software license provisioned, or a technical resource allocated, Prōvīsiō manages the request lifecycle.

For digital inclusion nonprofits, Prōvīsiō tracks device distribution. For education programs, it manages laptop lending libraries. For churches, it might coordinate AV equipment for community events.

Prōvīsiō ensures that technology serves people — not the other way around.`,
    related: ['steward-role', 'companion-role', 'mission-archetype'],
    appearsIn: ['/provisio'],
  },
  {
    slug: 'voluntarium',
    title: 'Voluntārium',
    category: 'Module',
    summary: 'Volunteer coordination and presence tracking.',
    body: `Voluntārium is CROS's volunteer management layer — designed not for shift scheduling but for presence coordination. It tracks who showed up, what they noticed, and how their service connects to the broader relational story.

Volunteers in CROS are first-class citizens, not afterthoughts. Their reflections, visit notes, and event participation contribute to the organization's NRI just as meaningfully as staff entries.

Voluntārium includes hours logging, skill matching, and community story contribution — all in service of making volunteer presence visible and valued.`,
    related: ['companion-role', 'presence-signal', 'reflection'],
    appearsIn: ['/voluntarium'],
  },
  {
    slug: 'relatio',
    title: 'Relatio',
    category: 'Module',
    summary: 'Integration and migration bridges.',
    body: `Relatio is the integration layer of CROS — the bridge between existing systems and the narrative-first world of CROS. It handles CRM migrations, email campaign connections, and data synchronization with external tools.

Relatio exists because organizations don't start from scratch. They carry histories — donor databases, volunteer spreadsheets, parish management systems. Relatio honors that history by providing migration pathways that preserve relationships rather than flattening them into rows.

Relatio is available in the CROS Bridge tier.`,
    related: ['steward-role', 'mission-archetype', 'communal-relationship-operating-system'],
    appearsIn: ['/relatio-campaigns'],
  },
  {
    slug: 'communio',
    title: 'Communio',
    category: 'Module',
    summary: 'Cross-organization narrative sharing with privacy governance.',
    body: `Communio enables organizations with shared mission contexts to collaborate — sharing anonymized signals, event discoveries, and narrative patterns without exposing private data.

A group of parishes in the same diocese might share Local Pulse events. A network of workforce programs might share momentum signals. Communio governs what is shared, who sees it, and ensures that privacy remains paramount.

Communio is built on consent: organizations choose their sharing level, and governance flags ensure no data leaves without explicit approval.`,
    related: ['civitas', 'presence-signal', 'mission-archetype'],
    appearsIn: ['/communio-feature'],
  },
];

/** Get a lexicon entry by slug. */
export function getLexiconEntry(slug: string): LexiconEntry | undefined {
  return CROS_LEXICON.find((e) => e.slug === slug);
}

/** Get entries by category. */
export function getLexiconByCategory(category: LexiconCategory): LexiconEntry[] {
  return CROS_LEXICON.filter((e) => e.category === category);
}

/** Get all unique categories in order. */
export function getLexiconCategories(): LexiconCategory[] {
  const cats = [...new Set(CROS_LEXICON.map((e) => e.category))];
  return cats.sort((a, b) => CATEGORY_ORDER[a] - CATEGORY_ORDER[b]);
}

/** Get related entries for a given entry. */
export function getRelatedLexiconEntries(slug: string, max = 4): LexiconEntry[] {
  const entry = getLexiconEntry(slug);
  if (!entry) return [];
  return entry.related
    .map((r) => CROS_LEXICON.find((e) => e.slug === r))
    .filter(Boolean)
    .slice(0, max) as LexiconEntry[];
}
