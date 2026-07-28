// Marketing site copy — edit here, not in JSX
import { archetypes, tiers, brand } from '@/config/brand';

export const hero = {
  title: 'A Communal Relationship OS.',
  subtitle:
    'CROS™ helps teams remember people, notice community shifts, and build a living story of impact \u2014 without turning mission into busywork.',
  ctaPrimary: 'Get started now',
  ctaSecondary: 'Try the demo',
};

export const pillars = [
  {
    title: 'Relationship Memory',
    body: "Reflections + email create a quiet record of what Shepherds and Companions have shared and learned.",
    icon: 'heart' as const,
  },
  {
    title: 'Community Awareness',
    subtitle: 'Signum',
    body: "Local events + trusted sources keep a gentle pulse on what\u2019s changing \u2014 so your team remembers moments that matter.",
    icon: 'radar' as const,
  },
  {
    title: 'Narrative Intelligence',
    subtitle: 'NRI™ / Neary',
    body: "Stories become clarity \u2014 connecting signals to the relationship journeys your Companions and Visitors are living.",
    icon: 'book-open' as const,
  },
];

export const differentiators = {
  headline: 'Not a database. A story.',
  bullets: [
    'Mission-first relationship journeys, not sales pipelines.',
    'Human language and calm suggestions — Shepherds and Companions stay connected to people.',
    'Built for field teams: fast, mobile, and real.',
    'Projects capture the good work your community does — and turn it into a living story of impact.',
  ],
};

export const constellationCopy = {
  sectionTitle: 'A living constellation of care',
  subhead: 'Across cities and communities, small acts are becoming shared stories.',
  atlasCaption: 'Where care is happening',
  constellationCaption: 'How communities are growing together',
  providenceCaption: 'The quiet threads connecting moments',
  cta: 'See how it works',
  comparison: {
    headline: 'Not another CRM.\nA living constellation of care.',
    before: 'Before CROS:\npeople were rows in a database.',
    after: 'After CROS:\nstories become visible,\nand communities begin to recognize each other.',
  },
};

export const archetypeCards = [
  { key: 'church' as const, label: 'Churches & Mission Teams' },
  { key: 'digital_inclusion' as const, label: 'Community Tech & Digital Equity Orgs' },
  { key: 'social_enterprise' as const, label: 'Food Security Networks' },
  { key: 'refugee_support' as const, label: 'Shelter & Housing Coalitions' },
  { key: 'workforce' as const, label: 'Workforce Development + Education Partners' },
  { key: 'library_system' as const, label: 'Social Enterprises serving underserved neighborhoods' },
  { key: 'caregiver_solo' as const, label: 'Independent Caregivers & Care Companions' },
  { key: 'caregiver_agency' as const, label: 'Home Care & Caregiver Agencies' },
  { key: 'missionary_org' as const, label: 'Cross-Cultural Mission Organizations' },
];

export const crosNri = {
  cros: 'The bridge between your organization and the community you serve.',
  nri: "Narrative Relational Intelligence™ \u2014 intelligence supported by human experience. It helps you notice what matters, not just what's measurable.",
};

export const trust = [
  'Your private reflections stay private.',
  'Email content is handled with strict boundaries and never spills into shared narratives.',
  'Admins can see ingestion health without reading the news.',
  'Nothing is lost — recovery & restoration are built into every surface.',
];

export const securityPage = {
  dataBoundaries: {
    title: 'Data boundaries',
    body: "Every reflection, email, and touchpoint stays scoped to the individual who wrote it. Team dashboards aggregate signals \u2014 never raw content. Your community's trust is the product.",
  },
  roleBased: {
    title: 'Role-based access',
    body: 'CROS™ enforces row-level security on every table. Admins, regional leads, staff, and warehouse managers each see only what they need \u2014 nothing more.',
  },
  auditHealth: {
    title: 'Audit & ingestion health',
    body: 'Every automation run, every crawl, every email sync is logged with status, timing, and outcome. Admins can review ingestion health at a glance without reading content.',
  },
  enterpriseHardening: {
    title: 'Enterprise-grade protection',
    body: 'Content Security Policy headers guard against injection attacks. Sessions quietly expire after 30 minutes of inactivity. Rate-limit detection protects your data during peak usage — and retries gracefully so nothing is lost.',
  },
  dataQuality: {
    title: 'Data quality, watched over gently',
    body: 'CROS notices when relationships drift out of alignment — orphaned records, incomplete profiles, potential duplicates. These signals surface calmly in your steward view, never as alarms.',
  },
  emailCalendar: {
    title: 'Email + calendar safety',
    body: 'Gmail integration is opt-in. Calendar sync is read-only. AI analysis respects sender patterns and never auto-shares. You control when, what, and who.',
  },
  recoveryRestore: {
    title: 'Nothing is lost here',
    body: 'If something disappears, the assistant can usually restore it. Private action breadcrumbs (not content) help undo mistakes. Emergency recovery is always one message away.',
  },
};

export const integrationConfidence = {
  heading: 'How CROS Safely Connects to Your Existing Systems',
  subheading:
    "We don\u2019t ask you to take integrations on faith \u2014 we verify them carefully before they ever touch your data.",
  cards: [
    {
      title: 'Understanding the Data',
      body: 'Before any connection goes live, CROS learns how each system speaks. We normalize names, dates, and relationships so your story stays intact.',
    },
    {
      title: 'Preparing for Change',
      body: "External systems evolve over time. CROS is tested against changing formats so updates don\u2019t silently break your workflow.",
    },
    {
      title: 'Safe Practice Runs',
      body: 'Whenever possible, integrations are rehearsed in a dry-run first. You can see what will happen before anything is imported.',
    },
    {
      title: 'Clear Insight, Not Guesswork',
      body: "Every sync produces calm, readable logs \u2014 not cryptic errors \u2014 so you always understand what happened and what comes next.",
    },
  ],
  trustCallout: {
    title: 'Built for Mission Work, Not Risk',
    body: "Most platforms assume integrations are perfect. CROS assumes your work is too important to leave to chance \u2014 so we design for clarity, resilience, and human oversight.",
  },
};

export const footerLinks = [
  { label: 'Features', to: '/features' },
  { label: 'Roles', to: '/roles' },
  { label: 'NRI™', to: '/nri' },
  { label: 'CROS™', to: '/cros' },
  { label: 'Profunda™', to: '/profunda' },
  { label: 'Compare', to: '/compare' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Archetypes', to: '/archetypes' },
  { label: 'Lexicon', to: '/lexicon' },
  { label: 'Field Journal', to: '/field-journal' },
  { label: 'Authority', to: '/authority' },
  { label: 'Security', to: '/security' },
  { label: 'See People', to: '/see-people' },
  { label: 'Imagine This', to: '/imagine-this' },
  { label: 'Relatio Campaigns', to: '/relatio-campaigns' },
  { label: 'Our Story', to: '/case-study-humanity' },
  { label: 'Relational Fundraising', to: '/fundraising-without-a-donor-crm' },
  { label: 'Contact', to: '/contact' },
  { label: 'Sign in', to: '/login' },
  { label: 'Terms', to: '/legal/terms' },
  { label: 'Privacy', to: '/legal/privacy' },
  { label: 'AI Transparency', to: '/legal/ai-transparency' },
];

export { archetypes, tiers, brand };
