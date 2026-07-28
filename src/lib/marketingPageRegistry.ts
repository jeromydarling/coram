/**
 * marketingPageRegistry — Single source of truth for all public marketing pages.
 *
 * WHAT: Central registry that catalogues every marketing page with metadata.
 * WHERE: Consumed by OperatorSeoPage, sitemap generator, and future audit tools.
 * WHY: When a new page is added (archetype, calling, atlas entry), it automatically
 *       appears in the Gardener SEO console without manual hardcoding.
 *
 * CONTENT SOURCES: This registry dynamically pulls from:
 *   - src/content/missionAtlas.ts (atlas entries)
 *   - CallingPage callingContent (calling themes)
 *   - RolePathwayPage roleContent (role pathways)
 *   - Archetype week pages (static list + dynamic archetypes)
 *   - Lexicon terms, Library concepts, Field Journal entries
 */

import { MISSION_ATLAS, getArchetypeDisplay, getMetroTypeDisplay } from '@/content/missionAtlas';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketingPageEntry {
  label: string;
  path: string;
  description: string;
  /** Whether this entry was auto-generated from a content source */
  dynamic?: boolean;
}

export interface SeoPhase {
  id: string;
  phase: string;
  title: string;
  description: string;
  purpose: string;
  icon: string; // lucide icon name — resolved in the component
  status: 'complete' | 'in-progress' | 'planned';
  pages: MarketingPageEntry[];
}

/* ------------------------------------------------------------------ */
/*  Dynamic content sources                                            */
/* ------------------------------------------------------------------ */

/** Role pathway slugs — from RolePathwayPage */
const ROLE_PATHWAY_SLUGS = ['shepherd', 'companion', 'steward', 'visitor'] as const;

/** Calling theme slugs — from CallingPage */
const CALLING_SLUGS = ['home-visitation', 'parish-outreach', 'community-support'] as const;

/** Archetype week pages — manually maintained until we have a content registry */
const ARCHETYPE_WEEK_PAGES: MarketingPageEntry[] = [
  { label: 'Church Week', path: '/archetypes/church-week', description: 'A 7-day story: what a week inside CROS looks like for a church. Mon–Sun narrative with voice notes, visits, and Sunday rhythm.' },
  { label: 'Nonprofit Week', path: '/archetypes/nonprofit-week', description: 'A 7-day story: digital inclusion nonprofit using CROS. Visits, voice notes, partner engagement, board narrative.' },
  { label: 'Social Enterprise Week', path: '/archetypes/social-enterprise-week', description: 'A 7-day story: purpose-driven business tracking social impact alongside revenue relationships.' },
  { label: 'Community Network Week', path: '/archetypes/community-network-week', description: 'A 7-day story: community coalition coordinating across multiple organizations and shared geography.' },
  { label: 'Ministry Outreach Week', path: '/archetypes/ministry-outreach-week', description: 'A 7-day story: parish or ministry team using CROS for pastoral care, home visits, and small groups.' },
];

/** Generate Mission Atlas detail pages dynamically from content */
function buildAtlasPages(): MarketingPageEntry[] {
  return MISSION_ATLAS.map((entry) => ({
    label: `${getArchetypeDisplay(entry.archetype)} — ${getMetroTypeDisplay(entry.metroType)}`,
    path: `/mission-atlas/${entry.id}`,
    description: `Narrative authority page: how ${getArchetypeDisplay(entry.archetype).toLowerCase()} organizations serve in ${getMetroTypeDisplay(entry.metroType).toLowerCase()} contexts. Themes: ${entry.themes.slice(0, 3).join(', ')}.`,
    dynamic: true,
  }));
}

