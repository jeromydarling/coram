/**
 * compassGuide — Contextual guide content for new user onboarding.
 *
 * WHAT: Maps route patterns to friendly explanations of each section.
 * WHERE: CompassGuideCard renders the matched guide when Compass opens.
 * WHY: New users feel overwhelmed by terminology and feature density.
 *      The Compass gently explains what they're looking at during first sessions.
 */

export interface GuideEntry {
  /** Section display name */
  title: string;
  /** One-sentence explanation of what this page shows */
  what: string;
  /** Why this section matters to their mission */
  why: string;
  /** What they can expect to find or do here */
  expect: string;
  /** Key terms they might not know yet */
  terms?: { word: string; meaning: string }[];
}

/**
 * Route pattern → Guide entry.
 * Patterns are matched top-to-bottom; first match wins.
 * Use :param for dynamic segments.
 * Covers every tenant-accessible section from appSections.ts.
 */
export const COMPASS_GUIDE_MAP: { pattern: string; guide: GuideEntry }[] = [
  // ── Home / Dashboard ──────────────────────────────────
  {
    pattern: '/',
    guide: {
      title: 'Your Command Center',
      what: 'This is your daily home — a calm overview of what matters right now.',
      why: 'Instead of a cluttered inbox, CROS shows you the signals and relationships that need gentle attention today.',
      expect: 'You\'ll see recent activity, relationship signals, and suggestions from your Companion. Nothing here is urgent — it\'s awareness, not pressure.',
      terms: [
        { word: 'Companion', meaning: 'The CROS assistant that notices patterns and offers gentle suggestions.' },
        { word: 'Signals', meaning: 'Quiet observations about your relationships and community — not alerts.' },
      ],
    },
  },
  {
    pattern: '/dashboard',
    guide: {
      title: 'Your Command Center',
      what: 'This is your daily home — a calm overview of what matters right now.',
      why: 'Instead of a cluttered inbox, CROS shows you the signals and relationships that need gentle attention today.',
      expect: 'You\'ll see recent activity, relationship signals, and suggestions from your Companion. Nothing here is urgent — it\'s awareness, not pressure.',
      terms: [
        { word: 'Companion', meaning: 'The CROS assistant that notices patterns and offers gentle suggestions.' },
        { word: 'Signals', meaning: 'Quiet observations about your relationships and community — not alerts.' },
      ],
    },
  },

  // ── Movement Intelligence ─────────────────────────────
  {
    pattern: '/intelligence',
    guide: {
      title: 'Movement Intelligence',
      what: 'This page shows how care, presence, and relationships are flowing across your territory.',
      why: 'It helps you see the bigger picture — not through charts and KPIs, but through the rhythm of your work.',
      expect: 'You\'ll see care patterns, relationship movement, and territory vitality. Think of it as a weather report for your mission.',
      terms: [
        { word: 'Territory', meaning: 'The geographic area where your organization serves — a metro, county, or region.' },
        { word: 'Vitality', meaning: 'A sense of how active and healthy your community engagement is.' },
      ],
    },
  },

  // ── Metros / Territories ──────────────────────────────
  {
    pattern: '/metros',
    guide: {
      title: 'Territories',
      what: 'The geographic areas where your organization serves.',
      why: 'CROS organizes your work by place — because community is local.',
      expect: 'You\'ll see your activated territories, local signals, and community pulse data.',
      terms: [
        { word: 'Metro', meaning: 'A metropolitan area or region where you operate.' },
        { word: 'Local Pulse', meaning: 'Community signals — news, events, and changes happening in your area.' },
      ],
    },
  },
  {
    pattern: '/metros/:metroId',
    guide: {
      title: 'Territory Detail',
      what: 'An in-depth look at a single territory — its pulse, partners, and community signals.',
      why: 'Drilling into a territory lets you understand the local landscape and notice what\'s changing.',
      expect: 'Local news, events, partner activity in the area, and narrative threads specific to this region.',
    },
  },
  {
    pattern: '/metros/narratives',
    guide: {
      title: 'Territory Narratives',
      what: 'AI-assembled narrative summaries of what\'s happening in your territories.',
      why: 'Instead of scanning raw data, you get a story about what\'s moving in your community.',
      expect: 'Short narrative summaries by territory, highlighting trends, signals, and opportunities.',
      terms: [
        { word: 'Narrative', meaning: 'A human-readable story assembled from community signals, not a chart.' },
      ],
    },
  },

  // ── Intelligence Feed ─────────────────────────────────
  {
    pattern: '/intel-feed',
    guide: {
      title: 'Intelligence Feed',
      what: 'A prioritized daily summary of signals and new connections.',
      why: 'Instead of checking multiple places, the feed brings the most relevant signals to you.',
      expect: 'New partner suggestions, community events, and relationship signals — all in one calm stream.',
    },
  },

  // ── Momentum ──────────────────────────────────────────
  {
    pattern: '/momentum',
    guide: {
      title: 'Momentum Map',
      what: 'A geographic heat map showing where relationship energy is strongest.',
      why: 'Helps you see at a glance which territories are thriving and which might need attention.',
      expect: 'Color-coded map overlays showing activity density, partner growth, and engagement trends by area.',
      terms: [
        { word: 'Momentum', meaning: 'A measure of relationship energy — activity, growth, and deepening over time.' },
      ],
    },
  },
  {
    pattern: '/momentum-rankings',
    guide: {
      title: 'Momentum Rankings',
      what: 'Territories ranked by relationship momentum — who\'s growing, who\'s steady, who\'s quiet.',
      why: 'Gives you a narrative sense of which areas deserve celebration or gentle attention.',
      expect: 'A ranked list with momentum scores, trends, and context for each territory.',
    },
  },

  // ── Partners ──────────────────────────────────────────
  {
    pattern: '/opportunities',
    guide: {
      title: 'Partners (Opportunities)',
      what: 'These are the organizations and people you\'re building relationships with.',
      why: 'CROS calls them "Opportunities" because each one is a chance for mutual impact — not a sales lead.',
      expect: 'Browse your partners, see where each relationship stands in its journey, and add reflections.',
      terms: [
        { word: 'Journey', meaning: 'The stages a relationship moves through — from first contact to deep partnership.' },
        { word: 'Reflection', meaning: 'A private note about what you noticed, felt, or learned during an interaction.' },
      ],
    },
  },
  {
    pattern: '/opportunities/:id',
    guide: {
      title: 'Partner Detail',
      what: 'Everything about this partner — their journey, people, reflections, and activity history.',
      why: 'This is your relationship memory for one organization. It holds the full story.',
      expect: 'Journey stage, contacts, activity timeline, reflections, and linked events or provisions.',
    },
  },
  {
    pattern: '/pipeline',
    guide: {
      title: 'Journey View',
      what: 'A visual map of where each partnership stands in its relationship journey.',
      why: 'This helps you see the whole landscape at once — who\'s new, who\'s deepening, who might need attention.',
      expect: 'Partners grouped by stage. You can move them by updating their journey stage. It\'s a living map of trust.',
      terms: [
        { word: 'Stage', meaning: 'Where a relationship is right now — like Discovery, Active Partnership, or Sustained.' },
      ],
    },
  },
  {
    pattern: '/anchors',
    guide: {
      title: 'Anchors',
      what: 'Organizations that have reached sustained, deep partnership.',
      why: 'Anchors represent your most trusted and established relationships — the foundation of your work.',
      expect: 'See which partners have reached anchor status and their engagement patterns over time.',
      terms: [
        { word: 'Anchor', meaning: 'A partner who has moved into sustained, deep engagement — your bedrock relationships.' },
      ],
    },
  },
  {
    pattern: '/radar',
    guide: {
      title: 'Radar',
      what: 'Prioritized attention signals for your partner relationships.',
      why: 'Radar gently highlights which relationships might need your attention — without creating urgency.',
      expect: 'Partners ranked by relationship signals like recent activity, drift, and engagement patterns.',
      terms: [
        { word: 'Drift', meaning: 'When a relationship has been quiet for a while. Not a warning — just a gentle nudge to check in.' },
      ],
    },
  },

  // ── People ────────────────────────────────────────────
  {
    pattern: '/people',
    guide: {
      title: 'The People',
      what: 'Individual people you\'re building relationships with — contacts within partner organizations.',
      why: 'Relationships happen between people, not logos. This is where you remember who you\'ve talked to.',
      expect: 'Browse contacts, see their connection to partners, and find notes from past interactions.',
    },
  },
  {
    pattern: '/people/:slug',
    guide: {
      title: 'Person Detail',
      what: 'Everything CROS knows about this person — their story, interactions, and life events.',
      why: 'Remembering the whole person — not just their title — is what makes relational work meaningful.',
      expect: 'Contact info, linked organizations, activity timeline, reflections, and life events.',
      terms: [
        { word: 'Life Event', meaning: 'A meaningful moment in someone\'s life — a beginning, milestone, or transition.' },
      ],
    },
  },
  {
    pattern: '/people/find',
    guide: {
      title: 'Find People',
      what: 'Discover new contacts from public directories and community sources.',
      why: 'Helps you expand your relational network by finding relevant people in your territories.',
      expect: 'Search results from external sources, scored by relevance to your mission and archetype.',
    },
  },

  // ── Relationship Graph ────────────────────────────────
  {
    pattern: '/graph',
    guide: {
      title: 'Relationship Graph',
      what: 'A visual map showing how your organizations and people are connected.',
      why: 'Seeing the web of relationships reveals patterns you\'d never notice in a list.',
      expect: 'An interactive network diagram — nodes are organizations and people, lines are relationships.',
    },
  },

  // ── Scheduling ────────────────────────────────────────
  {
    pattern: '/calendar',
    guide: {
      title: 'Calendar',
      what: 'Your upcoming meetings, events, and scheduled activities.',
      why: 'Keeps your schedule visible alongside your relationship context.',
      expect: 'Events and meetings synced from your calendar, plus community events from your area.',
    },
  },
  {
    pattern: '/events',
    guide: {
      title: 'Events',
      what: 'Community events, outreach activities, and partner engagements.',
      why: 'Events are where relationships deepen. Tracking them helps you see patterns in community engagement.',
      expect: 'Create events, track attendance, and see which partners and people were involved.',
    },
  },
  {
    pattern: '/events/:slug',
    guide: {
      title: 'Event Detail',
      what: 'The full picture of a single event — who came, what happened, and what it meant.',
      why: 'Capturing the story of an event turns a calendar entry into relationship memory.',
      expect: 'Attendance, impact notes, linked partners and people, and reflections from the event.',
    },
  },
  {
    pattern: '/events/find',
    guide: {
      title: 'Find Events',
      what: 'Discover community events happening in your territories.',
      why: 'Shows you what\'s happening nearby so you can show up where your community gathers.',
      expect: 'Events from external sources scored by relevance to your mission and location.',
    },
  },
  {
    pattern: '/activities',
    guide: {
      title: 'Activities',
      what: 'A log of your interactions — calls, meetings, visits, emails, and notes.',
      why: 'This is your relationship memory. When you log an activity, CROS remembers it so you don\'t have to.',
      expect: 'Add new activities, see recent ones, and link them to partners or people.',
    },
  },
  {
    pattern: '/my-activity',
    guide: {
      title: 'My Activity',
      what: 'A personal summary of your recent contributions and engagement.',
      why: 'Helps you reflect on your own rhythm — how you\'ve been showing up for your community.',
      expect: 'Your recent activities, visits, reflections, and engagement patterns over time.',
    },
  },
  {
    pattern: '/projects',
    guide: {
      title: 'Projects (Good Work)',
      what: 'Community service projects your team is working on together.',
      why: 'Projects capture the good work your community does — and turn it into a living story of impact.',
      expect: 'Create projects, track progress, and link them to partners, volunteers, and events.',
    },
  },
  {
    pattern: '/projects/:projectId',
    guide: {
      title: 'Project Detail',
      what: 'The full story of a project — its goals, contributors, timeline, and outcomes.',
      why: 'Each project is a chapter in your community\'s story of impact.',
      expect: 'Tasks, contributors, linked events and partners, progress updates, and impact notes.',
    },
  },

  // ── Visits ────────────────────────────────────────────
  {
    pattern: '/visits',
    guide: {
      title: 'Visits',
      what: 'A simplified, mobile-first way to log field visits.',
      why: 'Companions and Visitors spend time in the field. This makes it easy to capture moments without paperwork.',
      expect: 'Log a visit with a quick note. It becomes part of the person\'s story.',
      terms: [
        { word: 'Visitor', meaning: 'A CROS role for people who do field work — showing up where life happens.' },
      ],
    },
  },

  // ── Outreach ──────────────────────────────────────────
  {
    pattern: '/campaigns',
    guide: {
      title: 'Relatio Campaigns',
      what: 'Build and send relationship-first email campaigns.',
      why: 'Unlike mass marketing, these campaigns are designed for genuine follow-up and care.',
      expect: 'Create campaigns, choose recipients, and track responses — all with a relational tone.',
      terms: [
        { word: 'Relatio', meaning: 'The CROS integration and outreach layer — from the Latin for "connection."' },
      ],
    },
  },

  // ── Grants ────────────────────────────────────────────
  {
    pattern: '/grants',
    guide: {
      title: 'Grants',
      what: 'Track funding opportunities from research through award.',
      why: 'Many community organizations depend on grants. This keeps your pipeline organized.',
      expect: 'Add grant opportunities, track deadlines, and link them to your partners and territories.',
    },
  },
  {
    pattern: '/grants/find',
    guide: {
      title: 'Find Grants',
      what: 'Discover grant opportunities relevant to your mission and territories.',
      why: 'Helps you find funding without endless searching — CROS scores grants by relevance to your archetype.',
      expect: 'Grant listings from external sources, filtered by your location and mission type.',
    },
  },

  // ── Volunteers ────────────────────────────────────────
  {
    pattern: '/volunteers',
    guide: {
      title: 'Voluntārium',
      what: 'Your volunteer management hub — tracking who shows up and how they serve.',
      why: 'Volunteers are the heart of community work. This helps you remember and recognize them.',
      expect: 'Add volunteers, log hours, see who\'s been active, and notice when someone goes quiet.',
      terms: [
        { word: 'Voluntārium', meaning: 'The CROS name for volunteer management — from the Latin for "willing service."' },
      ],
    },
  },

  // ── Provisions ────────────────────────────────────────
  {
    pattern: '/provisions',
    guide: {
      title: 'Prōvīsiō',
      what: 'Technology provision requests and order tracking.',
      why: 'If your organization distributes devices or tech resources, this tracks the full lifecycle.',
      expect: 'Create orders, track fulfillment, and see provision history by partner or person.',
      terms: [
        { word: 'Prōvīsiō', meaning: 'The CROS name for technology provisioning — from the Latin for "providing."' },
      ],
    },
  },

  // ── Testimonium ───────────────────────────────────────
  {
    pattern: '/testimonium',
    guide: {
      title: 'Testimonium',
      what: 'Narrative storytelling and impact insight — turning your relationship data into shareable stories.',
      why: 'Stakeholders need stories, not spreadsheets. Testimonium helps you tell the truth of your impact.',
      expect: 'AI-assisted reports that weave your reflections, activities, and signals into narrative form.',
      terms: [
        { word: 'Testimonium', meaning: 'The CROS storytelling layer — from the Latin for "testimony." It turns data into narrative.' },
      ],
    },
  },
  {
    pattern: '/testimonium/:id',
    guide: {
      title: 'Testimonium Report',
      what: 'A single narrative report — the full story of impact for a given period or territory.',
      why: 'Each report is a chapter in your organization\'s story, ready to share with funders or supporters.',
      expect: 'A structured narrative with themes, highlights, and supporting evidence from your activities and reflections.',
    },
  },

  // ── Narrative ─────────────────────────────────────────
  {
    pattern: '/story',
    guide: {
      title: 'Narrative Studio',
      what: 'A creative space for crafting and refining the stories of your mission.',
      why: 'Your work deserves to be told well. The studio helps you shape raw signals into meaningful narrative.',
      expect: 'Draft, edit, and export narrative content drawn from your relationship memory and signals.',
    },
  },
  {
    pattern: '/narrative-threads',
    guide: {
      title: 'Narrative Threads',
      what: 'Weekly story threads assembled from reflections, visits, and signals.',
      why: 'Instead of reviewing raw data, threads give you a narrative sense of what happened this week.',
      expect: 'Auto-generated story summaries you can review, edit, and share with your team.',
      terms: [
        { word: 'Thread', meaning: 'A story woven from multiple signals and reflections over a period of time.' },
      ],
    },
  },

  // ── Discovery (Signum) ────────────────────────────────
  {
    pattern: '/discovery',
    guide: {
      title: 'Discovery (Signum)',
      what: 'Territory-aware discovery — find partners, events, and grants in your area.',
      why: 'Signum helps you notice what\'s happening around you that\'s relevant to your mission.',
      expect: 'Discovered organizations, events, and funding opportunities scored by relevance to your archetype.',
      terms: [
        { word: 'Signum', meaning: 'The CROS discovery layer — from the Latin for "signal." It finds relevant things in your area.' },
        { word: 'Archetype', meaning: 'Your organization type — like Church, Digital Inclusion, or Workforce Development. It shapes how CROS works for you.' },
      ],
    },
  },

  // ── Communio ──────────────────────────────────────────
  {
    pattern: '/communio',
    guide: {
      title: 'Communio',
      what: 'An opt-in network where CROS workspaces can share anonymized patterns.',
      why: 'When multiple organizations serve the same community, shared awareness strengthens everyone.',
      expect: 'See anonymized signals from other organizations in your area. Your private data is never shared.',
      terms: [
        { word: 'Communio', meaning: 'The CROS shared network — from the Latin for "communion." Participation is always opt-in.' },
      ],
    },
  },

  // ── Relatio (Integrations) ────────────────────────────
  {
    pattern: '/relatio',
    guide: {
      title: 'Relatio Marketplace',
      what: 'Connect CROS to your existing tools — CRMs, calendars, and data sources.',
      why: 'Your organization already uses other systems. Relatio bridges them into CROS without replacing them.',
      expect: 'Browse available connectors, set up integrations, and import data from external platforms.',
      terms: [
        { word: 'Relatio', meaning: 'The CROS integration bridge — from the Latin for "connection."' },
        { word: 'Connector', meaning: 'A pre-built bridge to an external tool like Salesforce, HubSpot, or Google Calendar.' },
      ],
    },
  },

  // ── Import ────────────────────────────────────────────
  {
    pattern: '/import',
    guide: {
      title: 'Import Center',
      what: 'Bring your existing data into CROS — partners, contacts, activities, and more.',
      why: 'Starting fresh is hard. The import center lets you carry your history forward.',
      expect: 'Upload CSV files, map columns to CROS fields, and preview before committing.',
    },
  },

  // ── Reports ───────────────────────────────────────────
  {
    pattern: '/reports',
    guide: {
      title: 'Reports',
      what: 'Custom reports, narrative exports, and scheduled delivery.',
      why: 'Turn your relationship data into stories you can share with stakeholders.',
      expect: 'Generate reports by territory, partner, or time period. Export as narrative or data.',
    },
  },
  {
    pattern: '/reports/impact-export',
    guide: {
      title: 'Impact Export',
      what: 'Executive-ready impact reports with structured metrics and narrative summaries.',
      why: 'When a funder or board asks "what have you accomplished?" — this is your answer.',
      expect: 'Polished export documents combining your impact dimensions, activities, and reflections.',
    },
  },

  // ── Playbooks ─────────────────────────────────────────
  {
    pattern: '/playbooks',
    guide: {
      title: 'Playbooks',
      what: 'Reusable relationship guides and metro-specific procedures.',
      why: 'Playbooks capture your team\'s collective wisdom so new team members can follow established patterns.',
      expect: 'Browse and create step-by-step guides for common relationship-building scenarios.',
    },
  },

  // ── Settings ──────────────────────────────────────────
  {
    pattern: '/settings',
    guide: {
      title: 'Settings',
      what: 'Your profile, notifications, team management, and workspace preferences.',
      why: 'Customize CROS to fit your team\'s rhythm and needs.',
      expect: 'Update your profile, manage team members, configure integrations, and adjust notification preferences.',
    },
  },
  {
    pattern: '/settings/impact',
    guide: {
      title: 'Impact Dimensions',
      what: 'Configure the structured metrics your organization tracks for events, activities, and provisions.',
      why: 'Every mission measures impact differently. This lets you define what "impact" means for your work.',
      expect: 'Add, edit, and organize the categories and metrics that matter most to your organization.',
      terms: [
        { word: 'Impact Dimension', meaning: 'A measurable aspect of your work — like "people served" or "devices distributed."' },
      ],
    },
  },

  // ── Admin ─────────────────────────────────────────────
  {
    pattern: '/admin',
    guide: {
      title: 'Workspace Admin',
      what: 'Administrative tools for managing your CROS workspace — team, roles, and configuration.',
      why: 'Stewards and Shepherds use this to keep the workspace healthy and well-organized.',
      expect: 'Team management, role assignments, workspace settings, and activation status.',
      terms: [
        { word: 'Steward', meaning: 'The highest team role — responsible for workspace configuration and team leadership.' },
        { word: 'Shepherd', meaning: 'A leadership role focused on relationship building and team guidance.' },
      ],
    },
  },
  {
    pattern: '/admin/activation',
    guide: {
      title: 'Guided Activation',
      what: 'A structured checklist to help your organization get fully set up in CROS.',
      why: 'There\'s a lot to configure. Activation walks you through it step by step so nothing gets missed.',
      expect: 'A checklist of setup tasks organized by category, with progress tracking and helpful guidance.',
    },
  },
  {
    pattern: '/admin/team',
    guide: {
      title: 'Team Management',
      what: 'Invite, manage, and assign roles to your team members.',
      why: 'The right people need the right access. Team management keeps your workspace secure and organized.',
      expect: 'See all team members, their roles, and invite new people to join your workspace.',
    },
  },

  // ── Help & Support ────────────────────────────────────
  {
    pattern: '/help',
    guide: {
      title: 'Help & Documentation',
      what: 'Guides, documentation, and support for every part of CROS.',
      why: 'When you need to understand something deeper, the help center has detailed explanations.',
      expect: 'Searchable documentation organized by section, plus the changelog and quick-start guides.',
    },
  },
  {
    pattern: '/help/adoption',
    guide: {
      title: 'Adoption & Daily Rhythm',
      what: 'A formation space for building your team\'s daily rhythm with CROS.',
      why: 'Adoption isn\'t about training — it\'s about forming habits that serve your mission.',
      expect: 'Role-specific guidance, daily rhythm suggestions, and tips for making CROS part of your workflow.',
    },
  },
  {
    pattern: '/feedback',
    guide: {
      title: 'Feedback & Help Requests',
      what: 'Share feedback, report issues, or request features.',
      why: 'CROS grows through the wisdom of its community. Your voice shapes what comes next.',
      expect: 'Submit a request, describe what you need, and track the status of previous submissions.',
    },
  },

  // ── Quick Add ─────────────────────────────────────────
  {
    pattern: '/quick-add',
    guide: {
      title: 'Quick Add',
      what: 'A fast way to log a new partner, contact, activity, or event without navigating away.',
      why: 'When you\'re in the field or on a call, Quick Add lets you capture the moment instantly.',
      expect: 'Choose what you want to add, fill in the essentials, and get back to your day.',
    },
  },
];

