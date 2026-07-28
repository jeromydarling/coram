// Phase 7 brand narrative copy — feature pages
// HEAD (NRI) • HEART (CROS) • BODY (Profunda)

import sectionCrosJourneys from '@/assets/section-cros-journeys.png';
import sectionCrosLanguage from '@/assets/section-cros-language.png';
import sectionCrosMobile from '@/assets/section-cros-mobile.png';
import sectionImpulsusStory from '@/assets/section-impulsus-story.png';
import sectionTestimoniumDrift from '@/assets/section-testimonium-drift.png';
import sectionTestimoniumPatterns from '@/assets/section-testimonium-patterns.png';
import sectionTestimoniumHeatmap from '@/assets/screenshots/section-momentum-map.png';
import sectionCommunioSignals from '@/assets/section-communio-signals.png';
import sectionCommunioResonance from '@/assets/section-communio-resonance.png';
import sectionSignumTerritory from '@/assets/section-signum-territory.png';
import sectionSignumPulse from '@/assets/section-signum-pulse.png';
import sectionSignumMission from '@/assets/section-signum-mission.png';
import sectionVoluntariumReliability from '@/assets/section-voluntarium-reliability.png';
import sectionVoluntariumHours from '@/assets/section-voluntarium-hours.png';
import sectionVoluntariumLogging from '@/assets/section-voluntarium-logging.png';
import sectionProvisioRequest from '@/assets/section-provisio-request.png';
import sectionProvisioFulfillment from '@/assets/section-provisio-fulfillment.png';
import sectionProvisioStewardship from '@/assets/section-provisio-stewardship.png';

export const manifestoSection = {
  title: 'The Head. The Heart. The Body...and You.',
  intro: 'Technology has long focused on systems and intelligence.\n\nCROS™ brings them back to something human.',
  summary:
    'NRI™ helps you see the story.\nCROS™ helps you stay connected.\nProfunda™ helps you move forward.',
  columns: [
    {
      label: 'HEAD',
      name: 'NRI™',
      body: 'See the narrative behind your work. Understand momentum, drift, and connection without losing the human voice.',
      to: '/nri',
    },
    {
      label: 'HEART',
      name: 'CROS™',
      body: 'Hold relationships at the center. A system built around presence, trust, and shared growth.',
      to: '/cros',
    },
    {
      label: 'BODY',
      name: 'Profunda™',
      body: 'Where action lives. Events, reflections, provisions, volunteers, and real movement.',
      to: '/profunda',
    },
  ],
  cta: { label: 'Learn How It Works', to: '/cros' },
};

export const nriPage = {
  hero: 'The Intelligence That Begins With People',
  body: [
    'Narrative Relational Intelligence — or NRI™ — is the thinking layer of CROS™.',
    'It follows a simple rhythm: Recognize signals of care and change. Synthesize scattered information into coherent stories. Prioritize your attention toward the next faithful step.',
    'NRI™ does not replace human judgment. It strengthens it.',
    'AI handles pattern recognition, organization, speed, and memory — that\'s what machines are for. NRI grounds those capabilities in human relationships and lived experience.',
    'NRI™ watches how communities change:\n• who you meet\n• where you show up\n• what stories repeat\n• where energy grows or fades',
    'Instead of telling you what to do,\nNRI™ helps you see clearly.',
  ],
  features: [
    'Recognize — signals of care, movement, strain, restoration',
    'Synthesize — scattered notes into coherent narrative',
    'Prioritize — the next small, faithful step',
    'Compass — one calm place for suggestions',
  ],
  closing: "NRI™ doesn't automate relationships.\nIt helps you understand them.\n\nIt is private by default, bounded by design, and grounded in the principle that the person closest to the relationship holds the narrative.\n\nStart small. One relationship. One week. See what you notice.",
};

