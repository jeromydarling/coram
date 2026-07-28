/**
 * demoSeedProfiles — Deterministic scenario library for Demo Lab seeding.
 *
 * WHAT: Story-consistent, versioned data profiles for demo tenants.
 * WHERE: Used by demo-tenant-seed edge function and Demo Lab UI.
 * WHY: Reproducible, realistic demo data without external generators.
 */

export interface SeedProfile {
  key: 'small' | 'medium' | 'large';
  label: string;
  description: string;
  metros: number;
  organizations: number;
  contacts: number;
  events: number;
  activities: number;
  reflections: number;
  localPulseSources: number;
  provisions: number;
  volunteers: number;
  grants: number;
  anchors: number;
}

export const SEED_PROFILES: Record<string, SeedProfile> = {
  small: {
    key: 'small',
    label: 'Small Community',
    description: '12 orgs, 40 contacts, 3 metros — light activity history',
    metros: 3,
    organizations: 12,
    contacts: 40,
    events: 6,
    activities: 24,
    reflections: 8,
    localPulseSources: 4,
    provisions: 3,
    volunteers: 5,
    grants: 2,
    anchors: 1,
  },
  medium: {
    key: 'medium',
    label: 'Growing Network',
    description: '60 orgs, 300 contacts — realistic event cadence + reflections',
    metros: 6,
    organizations: 60,
    contacts: 300,
    events: 24,
    activities: 120,
    reflections: 40,
    localPulseSources: 12,
    provisions: 10,
    volunteers: 20,
    grants: 6,
    anchors: 4,
  },
  large: {
    key: 'large',
    label: 'Migration-Heavy',
    description: '200 orgs, 1200 contacts — dense activity logs for stress testing',
    metros: 12,
    organizations: 200,
    contacts: 1200,
    events: 60,
    activities: 500,
    reflections: 100,
    localPulseSources: 30,
    provisions: 25,
    volunteers: 50,
    grants: 12,
    anchors: 8,
  },
};

// ── Deterministic name pools ──

export const METRO_NAMES = [
  'Austin', 'Denver', 'Portland', 'Minneapolis', 'Detroit',
  'Nashville', 'Charlotte', 'Pittsburgh', 'Columbus', 'Indianapolis',
  'Phoenix', 'Seattle', 'Atlanta', 'Tampa', 'Kansas City',
  'Milwaukee', 'Raleigh', 'Memphis', 'Louisville', 'Richmond',
];

export const ORG_NAMES = [
  'Community First Alliance', 'Digital Bridge Foundation', 'Tech for All',
  'Neighborhood Connect', 'Metro Impact Partners', 'Future Ready Coalition',
  'Access Point Network', 'Civic Lab', 'Together Forward', 'Unity Project',
  'Pathways Hub', 'Bridge Builders', 'Community Compass', 'NextStep Foundation',
  'Open Door Initiative', 'Roots & Routes', 'Connected Communities', 'Uplift Partners',
  'Harbor House', 'Crossroads Collective', 'Thrive Alliance', 'Hope Network',
  'Rising Tide Foundation', 'Common Ground', 'Beacon Partners',
  'Sunrise Community Center', 'Prairie Wind Collective', 'Lakeside Outreach',
  'Mountain View Alliance', 'Riverside Initiative', 'Heartland Coalition',
  'Northern Light Foundation', 'Summit Partners', 'Valley Forge Network',
  'Coastal Impact Group', 'Pinewood Community Trust', 'Greenfield Cooperative',
  'Stonegate Foundation', 'Eastside Empowerment', 'Westbrook Initiative',
];

export const FIRST_NAMES = [
  'Maria', 'James', 'Fatima', 'David', 'Keiko', 'Robert', 'Aisha', 'Michael',
  'Priya', 'Thomas', 'Elena', 'Carlos', 'Mei', 'Joseph', 'Amara', 'Daniel',
  'Sofia', 'William', 'Yuki', 'Patrick', 'Zara', 'Samuel', 'Leila', 'Anthony',
];

export const LAST_NAMES = [
  'Johnson', 'Garcia', 'Patel', 'Williams', 'Chen', 'Brown', 'Kim', 'Davis',
  'Martinez', 'Lee', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson',
  'White', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
];

export const STAGES = [
  'Found', 'Contacted', 'Discovery Scheduled', 'Discovery Held',
  'Proposal Sent', 'Committed', 'Stable Producer',
];

export const EVENT_NAMES = [
  'Community Roundtable', 'Digital Inclusion Summit', 'Partner Breakfast',
  'Quarterly Review', 'Leadership Forum', 'Town Hall', 'Volunteer Appreciation',
  'Strategy Session', 'Neighborhood Walk', 'Annual Gathering',
  'Tech Access Workshop', 'Youth Empowerment Day', 'Health Fair',
];