/** Generate Pathway pages dynamically from known roles */
function buildPathwayPages(): MarketingPageEntry[] {
  const roleLabels: Record<string, string> = {
    shepherd: 'Shepherd — "You hold the longer story." Identity-first funnel for mission leaders and executive directors.',
    companion: 'Companion — "You keep the thread." Identity-first funnel for field staff and relationship keepers.',
    steward: 'Steward — "You keep the systems running." Identity-first funnel for operations and admin leaders.',
    visitor: 'Visitor — "You go where the people are." Identity-first funnel for mobile field workers.',
  };
  return ROLE_PATHWAY_SLUGS.map((slug) => ({
    label: `Pathway: ${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
    path: `/path/${slug}`,
    description: roleLabels[slug] || `Role pathway for ${slug}.`,
    dynamic: true,
  }));
}

/** Generate Calling pages dynamically from known themes */
function buildCallingPages(): MarketingPageEntry[] {
  const callingLabels: Record<string, string> = {
    'home-visitation': 'Home Visitation — The ministry of presence. Targets "home visitation software" and "field visit tools" search queries.',
    'parish-outreach': 'Parish Outreach — Reaching beyond the walls. Targets "parish outreach tools" and "church community engagement" queries.',
    'community-support': 'Community Support — Sustaining the daily work of caring. Targets "community support software" and "social services tools" queries.',
  };
  return CALLING_SLUGS.map((slug) => ({
    label: `Calling: ${slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
    path: `/calling/${slug}`,
    description: callingLabels[slug] || `Mission calling page for ${slug}.`,
    dynamic: true,
  }));
}

/* ------------------------------------------------------------------ */
/*  Phase definitions                                                  */
/* ------------------------------------------------------------------ */

export function buildSeoPhases(): SeoPhase[] {
  return [
    {
      id: 'p1',
      phase: 'Phase 1',
      title: 'Foundation & Identity',
      description: 'Core marketing pages, manifesto, SEO metadata engine, and brand identity.',
      purpose: 'Establishes CROS™ as a distinct category — not another CRM. These pages define the brand story, mission positioning, and trust signals that every other page links back to. All pages are static, hand-curated editorial content.',
      icon: 'Globe',
      status: 'complete',
      pages: [
        { label: 'Homepage', path: '/', description: 'Primary landing page with manifesto hero, archetype signals, and conversion pathways.' },
        { label: 'Manifesto', path: '/manifesto', description: 'The founding narrative — why CROS exists. Long-form editorial positioning that establishes brand philosophy and voice.' },
        { label: 'CROS™ Feature', path: '/cros', description: 'What CROS is — the relationship operating system overview. Explains Civitas, NRI, and the Latin module structure.' },
        { label: 'NRI™ (Neary)', path: '/nri', description: 'Narrative Relational Intelligence explained — how CROS uses human-first signals instead of traditional AI analytics.' },
        { label: 'Profunda™ Origin', path: '/profunda', description: 'The founding story — how Profunda became CROS. Builds emotional trust and shows authentic evolution.' },
        { label: 'Pricing', path: '/pricing', description: 'Tier breakdown: Core, Insight, Story, Bridge. Includes stack comparison table and Founding Garden program.' },
        { label: 'Contact', path: '/contact', description: 'Inquiry form for prospective organizations. Captures archetype interest signals for Gardener visibility.' },
        { label: 'Security', path: '/security', description: 'Data boundaries, row-level security, privacy commitments, and HIPAA-awareness positioning.' },
      ],
    },
    {
      id: 'p2',
      phase: 'Phase 2',
      title: 'Feature Pages & Modules',
      description: 'Dedicated pages for each Latin-named CROS module.',
      purpose: 'Each module gets its own narrative page explaining what it does, who it serves, and why it matters — without feature-list jargon. These pages target long-tail search queries for relationship management, volunteer coordination, and community signals.',
      icon: 'Layers',
      status: 'complete',
      pages: [
        { label: 'Features Overview', path: '/features', description: 'Unified feature map connecting all CROS modules. Entry point for visitors exploring the full platform.' },
        { label: 'Signum', path: '/signum', description: 'Discovery & signal intelligence — how CROS surfaces community events, partner movements, and local pulse without manual searching.' },
        { label: 'Testimonium', path: '/testimonium-feature', description: 'Narrative storytelling & insight layer — transforms daily field observations into board-ready stories and anonymized public signals.' },
        { label: 'Communio', path: '/communio-feature', description: 'Inter-org collaboration network — how organizations share anonymized signals and form Familia groups without exposing private data.' },
        { label: 'Impulsus', path: '/impulsus', description: 'Private impact scrapbook journal — personal, sacred space for leaders to capture observations that never feed metrics.' },
        { label: 'Voluntārium', path: '/voluntarium', description: 'Volunteer management with availability tracking, role assignments, and gentle scheduling rhythms.' },
        { label: 'Prōvīsiō', path: '/provisio', description: 'Technology provisions & internal resource requests — how teams request tools, training, and infrastructure support.' },
        { label: 'Relatio Campaigns', path: '/relatio-campaigns', description: 'Email campaign orchestration — relationship-centered outreach powered by Gmail integration and contact journey context.' },
        { label: 'Integrations', path: '/integrations', description: 'CRM bridge page — HubSpot, Salesforce, Dynamics 365 two-way sync via Relatio™. Explains migration pathways for organizations leaving traditional CRMs.' },
      ],
    },
    {
      id: 'p3',
      phase: 'Phase 3',
      title: 'Roles & Archetypes',
      description: 'Role-based identity pages and archetype week-in-the-life narratives.',
      purpose: 'Visitors arrive with different identities: pastor, field worker, executive director, volunteer coordinator. These pages help them recognize themselves in the system before signing up. The "Week Inside CROS" stories show realistic daily rhythms rather than feature lists.',
      icon: 'Users',
      status: 'complete',
      pages: [
        { label: 'Roles Index', path: '/roles', description: 'Overview of all CROS roles — Shepherd, Companion, Visitor, Steward. Entry point for identity-based discovery.' },
        { label: 'Shepherd', path: '/roles/shepherd', description: 'The Regional Impact Manager role — those who hold the longer story and carry the mission across relationships.' },
        { label: 'Companion', path: '/roles/companion', description: 'The daily relationship keeper — staff who follow up, remember details, and maintain connection threads.' },
        { label: 'Visitor', path: '/roles/visitor', description: 'The mobile-first field worker — those who go where the people are, recording voice notes and site visits.' },
        { label: 'Steward', path: '/roles/steward', description: 'The operations & admin role — those who keep systems clean, data accurate, and teams equipped.' },
        { label: 'Role Guides', path: '/roles/:role/:guideSlug', description: 'Deep-dive practical guides per role — "How a Shepherd uses reflections" or "Steward data hygiene tips."' },
        { label: 'Role Stories', path: '/stories/roles/:slug', description: 'Narrative vignettes showing each role in action — story-first content that builds emotional connection.' },
        { label: 'Archetypes Index', path: '/archetypes', description: 'Mission archetype selector — Church, Nonprofit, Social Enterprise, Community Network, Ministry Outreach, Companion.' },
        ...ARCHETYPE_WEEK_PAGES,
        { label: 'Archetype Deep Pages', path: '/archetypes/:slug/deep', description: 'Extended archetype profiles — deeper narrative content for each organization type with FAQ and journey mapping.' },
        { label: 'For Companions', path: '/for-companions', description: 'Dedicated landing for Companion archetypes — Solo and Organization modes with privacy-first positioning.' },
        { label: 'Companion Guide', path: '/help/companions', description: 'Practical help guide for companions — mentors, sponsors, caregivers, and those who walk closely with others.' },
      ],
    },
    {
      id: 'p4',
      phase: 'Phase 4',
      title: 'Comparison, Proof & Persuasion',
      description: 'Competitive comparisons, social proof, case studies, and narrative persuasion pages.',
      purpose: 'These pages address the "why not just use Salesforce?" objection. They build trust through story-first evidence, human case studies, and gentle comparison — never attack-style competitive pages.',
      icon: 'Scale',
      status: 'complete',
      pages: [
        { label: 'Compare Index', path: '/compare', description: 'CROS vs traditional CRMs overview — positions CROS as a relationship system, not a sales pipeline.' },
        { label: 'Compare Archetype', path: '/compare/:slug', description: 'Archetype-specific comparisons — "Church using CROS vs Church using a donor CRM." Tailored to each mission context.' },
        { label: 'CROS vs Bloomerang', path: '/compare/cros-vs-bloomerang', description: 'Donor CRM vs Relationship Operating System — architectural comparison for nonprofits choosing between fundraising infrastructure and relational continuity.' },
        { label: 'CROS vs Salesforce', path: '/compare/cros-vs-salesforce', description: 'Enterprise CRM vs Relational OS — when to use Salesforce for scale and CROS for presence.' },
        { label: 'CROS vs HubSpot', path: '/compare/cros-vs-hubspot', description: 'Marketing CRM vs Relational OS — campaign automation compared to relationship memory.' },
        { label: 'CROS Mission Layer', path: '/compare/cros-mission-layer-crm', description: 'The relational intelligence layer above your existing CRM — works with Salesforce, Bloomerang, HubSpot, and more.' },
        { label: 'Proof', path: '/proof', description: 'Evidence and social proof page — testimonials, usage signals, and trust indicators.' },
        { label: 'Our Story', path: '/case-study-humanity', description: 'Universal humanity case study — the founding story told through the lens of real community impact.' },
        { label: 'Relational Fundraising', path: '/fundraising-without-a-donor-crm', description: 'SEO article targeting "fundraising without a donor CRM" — long-form narrative positioning CROS for orgs avoiding donor management systems.' },
        { label: 'See People', path: '/see-people', description: 'Emotional landing page — "What if your system saw people, not records?" Manifesto-style conversion page.' },
        { label: 'Imagine This', path: '/imagine-this', description: 'Scenario-based storytelling — three mission contexts (social work, nonprofit leadership, ministry) showing daily life with CROS.' },
      ],
    },
    {
      id: 'p5',
      phase: 'Phase 5',
      title: 'Lexicon & Library',
      description: 'Civic ontology terms, concept graph, and language authority.',
      purpose: 'CROS defines its own vocabulary — "relationship memory," "narrative intelligence," "communal stewardship." These pages establish CROS as the canonical source for this civic ontology, generating schema.org DefinedTerm markup that search engines treat as authoritative definitions.',
      icon: 'BookOpen',
      status: 'complete',
      pages: [
        { label: 'Lexicon Index', path: '/lexicon', description: 'All defined terms in the CROS vocabulary — each generates a schema.org DefinedTerm with cross-links to related concepts.' },
        { label: 'Lexicon Term', path: '/lexicon/:slug', description: 'Individual term page — full definition, related terms, usage context, and JSON-LD structured data.' },
        { label: 'Library Index', path: '/library', description: 'Calm discovery space connecting roles, archetypes, week stories, philosophy, and concepts into a browsable knowledge hub.' },
        { label: 'Library Concept', path: '/library/:conceptSlug', description: 'Deep concept pages — each explores a CROS principle with narrative depth, related terms, and cross-links.' },
      ],
    },
    {
      id: 'p6',
      phase: 'Phase 6',
      title: 'Field Journal, Stories & Essays',
      description: 'Role-based narratives, insight articles, field journal entries, and the living essay library.',
      purpose: 'Content marketing through narrative authority — not blog posts, but "field notes" and "insights" that feel like they come from practitioners. The Essay Library is operator-curated and can be seeded from platform activity via n8n workflows.',
      icon: 'Pen',
      status: 'complete',
      pages: [
        { label: 'Field Journal Index', path: '/field-journal', description: 'Role-based narrative entries — stories told from the perspective of Shepherds, Companions, Visitors, and Stewards in the field.' },
        { label: 'Field Journal Entry', path: '/field-journal/:slug', description: 'Individual field journal entry with full narrative, role attribution, and cross-links to related concepts.' },
        { label: 'Field Notes Library', path: '/field-notes-library', description: 'Curated collection of shorter field observations — quick reads organized by role and theme.' },
        { label: 'Insights Index', path: '/insights', description: 'Thought leadership articles — deeper explorations of relationship-centered work, community technology, and mission philosophy.' },
        { label: 'Insight Article', path: '/insights/:slug', description: 'Individual insight piece with FAQ schema, breadcrumbs, and semantic cross-linking.' },
        { label: 'Essays Index', path: '/essays', description: 'Living essay library — long-form pieces generated from platform signals and curated by the Gardener through the editorial pipeline.' },
        { label: 'Essay Page', path: '/essays/:slug', description: 'Individual essay with full narrative, author attribution, and article schema markup.' },
        { label: 'Reflections Index', path: '/reflections', description: 'Monthly reflection cycles — contemplative content organized by time period, connecting platform movement to narrative insight.' },
        { label: 'Stories', path: '/stories/:slug', description: 'Standalone narrative stories — community vignettes that illustrate CROS principles in practice.' },
        { label: 'Authority Hub', path: '/authority', description: 'Trust & authority signals hub — aggregates all content that establishes CROS as a credible voice in community technology.' },
        { label: 'Authority Category', path: '/authority/:category', description: 'Filtered authority views by topic — e.g., "Data Privacy in Community Work" or "Narrative vs. Analytics."' },
      ],
    },
    {
      id: 'p7',
      phase: 'Phase 7',
      title: 'Mission Atlas & Metro Narratives',
      description: 'Geographic narrative surfaces, metro authority pages, and archetype-metro combinations.',
      purpose: 'Creates geographic SEO authority — CROS becomes the canonical source for "how churches serve in urban metros" or "nonprofit community work in midsize cities." Uses schema.org/Place and curated narrative content. Metro pages can surface anonymized living signals when aggregation thresholds are met.',
      icon: 'Map',
      status: 'complete',
      pages: [
        { label: 'Mission Atlas Index', path: '/mission-atlas', description: 'Browsable map connecting archetypes to metro types — a "field journal" view of where mission work happens geographically.' },
        ...buildAtlasPages(),
        { label: 'Metro Public Page', path: '/metros/:metroSlug', description: 'Metro-level civic narrative — aggregated, anonymized community signals for a geographic area. Governed by safety guards.' },
        { label: 'Metro Archetype Cross', path: '/metros/:metroSlug/:archetypeSlug', description: 'Cross-referenced metro + archetype view — how a specific organization type engages within a specific geography.' },
      ],
    },
    {
      id: 'p8',
      phase: 'Phase 8',
      title: 'Pilgrim Pathways & Callings',
      description: 'Identity-first onboarding funnels that persist visitor context through cookies and archetype signals.',
      purpose: 'Instead of a generic signup flow, visitors enter through their identity (role) or their mission theme (calling). These pages capture visitor intent signals that persist across sessions, so when they eventually sign up, CROS already knows their context. This creates SEO authority for phrases like "home visitation software" or "digital inclusion tools."',
      icon: 'Radio',
      status: 'complete',
      pages: [
        ...buildPathwayPages(),
        ...buildCallingPages(),
      ],
    },
    {
      id: 'p9',
      phase: 'Phase 9',
      title: 'Network, Communio & Public Presence',
      description: 'Public-facing network directory, communio collaboration themes, tenant mirrors, and event pages.',
      purpose: 'These pages create an organic backlink network — each tenant can have a public mirror page, events get shareable public URLs, and the network directory lets organizations discover each other. All content is opt-in and privacy-safe.',
      icon: 'Users',
      status: 'complete',
      pages: [
        { label: 'Network Directory', path: '/network', description: 'Public communio directory — browsable index of organizations using CROS, filtered by archetype and metro.' },
        { label: 'Network Theme', path: '/network/:themeSlug', description: 'Themed network views — organizations grouped by collaboration theme (e.g., "housing," "education access").' },
        { label: 'Tenant Public Mirror', path: '/public/:tenantSlug', description: 'Optional public profile for CROS tenants — displays archetype, calling, metro, and narrative themes. Opt-in only.' },
        { label: 'Public Presence Page', path: '/p/:tenantSlug', description: 'Lightweight public presence — standalone page for organizations to share their CROS identity externally.' },
        { label: 'Public Event Page', path: '/events/:publicSlug', description: 'Shareable public event pages — community events with registration, location, and schema.org/Event markup.' },
        { label: 'Week Narrative (Generic)', path: '/week/:slug', description: 'Reusable week narrative template — shows "a week inside CROS" for any archetype using a shared layout.' },
      ],
    },
    {
      id: 'p10',
      phase: 'Phase 10',
      title: 'Legal & Compliance',
      description: 'Terms, privacy, DPA, acceptable use, and AI transparency pages.',
      purpose: 'Required trust infrastructure — these pages satisfy legal requirements while reinforcing CROS values. The AI Transparency page is particularly important for positioning NRI as human-first intelligence.',
      icon: 'FileText',
      status: 'complete',
      pages: [
        { label: 'Terms of Service', path: '/legal/terms', description: 'Platform terms of service — plain-language legal framework for CROS usage.' },
        { label: 'Privacy Policy', path: '/legal/privacy', description: 'Privacy commitments — data handling, retention, and user rights explained in accessible language.' },
        { label: 'Data Processing', path: '/legal/data-processing', description: 'Data Processing Agreement — GDPR-aligned DPA for organizations handling sensitive community data.' },
        { label: 'Acceptable Use', path: '/legal/acceptable-use', description: 'Acceptable use policy — boundaries for platform usage aligned with CROS values of dignity and privacy.' },
        { label: 'AI Transparency', path: '/legal/ai-transparency', description: 'How NRI uses AI — transparency about what AI does and doesn\'t do in CROS, reinforcing human-first principles.' },
      ],
    },
    {
      id: 'p11',
      phase: 'Phase 11',
      title: 'Technical SEO Infrastructure',
      description: 'Sitemap, JSON-LD schemas, internal link graph, concept graph, and semantic keyword clusters.',
      purpose: 'The invisible layer that makes everything else work for search engines. The sitemap auto-generates from routes, JSON-LD schemas are injected via SeoHead component, and the internal content graph (src/lib/contentGraph.ts) drives auto-linking and "Related Reading" cards across all narrative pages.',
      icon: 'Search',
      status: 'complete',
      pages: [
        { label: 'Sitemap XML', path: '/sitemap.xml', description: 'Auto-generated sitemap for crawlers — includes all public routes with priority and change frequency signals.' },
      ],
    },
  ];
}

/** Convenience: total page count across all phases */
export function getTotalPageCount(): number {
  return buildSeoPhases().reduce((sum, p) => sum + p.pages.length, 0);
}

/** Convenience: count of dynamic (auto-generated) pages */
export function getDynamicPageCount(): number {
  return buildSeoPhases().reduce(
    (sum, p) => sum + p.pages.filter((pg) => pg.dynamic).length,
    0
  );
}