export const crosPage = {
  hero: 'The Operating System Built for Relationships',
  subtitle: 'Where every interaction becomes part of a living story.',
  body: [
    'CROS™ is the heart of the platform.',
    'Where traditional operating systems manage files and workflows,\nCROS™ manages living networks of people, partners, and communities.',
    'It keeps your work grounded in human presence:\n• conversations\n• collaboration\n• shared growth',
    'The name "CROS™" reflects a bridge —\na crossing point between your organization and the communities you serve.',
    'It does not try to control relationships.\nIt helps them stay alive.',
  ],
  sections: [
    {
      title: 'Mission-First Journeys',
      body: 'Every partner follows a journey — from first discovery to growing together. CROS™ replaces rigid sales pipelines with human-centered stages that reflect how real relationships develop. You see where a partner is, how they got there, and what might come next.',
      image: sectionCrosJourneys,
    },
    {
      title: 'Human Language, Not Dashboards',
      body: 'Instead of charts and KPIs, CROS™ uses gentle narrative suggestions. "You haven\'t connected with Bridge Builders in two weeks." "Three partners in Portland mentioned housing this month." The system speaks in the language of care, not analytics.',
      image: sectionCrosLanguage,
    },
    {
      title: 'Built for the Field',
      body: 'CROS™ is mobile-first because your work happens in communities, not behind a desk. Quick reflections, visit logging, and partner lookups all work from your phone — fast, calm, and distraction-free.',
      image: sectionCrosMobile,
    },
  ],
  capabilities: [
    'Journeys — human-centered partner stages',
    'People & Partnerships — relationship memory that grows with you',
    'Reflections — sacred space for observation and gratitude',
    'Communio Shared Signals — learn from the broader ecosystem',
    'Local Awareness — stay connected to what\'s happening nearby',
  ],
  closing: 'CROS™ keeps relationships at the center of your work.\nNot as data. As living connections.',
};

export const profundaPage = {
  hero: 'Where Relationships Become Movement',
  subtitle: 'The body of CROS — where action lives.',
  body: [
    'If NRI™ is the head and CROS™ is the heart,\nProfunda™ is the body.',
    'It is where action lives.',
    'Every meeting, provision, volunteer hour, and event becomes part of a living system —\nnot as isolated data, but as movement.',
    'The body analogy matters because organizations already understand it:\nThe head sees.\nThe heart connects.\nThe body moves.',
    'Profunda is practical, grounded, and human.\nIt turns relationships into lived experience.',
  ],
  modules: [
    { name: 'Impulsus', role: 'Memory', body: 'A private scrapbook capturing impact in first-person narrative.', to: '/impulsus' },
    { name: 'Testimonium', role: 'Witness', body: 'Quiet narrative telemetry that observes patterns over time.', to: '/testimonium-feature' },
    { name: 'Communio', role: 'Voice', body: 'Shared, anonymized signals between organizations.', to: '/communio-feature' },
    { name: 'Signum', role: 'Pulse', body: 'Local awareness shaped by events, news, and community presence.', to: '/signum' },
    { name: 'Voluntārium', role: 'Hands', body: 'Volunteer stewardship focused on reliability and care.', to: '/voluntarium' },
    { name: 'Prōvīsiō', role: 'Circulation', body: 'Resource flow and provisioning that keeps communities supported.', to: '/provisio' },
  ],
  closing: 'Profunda™ is not just software.\nIt is movement made visible.',
};

export const impulsusPage = {
  title: 'Impulsus — The Memory of Your Work',
  subtitle: 'A private scrapbook of impact, written as you serve.',
  body: [
    'Impulsus is a private scrapbook of impact.',
    'Every reflection, email, journey step, and event becomes part of a living narrative written in your own voice.',
    'Instead of writing reports after the fact,\nyour story builds itself as you work.',
    'Impulsus captures moments quietly —\nso you can remember how change actually happened.',
  ],
  sections: [
    {
      title: 'Your Story, Not a Report',
      body: 'Traditional impact reporting asks you to stop working and start documenting. Impulsus inverts this — every visit, reflection, and conversation naturally becomes part of your impact narrative. When board season arrives, your story is already written.',
      image: sectionImpulsusStory,
    },
  ],
};