export const TITLES = [
  'Executive Director', 'Director', 'Manager', 'Coordinator', 'VP',
  'Program Lead', 'Outreach Specialist', 'Community Liaison', 'Board Chair',
];

export const ACTIVITY_TYPES = [
  'call', 'email', 'meeting', 'event', 'site_visit', 'follow_up',
];

export const REFLECTION_PROMPTS = [
  'First impression of the partnership potential',
  'Key takeaway from the discovery meeting',
  'Observed growing community engagement',
  'Notable shift in organizational priorities',
  'Promising alignment with metro goals',
  'Relationship deepening over time',
  'Quiet progress worth noting',
  'Leadership transition observations',
];

export const GRANT_NAMES = [
  'Digital Inclusion Innovation Fund', 'Community Resilience Grant',
  'Workforce Development Partnership', 'Neighborhood Revitalization Award',
  'Youth Empowerment Initiative', 'Health Equity Access Fund',
  'Small Business Recovery Grant', 'Environmental Justice Fund',
  'Arts & Culture Community Grant', 'Housing Stability Program',
  'Education Access Initiative', 'Senior Services Support Fund',
];

export const FUNDER_NAMES = [
  'Local Community Foundation', 'National Endowment for Progress',
  'Metro Area United Way', 'State Department of Commerce',
  'Federal Housing Authority', 'Regional Arts Council',
  'Corporate Giving Alliance', 'Family Foundation Trust',
];

// ── Rich narrative content for demo realism ──

export const REFLECTION_BODIES = [
  'Met with their ED today. She shared how the neighborhood has changed over the past decade — more families arriving, fewer resources available. There\'s a quiet determination in her voice that stays with you.',
  'This organization is at a crossroads. The founder is stepping back, and the incoming director brings fresh energy but limited community history. Worth nurturing both relationships.',
  'Attended their community dinner last Thursday. The way families gathered around tables, sharing stories in three languages — this is exactly what communal technology should serve.',
  'Had a long call with their program coordinator. She mentioned that volunteers are showing up more consistently since we connected them with the training resources. Small wins.',
  'Visited their new space. It\'s modest but warm. Books in every corner, a coffee station that\'s clearly the social hub. They\'re building something real here.',
  'The partnership is deepening in ways I didn\'t expect. They\'re now referring other organizations to us — a sign of genuine trust, not just transactional engagement.',
  'Noticed a shift in their board dynamics. The newer members are pushing for digital tools, while longtime members value the personal touch. Our platform bridges both.',
  'Their youth program coordinator pulled me aside after the event to say thank you. Not for the technology, but for listening. That matters more than any feature.',
];

export const JOURNEY_CHAPTERS = [
  { title: 'First Encounter', body: 'Found them through a community event listing. Their work with immigrant families aligns deeply with our metro goals.' },
  { title: 'Building Trust', body: 'Three coffee meetings over two months. They were skeptical of technology platforms at first — previous experiences left them wary.' },
  { title: 'Discovery Meeting', body: 'Walked through their daily workflow. Realized they track relationships on paper notebooks and shared spreadsheets. The opportunity is clear.' },
  { title: 'Commitment', body: 'Board voted unanimously to partner. The ED called personally to share the news — she said it was the first unanimous vote in years.' },
  { title: 'Growing Together', body: 'Six months in. They\'ve logged 40+ reflections and connected with three neighboring organizations through our network.' },
  { title: 'Stable Partnership', body: 'A year of consistent engagement. They now mentor newer organizations on how to use relational tools effectively.' },
];

export const LOCAL_PULSE_ARTICLES = [
  { title: 'City Council Approves New Community Center Funding', source: 'Metro Daily', relevance: 'direct' },
  { title: 'Nonprofit Coalition Launches Digital Literacy Program', source: 'Community Wire', relevance: 'direct' },
  { title: 'Volunteer Numbers Surge After Weekend Food Drive', source: 'Local Herald', relevance: 'adjacent' },
  { title: 'Faith Communities Partner on Housing Initiative', source: 'Metro Chronicle', relevance: 'direct' },
  { title: 'Local Library System Expands ESL Services', source: 'Education Weekly', relevance: 'adjacent' },
  { title: 'Regional Workforce Board Reports Skills Gap Narrowing', source: 'Business Journal', relevance: 'background' },
  { title: 'Youth Mentorship Program Celebrates 10th Anniversary', source: 'Community Voice', relevance: 'direct' },
  { title: 'New Immigrant Resource Hub Opens Downtown', source: 'Metro Daily', relevance: 'direct' },
];