/**
 * Match a route path to a guide entry.
 * Strips tenant slug prefix (/:tenantSlug/) before matching.
 */
export function matchGuide(pathname: string): GuideEntry | null {
  // Strip tenant slug prefix: /abc-org/dashboard → /dashboard
  const segments = pathname.split('/').filter(Boolean);
  const knownPrefixes = ['operator', 'login', 'signup', 'onboarding', 'archetypes', 'roles', 'pricing'];
  let normalizedPath = pathname;
  if (segments.length >= 2 && !knownPrefixes.includes(segments[0])) {
    normalizedPath = '/' + segments.slice(1).join('/');
  }
  // Also handle bare tenant slug (e.g. /abc-org → /)
  if (segments.length === 1 && !knownPrefixes.includes(segments[0])) {
    normalizedPath = '/';
  }

  for (const entry of COMPASS_GUIDE_MAP) {
    const patternParts = entry.pattern.split('/').filter(Boolean);
    const pathParts = normalizedPath.split('/').filter(Boolean);

    // Handle root route
    if (patternParts.length === 0 && pathParts.length === 0) return entry.guide;

    if (patternParts.length !== pathParts.length) continue;

    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) continue;
      if (patternParts[i] !== pathParts[i]) { match = false; break; }
    }
    if (match) return entry.guide;
  }
  return null;
}
