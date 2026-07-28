/**
 * microGuidanceRegistry -- Static registry of gentle guidance cards.
 *
 * WHAT: Defines contextual, role-aware micro-guidance entries for Companion Mode.
 * WHERE: Used by useNarrativeCompanion hook to select appropriate guidance.
 * WHY: Calm, non-intrusive guidance helps users discover features without pressure.
 */

export interface MicroGuide {
  key: string;
  title: string;
  body: string;
  roleTargets: Array<'steward' | 'shepherd' | 'companion' | 'visitor'>;
  routes: string[] | '*';
  triggers: Array<'friction_idle' | 'friction_rage_click' | 'first_time_page' | 'repeat_attempt' | 'manual_open'>;
  ctaLabel?: string;
  ctaAction?: { type: 'navigate'; path: string; navTestId?: string } | { type: 'scroll'; selector: string };
  priority: number;
  hipaaSafe: boolean;
  conditions?: Record<string, boolean>;
}

export const MICRO_GUIDANCE_REGISTRY: MicroGuide[] = [
  // Visitor Guides
  {
    key: 'visitor_voice_note',
    title: 'Speak it instead',
    body: 'If typing is a burden, you can record a short voice note and we will turn it into a visit note.',
    roleTargets: ['visitor'],
    routes: ['/visits'],
    triggers: ['friction_idle', 'first_time_page'],
    ctaLabel: 'Record a note',
    priority: 10,
    hipaaSafe: true,
  },
  {
    key: 'visitor_first_visit',
    title: 'Welcome to visits',
    body: 'This is where you log the people you have connected with. Each visit becomes part of the story.',
    roleTargets: ['visitor'],
    routes: ['/visits'],
    triggers: ['first_time_page'],
    priority: 20,
    hipaaSafe: true,
  },
  // Companion Guides
  {
    key: 'companion_log_activity',
    title: 'Capture a touchpoint',
    body: 'Most teams start by opening a partner and logging one real interaction -- a call, a visit, an email.',
    roleTargets: ['companion', 'shepherd'],
    routes: ['/opportunities', '/contacts'],
    triggers: ['first_time_page', 'friction_idle'],
    ctaLabel: 'Open Partners',
    ctaAction: { type: 'navigate', path: '/opportunities', navTestId: 'nav-opportunities' },
    priority: 10,
    hipaaSafe: true,
  },
  {
    key: 'companion_add_person',
    title: 'Add someone you know',
    body: 'People are the heart of your work. Adding a contact takes a moment and creates a lasting thread.',
    roleTargets: ['companion'],
    routes: ['/people', '/contacts'],
    triggers: ['first_time_page'],
    ctaLabel: 'View People',
    ctaAction: { type: 'navigate', path: '/people', navTestId: 'nav-people' },
    priority: 20,
    hipaaSafe: true,
  },
  {
    key: 'companion_link_partner',
    title: 'Connect people to partners',
    body: 'When you link a contact to a partner, their story becomes part of the relationship arc.',
    roleTargets: ['companion'],
    routes: ['/people', '/contacts'],
    triggers: ['friction_idle', 'repeat_attempt'],
    priority: 30,
    hipaaSafe: true,
  },
  {
    key: 'companion_mark_attended',
    title: 'Mark it attended',
    body: 'When you mark a meeting as attended, it moves the relationship forward automatically.',
    roleTargets: ['companion', 'shepherd'],
    routes: ['/calendar', '/activities'],
    triggers: ['first_time_page', 'friction_idle'],
    priority: 25,
    hipaaSafe: true,
  },
  // Shepherd Guides
  {
    key: 'shepherd_journey_stage',
    title: 'Move the journey forward',
    body: 'Journey stages tell the story of how a relationship is growing. Review and advance when you are ready.',
    roleTargets: ['shepherd'],
    routes: ['/opportunities'],
    triggers: ['friction_idle', 'first_time_page'],
    priority: 15,
    hipaaSafe: true,
  },
  {
    key: 'shepherd_read_intel',
    title: 'Check the signals',
    body: 'The Intel Feed gathers community signals so you can notice what matters without searching.',
    roleTargets: ['shepherd'],
    routes: ['/dashboard', '/'],
    triggers: ['first_time_page', 'friction_idle'],
    ctaLabel: 'Open Intel Feed',
    ctaAction: { type: 'navigate', path: '/intel-feed', navTestId: 'nav-intel-feed' },
    priority: 20,
    hipaaSafe: true,
  },
  {
    key: 'shepherd_view_narrative',
    title: 'Read the narrative',
    body: 'Narratives weave your team\'s reflections and signals into a single story. They are written for you.',
    roleTargets: ['shepherd'],
    routes: ['/metros'],
    triggers: ['first_time_page'],
    ctaLabel: 'View Narratives',
    ctaAction: { type: 'navigate', path: '/narratives', navTestId: 'nav-narratives' },
    priority: 25,
    hipaaSafe: true,
  },
  // Steward Guides
  {
    key: 'steward_connect_email',
    title: 'Connect your email when you are ready',
    body: 'Connecting Gmail or Outlook lets your calendar and outreach stay in one place. You can do it anytime.',
    roleTargets: ['steward', 'shepherd'],
    routes: ['/settings', '/dashboard', '/'],
    triggers: ['first_time_page', 'friction_idle'],
    ctaLabel: 'Open Connections',
    ctaAction: { type: 'navigate', path: '/settings' },
    priority: 10,
    hipaaSafe: true,
  },
  {
    key: 'steward_enable_calendar',
    title: 'Your calendar can listen',
    body: 'When Google Calendar is connected, meetings with partners are tracked automatically.',
    roleTargets: ['steward'],
    routes: ['/calendar'],
    triggers: ['first_time_page'],
    priority: 15,
    hipaaSafe: true,
  },
  {
    key: 'steward_invite_users',
    title: 'Invite your team',
    body: 'CROS works best when your team is here. Each person sees what is right for their role.',
    roleTargets: ['steward'],
    routes: ['/admin', '/dashboard', '/'],
    triggers: ['first_time_page', 'friction_idle'],
    ctaLabel: 'Open Team Settings',
    ctaAction: { type: 'navigate', path: '/admin', navTestId: 'nav-admin' },
    priority: 5,
    hipaaSafe: true,
  },
  {
    key: 'steward_communio',
    title: 'Consider sharing signals',
    body: 'Communio lets your community group share anonymized signals. It is opt-in and privacy-safe.',
    roleTargets: ['steward'],
    routes: ['/communio', '/settings'],
    triggers: ['first_time_page'],
    priority: 30,
    hipaaSafe: true,
  },
  {
    key: 'steward_email_intake',
    title: 'Let email work for you',
    body: 'Email intake surfaces relationship insights from your inbox -- without anyone else seeing your messages.',
    roleTargets: ['steward', 'shepherd'],
    routes: ['/settings'],
    triggers: ['friction_idle'],
    priority: 20,
    hipaaSafe: true,
  },
  // Universal Guides
  {
    key: 'universal_simple_start',
    title: 'A simple start',
    body: 'If you are not sure where to begin, most teams start by opening Partners and logging one real touch.',
    roleTargets: ['companion', 'shepherd', 'steward'],
    routes: ['/dashboard', '/'],
    triggers: ['first_time_page', 'friction_idle'],
    ctaLabel: 'Open Partners',
    ctaAction: { type: 'navigate', path: '/opportunities', navTestId: 'nav-opportunities' },
    priority: 50,
    hipaaSafe: true,
  },
  {
    key: 'universal_idle_encouragement',
    title: 'Take your time',
    body: 'There is no rush. CROS remembers where you left off. You can come back to this anytime.',
    roleTargets: ['visitor', 'companion', 'shepherd', 'steward'],
    routes: '*',
    triggers: ['friction_idle'],
    priority: 100,
    hipaaSafe: true,
  },
  {
    key: 'universal_rage_click',
    title: 'Something not working?',
    body: 'If something feels stuck, try refreshing. If it persists, let us know -- we are listening.',
    roleTargets: ['visitor', 'companion', 'shepherd', 'steward'],
    routes: '*',
    triggers: ['friction_rage_click'],
    ctaLabel: 'Report something',
    ctaAction: { type: 'navigate', path: '/feedback' },
    priority: 5,
    hipaaSafe: true,
  },
];
