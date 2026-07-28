// Civitas Archetype Spine — defines org types and their defaults
// Used by onboarding wizard and tenant configuration

export interface ArchetypeConfig {
  key: string;
  label: string;
  missionPrompt: string;
  defaultModules: string[];
  defaultJourneyStages: string[];
  defaultKeywords: string[];
}

export const archetypeConfigs: ArchetypeConfig[] = [
  {
    key: 'church',
    label: 'Church / Faith Community',
    missionPrompt: 'Congregational care, outreach, and community connection.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'provisio', 'events', 'voluntarium_basic', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'First Visit', 'Getting Connected', 'Active Member',
      'Serving', 'Leading', 'Shepherding',
    ],
    defaultKeywords: [
      'church outreach', 'food pantry', 'community meals',
      'faith community event', 'neighborhood ministry', 'volunteer day',
    ],
  },
  {
    key: 'nonprofit_program',
    label: 'Nonprofit Program',
    missionPrompt: 'General nonprofit delivering services and building partnerships.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'provisio', 'events', 'voluntarium_basic', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Identified', 'Outreach', 'Engaged',
      'Active Partner', 'Sustained', 'Advocate',
    ],
    defaultKeywords: [
      'nonprofit partnership', 'community grant', 'social services',
      'impact report', 'community development', 'capacity building',
    ],
  },
  {
    key: 'social_enterprise',
    label: 'Social Enterprise',
    missionPrompt: 'Mission-driven business creating measurable community impact.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'provisio', 'events', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Prospect', 'Discovery', 'Pilot',
      'Active Client', 'Growth Partner', 'Champion',
    ],
    defaultKeywords: [
      'social enterprise', 'impact investing', 'B-corp',
      'sustainable business', 'community commerce', 'inclusive economy',
    ],
  },
  {
    key: 'community_foundation',
    label: 'Community Foundation',
    missionPrompt: 'Partnership and event-focused community development — not donor management.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'events', 'voluntarium_basic', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Awareness', 'Introduction', 'Collaborative Planning',
      'Joint Initiative', 'Deep Partnership', 'Ecosystem Leader',
    ],
    defaultKeywords: [
      'community foundation', 'place-based giving', 'civic engagement',
      'neighborhood revitalization', 'coalition building', 'local philanthropy',
    ],
  },
  {
    key: 'workforce_development',
    label: 'Workforce Development',
    missionPrompt: 'Building pathways to employment and career growth for communities.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'provisio', 'events', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Employer Identified', 'Initial Contact', 'Site Visit',
      'Placement Partner', 'Active Hiring', 'Strategic Workforce Ally',
    ],
    defaultKeywords: [
      'workforce development', 'job training', 'apprenticeship',
      'hiring event', 'career pathway', 'skills gap',
    ],
  },
  {
    key: 'public_library_or_city_program',
    label: 'Public Library or City Program',
    missionPrompt: 'Community knowledge hubs, public services, and civic programming.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'events', 'voluntarium_basic', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Community Need Identified', 'Outreach', 'Program Launched',
      'Growing Participation', 'Sustained Impact', 'Model Program',
    ],
    defaultKeywords: [
      'library program', 'digital literacy', 'civic technology',
      'public access', 'community hub', 'city initiative',
    ],
  },
  {
    key: 'housing',
    label: 'Housing & Shelter',
    missionPrompt: 'Affordable housing, homelessness prevention, and shelter services.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'provisio', 'events', 'voluntarium_basic', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Referral Received', 'Intake', 'Housing Search',
      'Placed', 'Stabilizing', 'Thriving',
    ],
    defaultKeywords: [
      'affordable housing', 'shelter services', 'homelessness prevention',
      'housing first', 'tenant support', 'rapid rehousing',
    ],
  },
  {
    key: 'education',
    label: 'Education Access',
    missionPrompt: 'Expanding learning opportunities and educational equity in communities.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'events', 'voluntarium_basic', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Community Identified', 'Program Awareness', 'Enrolled',
      'Active Learner', 'Completing', 'Alumni & Advocate',
    ],
    defaultKeywords: [
      'education access', 'tutoring program', 'scholarship',
      'after school', 'STEM education', 'adult learning',
    ],
  },
  {
    key: 'government',
    label: 'Government / Civic Agency',
    missionPrompt: 'Public-sector programs serving residents and strengthening civic infrastructure.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'events', 'basic_narrative',
    ],
    defaultJourneyStages: [
      'Constituent Identified', 'Initial Engagement', 'Service Delivery',
      'Ongoing Relationship', 'Community Champion', 'Policy Advocate',
    ],
    defaultKeywords: [
      'civic engagement', 'public services', 'municipal program',
      'community meeting', 'resident outreach', 'government partnership',
    ],
  },
  {
    key: 'caregiver_solo',
    label: 'Caregiver (Solo)',
    missionPrompt: 'A private space to honor the story of the people you care for.',
    defaultModules: [
      'relationships', 'journey', 'reflections',
      'basic_narrative',
    ],
    defaultJourneyStages: [
      'First Meeting', 'Building Trust', 'Ongoing Care',
      'Deep Companionship', 'Season Closing',
    ],
    defaultKeywords: [
      'home care', 'elder care', 'respite care',
      'caregiver support', 'companion care', 'personal care',
    ],
  },
  {
    key: 'caregiver_agency',
    label: 'Caregiver Agency',
    missionPrompt: 'Dignified care coordination — visibility without surveillance.',
    defaultModules: [
      'relationships', 'journey', 'reflections',
      'voluntarium_basic', 'basic_narrative', 'events',
    ],
    defaultJourneyStages: [
      'Referral', 'Intake', 'Active Care',
      'Transition', 'Completed',
    ],
    defaultKeywords: [
      'home health', 'caregiver agency', 'care coordination',
      'client services', 'care management', 'companion care',
    ],
  },
  {
    key: 'missionary_org',
    label: 'Missionary Organization',
    missionPrompt: 'Cross-cultural service, international mission fields, and global outreach.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'voluntarium_basic', 'basic_narrative', 'events',
    ],
    defaultJourneyStages: [
      'Found', 'First Conversation', 'Discovery',
      'Partnership Formed', 'Serving Together', 'Growing Together',
    ],
    defaultKeywords: [
      'missions', 'international outreach', 'cross-cultural',
      'field workers', 'support raising', 'global service',
    ],
  },
  {
    key: 'retreat_center',
    label: 'Retreat Center',
    missionPrompt: 'Hold the thread of every retreat journey — remember the people who return.',
    defaultModules: [
      'relationships', 'journey', 'reflections', 'signum_baseline',
      'voluntarium_basic', 'basic_narrative', 'events',
    ],
    defaultJourneyStages: [
      'Inquiry', 'Registered', 'Retreatant',
      'Returning Guest', 'Spiritual Companion', 'Community Friend',
    ],
    defaultKeywords: [
      'retreat center', 'silent retreat', 'parish retreat',
      'youth retreat', 'spiritual direction', 'formation event',
    ],
  },
];

export function getArchetype(key: string): ArchetypeConfig | undefined {
  return archetypeConfigs.find(a => a.key === key);
}