export const testimoniumPage = {
  title: 'Testimonium — Quiet Witness',
  subtitle: 'Observing the rhythm of your relationships without interrupting them.',
  body: [
    'Testimonium observes the rhythm of your relationships.',
    'It notices patterns without interrupting your work:\n• moments of growth\n• seasons of drift\n• reconnections and shared presence',
    'There are no alarms.\nNo urgency.',
    'Just a gentle awareness of the narrative unfolding around you.',
  ],
  sections: [
    {
      title: 'Drift Detection',
      body: 'Testimonium watches for relationships that may be cooling — not to alarm you, but to offer a gentle signal. "You haven\'t connected with Digital Bridge Foundation in three weeks." It\'s awareness, not pressure.',
      image: sectionTestimoniumDrift,
    },
    {
      title: 'Pattern Recognition',
      body: 'Over weeks and months, Testimonium surfaces patterns that are invisible in the daily rush. Which communities are growing together? Where has energy shifted? What themes keep appearing in your reflections? These are the stories hiding in plain sight.',
      image: sectionTestimoniumPatterns,
    },
    {
      title: 'Heat Map Narrative',
      body: 'Visual overlays show where your relational energy concentrates — and where it might be thinning. This isn\'t analytics. It\'s narrative cartography: a map of the human connections that make your mission alive.',
      image: sectionTestimoniumHeatmap,
    },
  ],
};

export const communioPage = {
  title: 'Communio — Shared Narrative',
  subtitle: 'Learning from one another without exposing what\'s sacred.',
  body: [
    'Communio allows organizations to share signals without exposing private data.',
    'Anonymized insights move between trusted groups,\nhelping communities learn from one another without losing ownership of their story.',
    'Communio is collaboration without compromise.',
  ],
  sections: [
    {
      title: 'Discovery Through Communion',
      body: 'When you join Communio, your public profile helps other organizations discover you through shared mission — not algorithms. A church in Portland finds a workforce development partner in Austin because their stories overlap, not because a matching engine paired them.',
    },
    {
      title: 'Anonymized Signal Sharing',
      body: 'Communio shares patterns, not data. If three organizations in your metro notice increased housing insecurity, that signal surfaces for everyone — without revealing whose contacts mentioned it. The community learns. Privacy remains intact.',
      image: sectionCommunioSignals,
    },
    {
      title: 'Resonance Patterns',
      body: 'Over time, Communio reveals which organizations naturally resonate — sharing similar challenges, serving overlapping communities, or strengthening each other\'s work. These aren\'t forced connections. They emerge from lived experience.',
      image: sectionCommunioResonance,
    },
  ],
};

export const signumPage = {
  title: 'Signum — Territory-Aware Discovery',
  subtitle: 'Listening to the world beyond your walls.',
  body: [
    'Signum listens to the environment around your work.',
    'Local events, news, and community signals quietly inform your narrative —\nso you never lose touch with what\'s happening beyond your walls.',
    'Discovery adapts to your geography.\nWhether you serve a metro area, a cluster of rural counties, or mission fields across countries —\nSignum finds what matters within the territories you\'ve activated.',
  ],
  sections: [
    {
      title: 'Territory-Aware Intelligence',
      body: 'Relevance is weighted by proximity and mission alignment. Rural organizations are never penalized for serving smaller communities. Missionary organizations discover within their countries of service. Solo caregivers see resources near their base — without pressure to expand.',
      image: sectionSignumTerritory,
    },
    {
      title: 'Local Pulse Events',
      body: 'Signum surfaces community events, grant deadlines, local news, and partner activities that are relevant to your mission and geography. Not a firehose of information — a curated awareness of what matters to your community right now.',
      image: sectionSignumPulse,
    },
    {
      title: 'Mission-Aligned Discovery',
      body: 'New organizations, resources, and opportunities appear based on your archetype and territory. A digital inclusion nonprofit sees different signals than a church community — because their missions need different awareness.',
      image: sectionSignumMission,
    },
  ],
};

