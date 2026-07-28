/**
 * Competitor Comparisons — Content for /compare/:slug SEO landing pages.
 *
 * WHAT: Structured content for CROS vs specific competitor comparison pages.
 * WHERE: Powers CompareCompetitorPage at /compare/:slug.
 * WHY: SEO authority through competitor-specific comparison content with calm, non-attacking tone.
 */

export interface CompetitorSection {
  heading: string;
  body?: string;
  bullets?: string[];
  /** Two-column layout: left = competitor, right = CROS */
  columns?: { competitor: string[]; cros: string[] };
  closingLine?: string;
}

export interface CompetitorComparison {
  slug: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string[];
  heroHeadline: string;
  heroSubheadline: string[];
  heroCta: string;
  sections: CompetitorSection[];
  finalCta: {
    lines: string[];
    buttonLabel: string;
    buttonTo: string;
  };
  /** Optional "works with" list for the mission-layer page */
  worksWith?: string[];
}

export const competitorComparisons: CompetitorComparison[] = [
  // ─── PAGE 1: CROS vs Bloomerang ───
  {
    slug: 'cros-vs-bloomerang',
    seoTitle: 'CROS vs Bloomerang: Donor CRM or Relationship Operating System?',
    metaDescription:
      'Comparing CROS™ and Bloomerang? Discover whether your nonprofit needs donor infrastructure or a relational operating system built for community work.',
    keywords: [
      'CROS vs Bloomerang',
      'Bloomerang alternative',
      'nonprofit CRM comparison',
      'donor CRM vs relationship OS',
      'Bloomerang competitor',
    ],
    heroHeadline: 'Donor CRM or Relationship Operating System?',
    heroSubheadline: [
      'Bloomerang optimizes fundraising.',
      'CROS™ preserves relational continuity.',
    ],
    heroCta: 'See Which Fits Your Mission →',
    sections: [
      {
        heading: 'What Bloomerang Was Built For',
        body: 'Bloomerang is a donor-focused CRM built to improve retention and fundraising performance. It excels at:',
        bullets: [
          'Gift tracking',
          'Recurring donations',
          'Pledge management',
          'Tax receipting',
          'Campaign segmentation',
          'Lapsed donor detection',
          'Revenue reporting dashboards',
        ],
        closingLine:
          'If your organization\'s operational center is donor revenue, Bloomerang is purpose-built for that.',
      },
      {
        heading: 'What CROS™ Was Built For',
        body: 'CROS™ is a Communal Relationship Operating System built for organizations whose work is relational before it is transactional. It centers:',
        bullets: [
          'Journey Chapters',
          'Reflections',
          'Visit logs (mobile-first)',
          'Volunteer management',
          'Community awareness',
          'Narrative reporting',
          'NRI™ (Narrative Relational Intelligence)',
        ],
        closingLine:
          'If your work depends on presence, accompaniment, and continuity of care, CROS was designed for that reality.',
      },
      {
        heading: 'Architectural Difference',
        columns: {
          competitor: ['Donor records', 'Giving history', 'Campaign performance'],
          cros: ['People', 'Partners', 'Journey Chapters', 'Reflections', 'Community signals'],
        },
        closingLine: 'One measures transactions. The other preserves relationship memory.',
      },
      {
        heading: 'Where Bloomerang Clearly Wins',
        body: 'Choose Bloomerang if:',
        bullets: [
          'Fundraising drives your operations',
          'You need built-in donation forms and tax receipts',
          'Your development team works desk-based',
          'Revenue dashboards are central to leadership conversations',
        ],
      },
      {
        heading: 'Where CROS Clearly Wins',
        body: 'Choose CROS if:',
        bullets: [
          'You accompany people long-term',
          'Staff turnover erodes context',
          'Field visits matter',
          'Volunteers are mission partners',
          'You need narrative board reporting',
          'Your mission is presence, not pipeline',
        ],
      },
      {
        heading: 'Can You Use Both?',
        body: 'Yes. Many organizations use Bloomerang for fundraising infrastructure and CROS for relational memory and field work.',
        closingLine: 'CROS Bridge™ allows layering or gradual migration.',
      },
    ],
    finalCta: {
      lines: ['Your donors deserve infrastructure.', 'Your people deserve memory.'],
      buttonLabel: 'Schedule a 20-Minute Architecture Call →',
      buttonTo: '/contact',
    },
  },

  // ─── PAGE 2: CROS vs Salesforce ───
  {
    slug: 'cros-vs-salesforce',
    seoTitle: 'CROS vs Salesforce Nonprofit Cloud: Enterprise CRM or Relational OS?',
    metaDescription:
      'Comparing CROS™ and Salesforce Nonprofit Cloud? See whether your nonprofit needs enterprise fundraising infrastructure or a relational operating system.',
    keywords: [
      'CROS vs Salesforce',
      'Salesforce Nonprofit alternative',
      'Salesforce nonprofit CRM comparison',
      'relational OS vs enterprise CRM',
    ],
    heroHeadline: 'Enterprise Power Isn\'t the Same as Relational Clarity.',
    heroSubheadline: ['Salesforce manages scale.', 'CROS™ protects presence.'],
    heroCta: 'See the Difference →',
    sections: [
      {
        heading: 'What Salesforce Was Built For',
        body: 'Salesforce began as enterprise sales software. Salesforce Nonprofit Cloud adapts that enterprise engine for:',
        bullets: [
          'Major gift portfolios',
          'Complex campaign tracking',
          'Advanced segmentation',
          'Multi-department reporting',
          'Marketing automation',
          'Deep integrations',
        ],
        closingLine:
          'It is extraordinarily powerful — and extraordinarily configurable. This often requires CRM administrators, consultants, custom object configuration, and ongoing maintenance. For large-scale fundraising organizations, this investment makes sense.',
      },
      {
        heading: 'What CROS Was Built For',
        body: 'CROS was built from lived ministry and field work outward. It assumes relationships are longitudinal, context matters, volunteers are central, staff turnover is real, and story must be preserved. It centers:',
        bullets: [
          'Journey Chapters',
          'Reflections',
          'Visit logs',
          'Volunteer roles',
          'Community signals',
          'Narrative intelligence',
        ],
        closingLine: 'No configuration cycles required.',
      },
      {
        heading: 'Architecture',
        columns: {
          competitor: ['Accounts', 'Opportunities', 'Campaigns', 'Custom Objects'],
          cros: ['People', 'Partners', 'Journey Chapters', 'Presence', 'Community Awareness'],
        },
        closingLine: 'Salesforce is enterprise infrastructure. CROS is relational infrastructure.',
      },
      {
        heading: 'Where Salesforce Wins',
        body: 'Choose Salesforce if:',
        bullets: [
          'You manage large fundraising portfolios',
          'You need complex reporting layers',
          'You budget for consultants',
          'You have a CRM admin',
        ],
      },
      {
        heading: 'Where CROS Wins',
        body: 'Choose CROS if:',
        bullets: [
          'Your mission is relational before transactional',
          'Field workers resist enterprise interfaces',
          'You need rapid adoption',
          'Narrative matters more than dashboards',
        ],
      },
      {
        heading: 'Layer or Replace?',
        body: 'CROS can replace Salesforce in relational-first organizations, layer above Salesforce for field teams, or bridge during migration.',
        closingLine: 'CROS Bridge™ supports two-way sync and transition.',
      },
    ],
    finalCta: {
      lines: [
        'If revenue leakage is your risk, Salesforce protects you.',
        'If relational drift is your risk, CROS protects you.',
      ],
      buttonLabel: 'Book an Architecture Walkthrough →',
      buttonTo: '/contact',
    },
  },

  // ─── PAGE 3: CROS vs HubSpot ───
  {
    slug: 'cros-vs-hubspot',
    seoTitle: 'CROS vs HubSpot for Nonprofits: Marketing CRM or Relational OS?',
    metaDescription:
      'Comparing CROS™ and HubSpot? Discover whether your nonprofit needs marketing automation or a relational operating system built for mission work.',
    keywords: [
      'CROS vs HubSpot',
      'HubSpot nonprofit alternative',
      'marketing CRM vs relationship OS',
      'HubSpot competitor nonprofit',
    ],
    heroHeadline: 'Marketing Automation Isn\'t Relationship Memory.',
    heroSubheadline: ['HubSpot accelerates campaigns.', 'CROS™ sustains community.'],
    heroCta: 'Compare the Approaches →',
    sections: [
      {
        heading: 'What HubSpot Was Built For',
        body: 'HubSpot began as marketing automation software. It excels at:',
        bullets: [
          'Email campaigns',
          'Lead scoring',
          'Marketing funnels',
          'Website forms',
          'Content analytics',
          'Sales pipeline management',
        ],
        closingLine: 'HubSpot optimizes growth.',
      },
      {
        heading: 'What CROS Was Built For',
        body: 'CROS optimizes continuity. It centers:',
        bullets: [
          'Reflections',
          'Journey Chapters',
          'Volunteer engagement',
          'Visit logs',
          'Community intelligence',
          'Narrative reporting',
        ],
        closingLine: 'HubSpot asks: How do we convert? CROS asks: How do we accompany?',
      },
      {
        heading: 'Where HubSpot Wins',
        body: 'Choose HubSpot if:',
        bullets: [
          'You run heavy digital campaigns',
          'You depend on inbound marketing',
          'Growth funnels drive strategy',
          'Marketing automation is core',
        ],
      },
      {
        heading: 'Where CROS Wins',
        body: 'Choose CROS if:',
        bullets: [
          'Your mission happens offline',
          'Field work drives impact',
          'You measure success in presence',
          'You need human continuity over time',
        ],
      },
      {
        heading: 'Using Both',
        body: 'Many organizations use HubSpot for marketing and CROS for field and relational memory.',
        closingLine: 'CROS Bridge™ enables integration.',
      },
    ],
    finalCta: {
      lines: ['Growth matters.', 'So does memory.'],
      buttonLabel: 'See How CROS Layers →',
      buttonTo: '/contact',
    },
  },

  // ─── PAGE 4: Mission Layer ───
  {
    slug: 'cros-mission-layer-crm',
    seoTitle: 'The Relational Layer Above Your Nonprofit CRM | CROS™',
    metaDescription:
      'Already using Salesforce, Bloomerang, HubSpot, or Planning Center? Add CROS™ as your relational and narrative intelligence layer.',
    keywords: [
      'CRM relational layer',
      'nonprofit CRM add-on',
      'relational intelligence layer',
      'CROS mission layer',
      'CRM narrative layer',
    ],
    heroHeadline: 'Your CRM Tracks Donations.\nWho Tracks the Story?',
    heroSubheadline: ['CROS™ is the relational intelligence layer above your existing CRM.'],
    heroCta: 'See What CROS Adds →',
    worksWith: [
      'Salesforce',
      'Bloomerang',
      'HubSpot',
      'Planning Center',
      'Dynamics',
      'Blackbaud',
      'Monday',
    ],
    sections: [
      {
        heading: 'The Hidden Gap',
        body: 'Traditional CRMs track gifts, campaigns, segments, and reports. They do not protect:',
        bullets: [
          'Relationship continuity',
          'Field context',
          'Volunteer memory',
          'Community awareness',
        ],
      },
      {
        heading: 'What CROS Adds',
        body: 'CROS adds the relational layer your CRM was never designed to hold:',
        bullets: [
          'Journey Chapters',
          'Reflections',
          'Visit logging',
          'Volunteer system',
          'Narrative reporting',
          'Drift detection (NRI™)',
          'Community signals (Signum™)',
        ],
      },
      {
        heading: 'When to Layer',
        body: 'Layer CROS if:',
        bullets: [
          'Your donor CRM is stable',
          'Your field team lacks memory tools',
          'You don\'t want rip-and-replace',
        ],
      },
      {
        heading: 'When to Consolidate',
        body: 'Consolidate into CROS if:',
        bullets: [
          'Fundraising is light',
          'You want simpler architecture',
          'Relationship continuity is primary',
        ],
      },
    ],
    finalCta: {
      lines: ['Add the relational layer your CRM was never designed to hold.'],
      buttonLabel: 'Book a Mission Architecture Call →',
      buttonTo: '/contact',
    },
  },
];