export const voluntariumPage = {
  title: 'Voluntārium — Hands of Service',
  subtitle: 'Stewarding the people who show up — with care.',
  body: [
    'Voluntārium helps you steward volunteers with care.',
    'Track presence, recognize reliability, and quietly understand who shows up again and again.',
    'Not as numbers.\nAs people.',
  ],
  sections: [
    {
      title: 'Reliability, Not Metrics',
      body: 'Voluntārium tracks volunteer presence over time — not to score them, but to help you notice patterns. Who consistently appears? Who might be drifting? These gentle signals help you steward your volunteers as humans, not headcounts.',
      image: sectionVoluntariumReliability,
    },
    {
      title: 'Hours That Tell Stories',
      body: 'Volunteer hours in CROS aren\'t just numbers in a spreadsheet. Each entry connects to events, partners, and community activities. When you look at Maria Santos\'s 8 hours last week, you see the story: the food drive she organized, the families she served, the conversations that mattered.',
      image: sectionVoluntariumHours,
    },
    {
      title: 'Simple Hour Logging',
      body: 'Volunteers can submit hours by email, through the app, or through their team lead. No complex timesheets. No portals to remember. Just simple, human-friendly tracking that respects everyone\'s time.',
      image: sectionVoluntariumLogging,
    },
  ],
};

export const provisioPage = {
  title: 'Prōvīsiō — Circulation of Resources',
  subtitle: 'Ensuring that support flows where it is needed.',
  body: [
    'Prōvīsiō tracks how resources move through your partnerships.',
    'From internal provisioning to fulfillment tracking,\nit ensures that support flows where it is needed — clearly and simply.',
    'It is not ecommerce.\nIt is stewardship.',
  ],
  sections: [
    {
      title: 'Technology Provisions',
      body: 'When partners need equipment, training materials, or digital resources, Prōvīsiō tracks the request from submission to fulfillment. Your team sees what\'s needed, where it\'s going, and whether it arrived — without spreadsheets or email chains.',
      image: sectionProvisioRequest,
    },
    {
      title: 'Fulfillment Tracking',
      body: 'Every provision has a lifecycle: requested, approved, shipped, received. Prōvīsiō makes this visible and simple. No items fall through the cracks. No partners are left wondering if their request was heard.',
      image: sectionProvisioFulfillment,
    },
    {
      title: 'Resource Stewardship',
      body: 'Over time, Prōvīsiō reveals how resources flow through your network. Which communities need the most support? Where are provisions being deployed most effectively? This isn\'t inventory management — it\'s stewardship intelligence.',
      image: sectionProvisioStewardship,
    },
  ],
};

export const financialMomentsPage = {
  title: 'Financial Moments',
  subtitle: 'Sometimes relationships move through generosity, participation, or shared work. CROS simply remembers those moments too.',
  intro: [
    'Most systems treat money as the center of the relationship.',
    'CROS doesn\'t.',
    'In CROS™, financial activity is simply another moment in the story of a relationship — like a visit, a reflection, or an event.',
    'If someone supports your work, joins a retreat, sponsors a gathering, or hires you to help their community, those moments belong in the thread of the relationship.',
    'CROS makes that easy while keeping the work relational.',
  ],
  capabilities: [
    {
      name: 'Generosity',
      summary: 'When someone supports your mission.',
      detail: 'Track and remember the people who support your work. Every act of generosity becomes part of the relationship story.',
    },
    {
      name: 'Participation',
      summary: 'When someone joins an event, workshop, or retreat.',
      detail: 'Accept simple payments for events, retreats, workshops, or membership.',
    },
    {
      name: 'Collaboration',
      summary: 'When organizations support one another through shared work.',
      detail: 'Send invoices or receive support from other organizations.',
    },
  ],
  trust: [
    'Payments are handled securely through Stripe, with funds going directly to your organization.',
    'CROS simply remembers the moment.',
  ],
  closing: 'CROS is not built to turn relationships into transactions. It simply makes it easier for the work to move when money is part of the moment.',
};