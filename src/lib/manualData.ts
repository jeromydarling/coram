/**
 * manualData — Structured data for the CROS Field Guide and Gardener Steward Manual.
 *
 * WHAT: Complete inventory of routes, roles, modules, workflows, signals, and nexus workflows.
 * WHERE: Consumed by the Manual Export page for PDF generation.
 * WHY: Supports creation of two physical reference books for tenants and Gardeners.
 *
 * OPERATOR ROUTES & MODULES: Auto-derived from gardenerNavRegistry.ts (single source of truth).
 * Adding a new section to the registry automatically creates route + module entries here.
 */

import { GARDENER_NAV_REGISTRY, type GardenerNavEntry } from './gardenerNavRegistry';

// ─────────────────────────────────────
// HELPERS — Auto-derive from registry
// ─────────────────────────────────────

/** Convert gardenerNavRegistry entries into RouteEntry[] for the operator section. */
function deriveOperatorRoutes(): RouteEntry[] {
  return GARDENER_NAV_REGISTRY.map((entry) => ({
    route_path: entry.route,
    display_name: entry.title,
    sidebar_group: entry.zone === 'cura' ? 'Gardener Nexus' : entry.zone === 'machina' ? 'Gardener System' : entry.zone === 'scientia' ? 'Gardener Insight' : 'Gardener System',
    latin_module: '',
    description_of_primary_action: entry.summary,
    roles_with_access: ['Gardener (Admin)'],
    related_tables: [],
    related_edge_functions: [],
  }));
}

/** Enrich a MODULE_ANATOMY entry with the latest summary from the registry (if a match exists). */
export function enrichModuleFromRegistry(moduleName: string): string | null {
  const match = GARDENER_NAV_REGISTRY.find((e) => e.title === moduleName);
  return match ? match.summary : null;
}

// ─────────────────────────────────────
// SECTION A — PAGE + ROUTE INVENTORY
// ─────────────────────────────────────

export interface RouteEntry {
  route_path: string;
  display_name: string;
  sidebar_group: string;
  latin_module: string;
  description_of_primary_action: string;
  roles_with_access: string[];
  related_tables: string[];
  related_edge_functions: string[];
}

export const ROUTE_INVENTORY: RouteEntry[] = [
  // ── Marketing / Public ──
  { route_path: '/', display_name: 'Home / Landing', sidebar_group: 'Public', latin_module: '', description_of_primary_action: 'Root redirect — marketing or tenant dashboard', roles_with_access: ['Public'], related_tables: [], related_edge_functions: [] },
  { route_path: '/manifesto', display_name: 'Manifesto', sidebar_group: 'Public', latin_module: '', description_of_primary_action: 'Brand manifesto page', roles_with_access: ['Public'], related_tables: [], related_edge_functions: [] },
  { route_path: '/pricing', display_name: 'Pricing', sidebar_group: 'Public', latin_module: '', description_of_primary_action: 'Tier comparison and Stripe checkout', roles_with_access: ['Public'], related_tables: ['billing_products'], related_edge_functions: ['create-checkout'] },
  { route_path: '/archetypes', display_name: 'Mission Archetypes', sidebar_group: 'Public', latin_module: '', description_of_primary_action: 'Choose organizational archetype', roles_with_access: ['Public'], related_tables: ['archetypes', 'archetype_profiles'], related_edge_functions: [] },
  { route_path: '/roles', display_name: 'Roles Overview', sidebar_group: 'Public', latin_module: '', description_of_primary_action: 'Shepherd / Companion / Visitor role landing pages', roles_with_access: ['Public'], related_tables: [], related_edge_functions: [] },
  { route_path: '/nri', display_name: 'NRI (Neary)', sidebar_group: 'Public', latin_module: 'NRI', description_of_primary_action: 'Narrative Relational Intelligence feature page', roles_with_access: ['Public'], related_tables: [], related_edge_functions: [] },

  // ── Auth ──
  { route_path: '/login', display_name: 'Login', sidebar_group: 'Auth', latin_module: '', description_of_primary_action: 'User authentication', roles_with_access: ['Public'], related_tables: ['profiles'], related_edge_functions: [] },
  { route_path: '/signup', display_name: 'Sign Up', sidebar_group: 'Auth', latin_module: '', description_of_primary_action: 'Create account + Stripe subscription', roles_with_access: ['Public'], related_tables: ['profiles', 'tenants', 'tenant_users'], related_edge_functions: ['create-checkout'] },
  { route_path: '/onboarding', display_name: 'Onboarding', sidebar_group: 'Auth', latin_module: '', description_of_primary_action: 'Post-checkout archetype + metro setup', roles_with_access: ['Authenticated'], related_tables: ['tenants', 'metros', 'profiles'], related_edge_functions: [] },

  // ── Tenant: Metros (Civitas) ──
  { route_path: '/:tenantSlug/metros', display_name: 'Metros', sidebar_group: 'Metros', latin_module: 'Civitas', description_of_primary_action: 'View and manage metro areas', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['metros', 'metro_momentum_signals'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/metros/:metroId', display_name: 'Metro Detail', sidebar_group: 'Metros', latin_module: 'Civitas', description_of_primary_action: 'Deep-dive into a single metro', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['metros', 'local_pulse_sources', 'metro_drift_scores'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/metros/narratives', display_name: 'Metro Narratives', sidebar_group: 'Metros', latin_module: 'Civitas', description_of_primary_action: 'AI-generated metro narrative reports', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['metro_narrative_cache', 'metro_news_articles'], related_edge_functions: ['metro-narrative-generate'] },
  { route_path: '/:tenantSlug/intel-feed', display_name: 'Intel Feed', sidebar_group: 'Metros', latin_module: 'Signum', description_of_primary_action: 'Aggregated intelligence signals', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['org_watchlist_signals', 'local_pulse_events'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/momentum', display_name: 'Momentum Map', sidebar_group: 'Metros', latin_module: 'Civitas', description_of_primary_action: 'Geographic momentum heat map', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['metro_momentum_signals'], related_edge_functions: [] },

  // ── Tenant: Partners ──
  { route_path: '/:tenantSlug/opportunities', display_name: 'Partners', sidebar_group: 'Partners', latin_module: '', description_of_primary_action: 'Manage organizational partnerships', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['opportunities', 'contacts'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/radar', display_name: 'Radar', sidebar_group: 'Partners', latin_module: 'Signum', description_of_primary_action: 'Relationship radar — stale and drifting partners', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['opportunities', 'activities'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/pipeline', display_name: 'Pipeline', sidebar_group: 'Partners', latin_module: '', description_of_primary_action: 'Anchor pipeline management (Kanban view)', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['anchor_pipeline'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/anchors', display_name: 'Anchors', sidebar_group: 'Partners', latin_module: '', description_of_primary_action: 'Stable producer relationship tracking', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['anchors'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/provisions', display_name: 'Prōvīsiō', sidebar_group: 'Partners', latin_module: 'Prōvīsiō', description_of_primary_action: 'Technology provisions requests and fulfillment', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['provisions', 'provision_items'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/people', display_name: 'People', sidebar_group: 'Partners', latin_module: '', description_of_primary_action: 'Contact directory with relationship context', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['contacts'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/people/find', display_name: 'Find People', sidebar_group: 'Partners', latin_module: 'Signum', description_of_primary_action: 'Discovery search for new contacts', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['contacts'], related_edge_functions: ['find-people'] },
  { route_path: '/:tenantSlug/graph', display_name: 'Relationship Graph', sidebar_group: 'Partners', latin_module: '', description_of_primary_action: 'Visual network graph of relationships', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['contacts', 'opportunities'], related_edge_functions: [] },

  // ── Tenant: Scheduling ──
  { route_path: '/:tenantSlug/calendar', display_name: 'Calendar', sidebar_group: 'Scheduling', latin_module: '', description_of_primary_action: 'Unified calendar of activities + events', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['activities', 'events'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/events', display_name: 'Events', sidebar_group: 'Scheduling', latin_module: '', description_of_primary_action: 'Community events management', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['events'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/events/find', display_name: 'Find Events', sidebar_group: 'Scheduling', latin_module: 'Signum', description_of_primary_action: 'Discover events in the community', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['local_pulse_events'], related_edge_functions: ['local-pulse-ingest'] },
  { route_path: '/:tenantSlug/activities', display_name: 'Activities', sidebar_group: 'Scheduling', latin_module: '', description_of_primary_action: 'Log relationship activities (calls, meetings, visits)', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['activities'], related_edge_functions: [] },

  // ── Tenant: Outreach ──
  { route_path: '/:tenantSlug/outreach/campaigns', display_name: 'Campaigns', sidebar_group: 'Outreach', latin_module: 'Relatio', description_of_primary_action: 'Email campaign builder and send', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['email_campaigns', 'email_campaign_recipients'], related_edge_functions: ['gmail-send-campaign'] },

  // ── Tenant: Grants ──
  { route_path: '/:tenantSlug/grants', display_name: 'Grants', sidebar_group: 'Grants', latin_module: '', description_of_primary_action: 'Grant tracking and pipeline', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['grants'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/grants/find', display_name: 'Find Grants', sidebar_group: 'Grants', latin_module: 'Signum', description_of_primary_action: 'Discover grant opportunities', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['grants'], related_edge_functions: [] },

  // ── Tenant: Volunteers (under Partners) & Import (under Admin) ──
  { route_path: '/:tenantSlug/volunteers', display_name: 'Voluntārium', sidebar_group: 'Partners', latin_module: 'Voluntārium', description_of_primary_action: 'Volunteer management and hour tracking', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['volunteers', 'volunteer_shifts'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/import', display_name: 'Import Center', sidebar_group: 'Admin', latin_module: 'Relatio', description_of_primary_action: 'Bulk data import from CSV or connectors', roles_with_access: ['Steward'], related_tables: ['import_jobs'], related_edge_functions: ['import-process'] },

  // ── Tenant: Relatio ──
  { route_path: '/:tenantSlug/relatio', display_name: 'Relatio Marketplace', sidebar_group: 'Relatio', latin_module: 'Relatio', description_of_primary_action: 'Integration connectors and migration bridges', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['relatio_connectors', 'import_jobs'], related_edge_functions: [] },

  // ── Tenant: Communio ──
  { route_path: '/:tenantSlug/communio', display_name: 'Communio', sidebar_group: 'Communio', latin_module: 'Communio', description_of_primary_action: 'Inter-org collaboration network', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['communio_groups', 'communio_memberships', 'communio_shared_signals'], related_edge_functions: [] },

  // ── Tenant: Standalone ──
  { route_path: '/:tenantSlug/dashboard', display_name: 'Command Center', sidebar_group: 'Home', latin_module: '', description_of_primary_action: 'Relationship-first dashboard with Relationship Signals (email follow-up suggestions gated to steward/shepherd/companion)', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['opportunities', 'activities', 'events', 'email_task_suggestions'], related_edge_functions: ['email-actionitems-accept', 'email-actionitems-dismiss'] },
  { route_path: '/:tenantSlug/testimonium', display_name: 'Testimonium', sidebar_group: 'Standalone', latin_module: 'Testimonium', description_of_primary_action: 'Narrative storytelling reports and exports', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['testimonium_events', 'testimonium_rollups'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/impulsus', display_name: 'Impulsus', sidebar_group: 'Standalone', latin_module: 'Impulsus', description_of_primary_action: 'Private impact scrapbook journal', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['impulsus_entries'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/intelligence', display_name: 'Movement Intelligence', sidebar_group: 'Standalone', latin_module: '', description_of_primary_action: 'Territory-aware movement metrics — care, presence, and narrative threads', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['activities', 'events', 'contacts', 'life_events', 'territories'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/reports', display_name: 'Reports', sidebar_group: 'Standalone', latin_module: '', description_of_primary_action: 'Executive reports and impact exports', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['opportunities', 'events'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/visits', display_name: 'Visits', sidebar_group: 'Visitor', latin_module: '', description_of_primary_action: 'Mobile-first volunteer field experience', roles_with_access: ['Visitor', 'Companion', 'Shepherd', 'Steward'], related_tables: ['activities', 'field_notes'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/field-notes', display_name: 'Field Notes', sidebar_group: 'Visitor', latin_module: '', description_of_primary_action: 'Voice-to-transcript field notes', roles_with_access: ['Visitor', 'Companion', 'Shepherd', 'Steward'], related_tables: ['field_notes'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/settings', display_name: 'Settings', sidebar_group: 'Standalone', latin_module: '', description_of_primary_action: 'Tenant and profile settings including relational orientation, richness levels, and seasonal echo toggles', roles_with_access: ['Steward', 'Shepherd', 'Companion', 'Visitor'], related_tables: ['tenant_settings', 'profiles', 'tenants', 'tenant_orientation_audit'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/help', display_name: 'Help', sidebar_group: 'Standalone', latin_module: '', description_of_primary_action: 'Documentation, changelog, and tutorials', roles_with_access: ['Steward', 'Shepherd', 'Companion', 'Visitor'], related_tables: [], related_edge_functions: [] },
  { route_path: '/:tenantSlug/assessment/enneagram', display_name: 'Enneagram Assessment', sidebar_group: 'Standalone', latin_module: 'Indoles', description_of_primary_action: 'Self-guided 36-question personality assessment', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['contacts', 'profiles', 'volunteers'], related_edge_functions: [] },

  // ── Tenant: Companion Network ──
  { route_path: '/:tenantSlug/communio/caregiver-network', display_name: 'Companion Network', sidebar_group: 'Communio', latin_module: 'Communio', description_of_primary_action: 'Opt-in companion network — browse, connect, message with privacy-first mediation', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['caregiver_profiles', 'caregiver_network_requests', 'caregiver_network_messages', 'caregiver_network_reports'], related_edge_functions: [] },

  // ── Companion Absorption ──
  { route_path: '/:tenantSlug/settings#organizations', display_name: 'Your Organizations', sidebar_group: 'Settings', latin_module: '', description_of_primary_action: 'View organization memberships, accept invitations, and choose relationship handling strategy (private/move/copy)', roles_with_access: ['Steward', 'Shepherd', 'Companion', 'Visitor'], related_tables: ['companion_absorption_requests', 'tenant_users', 'tenant_invites'], related_edge_functions: ['companion-absorb'] },

  // ── Tenant: Admin ──
  { route_path: '/:tenantSlug/admin', display_name: 'Workspace Admin', sidebar_group: 'Admin', latin_module: '', description_of_primary_action: 'User management and workspace settings', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['tenant_users', 'user_roles'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/admin/activation', display_name: 'Activation Checklist', sidebar_group: 'Admin', latin_module: '', description_of_primary_action: 'Guided onboarding checklist', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['activation_checklists', 'activation_checklist_items'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/admin/how-to', display_name: 'Admin How-To', sidebar_group: 'Admin', latin_module: '', description_of_primary_action: 'Step-by-step administration guide', roles_with_access: ['Steward', 'Shepherd'], related_tables: [], related_edge_functions: [] },
  { route_path: '/:tenantSlug/admin/guided-activation', display_name: 'Guided Activation', sidebar_group: 'Admin', latin_module: '', description_of_primary_action: 'Schedule human-guided onboarding session', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['activation_sessions'], related_edge_functions: [] },

  // ── Operator (auto-derived from gardenerNavRegistry) ──
  ...deriveOperatorRoutes(),

  // ── Tenant: Phase 21 additions ──
  { route_path: '/:tenantSlug/projects', display_name: 'Projects (Good Work)', sidebar_group: 'Scheduling', latin_module: '', description_of_primary_action: 'Community service projects tracked as first-class activities', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['activities', 'activity_impact', 'activity_participants'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/narrative-threads', display_name: 'Narrative Threads', sidebar_group: 'Home', latin_module: '', description_of_primary_action: 'Weekly story threads assembled from reflections, visits, and signals', roles_with_access: ['Steward', 'Shepherd', 'Companion', 'Visitor'], related_tables: ['testimonium_events', 'field_notes'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/adoption', display_name: 'Adoption & Daily Rhythm', sidebar_group: 'Home', latin_module: '', description_of_primary_action: 'Narrative-first formation space for building daily rhythm across roles', roles_with_access: ['Steward', 'Shepherd', 'Companion', 'Visitor'], related_tables: ['app_event_stream'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/stats', display_name: 'My Stats', sidebar_group: 'Home', latin_module: '', description_of_primary_action: 'Personal activity summary and contribution metrics', roles_with_access: ['Steward', 'Shepherd', 'Companion', 'Visitor'], related_tables: ['activities', 'field_notes'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/playbooks', display_name: 'Playbooks', sidebar_group: 'Home', latin_module: '', description_of_primary_action: 'Reusable relationship guides and metro-specific procedures', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['ai_knowledge_documents'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/nri-guide', display_name: 'NRI Guide (Neary)', sidebar_group: 'Home', latin_module: 'NRI', description_of_primary_action: 'AI relationship assistant for questions and suggestions', roles_with_access: ['Steward', 'Shepherd', 'Companion'], related_tables: ['ai_chat_sessions', 'ai_chat_messages'], related_edge_functions: ['nri-chat'] },
  { route_path: '/:tenantSlug/recycle-bin', display_name: 'Recently Deleted', sidebar_group: 'Home', latin_module: '', description_of_primary_action: 'Recover soft-deleted records within 7 days', roles_with_access: ['Steward', 'Shepherd'], related_tables: ['opportunities', 'contacts', 'activities'], related_edge_functions: [] },
  { route_path: '/:tenantSlug/help-requests', display_name: 'Help Requests', sidebar_group: 'Home', latin_module: '', description_of_primary_action: 'Submit feedback, report issues, or request features', roles_with_access: ['Steward', 'Shepherd', 'Companion', 'Visitor'], related_tables: ['feedback'], related_edge_functions: [] },
];

// ─────────────────────────────────────
// SECTION B — ROLE MATRIX
// ─────────────────────────────────────

export interface RoleEntry {
  role: string;
  visible_navigation_groups: string[];
  visible_modules: string[];
  hidden_modules: string[];
  allowed_actions: string[];
  onboarding_entry_point: string;
}

export const ROLE_MATRIX: RoleEntry[] = [
  {
    role: 'Gardener (Admin)',
    visible_navigation_groups: ['All Gardener Console sections', 'Nexus workflows', 'System tools'],
    visible_modules: ['All modules — full platform visibility'],
    hidden_modules: [],
    allowed_actions: ['Manage all tenants', 'Impersonate users', 'Run QA sweeps', 'Deploy migrations', 'Manage billing', 'Override tenant settings', 'Send announcements'],
    onboarding_entry_point: '/operator',
  },
  {
    role: 'Steward (Tenant Admin)',
    visible_navigation_groups: ['Metros', 'Partners', 'Scheduling', 'Outreach', 'Grants', 'Community', 'Relatio', 'Communio', 'Admin'],
    visible_modules: ['All tenant modules', 'Testimonium', 'Impulsus', 'Movement Intelligence', 'Reports', 'Workspace Admin'],
    hidden_modules: ['Gardener Console'],
    allowed_actions: ['Manage workspace users', 'Configure settings', 'Change relational orientation', 'View all data', 'Run campaigns', 'Export data', 'Manage activation', 'Schedule guided sessions'],
    onboarding_entry_point: '/:tenantSlug/dashboard (Command Center)',
  },
  {
    role: 'Shepherd',
    visible_navigation_groups: ['Metros', 'Partners', 'Scheduling', 'Outreach', 'Grants', 'Community', 'Relatio', 'Communio', 'Admin'],
    visible_modules: ['Testimonium', 'Impulsus', 'Movement Intelligence', 'Reports', 'Communio', 'Relatio'],
    hidden_modules: ['Gardener Console'],
    allowed_actions: ['View and manage relationships', 'Run campaigns', 'Create reflections', 'Change relational orientation', 'View narrative reports', 'Manage volunteers', 'Access admin tools'],
    onboarding_entry_point: '/:tenantSlug/dashboard (Command Center)',
  },
  {
    role: 'Companion',
    visible_navigation_groups: ['Partners', 'Scheduling', 'Grants', 'Community'],
    visible_modules: ['Movement Intelligence'],
    hidden_modules: ['Gardener Console', 'Metros', 'Outreach', 'Relatio', 'Communio', 'Testimonium', 'Impulsus', 'Reports', 'Admin'],
    allowed_actions: ['Log activities', 'Manage contacts', 'Track events', 'Record volunteer hours', 'View assigned partners'],
    onboarding_entry_point: '/:tenantSlug/dashboard (Command Center)',
  },
  {
    role: 'Visitor',
    visible_navigation_groups: ['Visits (simplified mobile view)'],
    visible_modules: ['Visits', 'Field Notes'],
    hidden_modules: ['Metros', 'Partners', 'Pipeline', 'Anchors', 'Outreach', 'Grants', 'Movement Intelligence', 'Reports', 'Testimonium', 'Communio', 'Admin', 'Relatio', 'Impulsus'],
    allowed_actions: ['Log field visits', 'Record voice notes', 'View assigned activities'],
    onboarding_entry_point: '/:tenantSlug/visits',
  },
];

// ─────────────────────────────────────
// SECTION C — MODULE ANATOMY
// ─────────────────────────────────────

export interface ModuleEntry {
  system_module: string;
  latin_name: string;
  body_part_metaphor: string;
  primary_role: string;
  narrative_purpose: string;
  core_tables: string[];
  core_events: string[];
}

export const MODULE_ANATOMY: ModuleEntry[] = [
  { system_module: 'Testimonium', latin_name: 'Testimonium', body_part_metaphor: 'The Memory — long-term narrative recall', primary_role: 'Shepherd / Steward', narrative_purpose: 'Executive narrative layer that generates structured storytelling reports from relationship signals. Observes activity across modules and records deterministic signals into a witness spine.', core_tables: ['testimonium_events', 'testimonium_rollups'], core_events: ['journey_advanced', 'reflection_created', 'campaign_sent', 'event_completed', 'volunteer_logged', 'provision_fulfilled'] },
  { system_module: 'Communio', latin_name: 'Communio', body_part_metaphor: 'The Handshake — inter-organizational trust', primary_role: 'Steward / Shepherd', narrative_purpose: 'Collaboration network allowing organizations to share events, signals, and story heatmaps with trusted partners while maintaining data sovereignty.', core_tables: ['communio_groups', 'communio_memberships', 'communio_shared_events', 'communio_shared_signals', 'communio_governance_flags'], core_events: ['group_joined', 'signal_shared', 'event_shared'] },
  { system_module: 'Relatio', latin_name: 'Relatio', body_part_metaphor: 'The Bridge — connecting external systems', primary_role: 'Steward', narrative_purpose: 'Integration marketplace and migration bridges with 31+ connectors. Enables importing relationships from external CRMs and bi-directional sync for 7 connectors (HubSpot, Salesforce, Dynamics 365, Blackbaud RE NXT, Google Contacts, Outlook Contacts, CiviCRM) via direct Edge Function outbound architecture. Sync direction toggle and conflict resolution (Flag for review, CROS wins, Remote wins) managed by Steward. TurboTax-style setup guides and Dry-Run previews for safe onboarding.', core_tables: ['relatio_connectors', 'import_jobs', 'import_job_records', 'sync_conflicts', 'sync_direction_config', 'relatio_sync_config'], core_events: ['migration_started', 'migration_completed', 'connector_activated', 'sync_conflict_detected', 'outbound_sync_completed'] },
  { system_module: 'Impulsus', latin_name: 'Impulsus', body_part_metaphor: 'The Heart — private emotional resonance', primary_role: 'Shepherd', narrative_purpose: 'Private impact scrapbook journal where leaders capture moments of mission impact. Stories, photos, and reflections that never appear in public reports.', core_tables: ['impulsus_entries'], core_events: ['story_added', 'photo_added', 'reflection_added', 'quote_added'] },
  { system_module: 'Voluntārium', latin_name: 'Voluntārium', body_part_metaphor: 'The Hands — community labor and service', primary_role: 'Companion / Shepherd', narrative_purpose: 'Volunteer management system for tracking hours, skills, availability, and deployment across events and partner organizations.', core_tables: ['volunteers', 'volunteer_shifts'], core_events: ['volunteer_registered', 'hours_logged', 'shift_completed'] },
  { system_module: 'Prōvīsiō', latin_name: 'Prōvīsiō', body_part_metaphor: 'The Supply Chain — resource requests and fulfillment', primary_role: 'Companion / Shepherd', narrative_purpose: 'Internal technology provisioning system for requesting and tracking device deployments, internet signups, and resource allocation.', core_tables: ['provisions', 'provision_items'], core_events: ['provision_requested', 'provision_fulfilled'] },
  { system_module: 'Civitas (Territories)', latin_name: 'Civitas', body_part_metaphor: 'The Compass — geographic community awareness', primary_role: 'Shepherd / Steward', narrative_purpose: 'Territory-level community intelligence. Supports metros, county bundles, states, countries, and mission fields. Includes Local Pulse event discovery (keyword-driven Perplexity search + Firecrawl extraction), metro narratives, momentum mapping, and drift detection. County bundles offer fair rural pricing (5 counties = 1 slot). Mission fields are free under activated countries. Local Pulse uses a 4-layer keyword stack (global → archetype → enriched → steward) and includes awaiting-AI-parsing items in the UI.', core_tables: ['territories', 'tenant_territories', 'metros', 'local_pulse_sources', 'local_pulse_events', 'metro_narrative_cache', 'metro_drift_scores', 'metro_momentum_signals'], core_events: ['pulse_event_discovered', 'narrative_generated', 'drift_detected', 'territory_activated'] },
  { system_module: 'Signum (Discovery)', latin_name: 'Signum', body_part_metaphor: 'The Eyes — environmental awareness and discovery', primary_role: 'Shepherd', narrative_purpose: 'Territory-aware signal discovery engine. Filters by activated territories (metros, counties, states, countries, mission fields) with archetype-sensitive relevance scoring enhanced by sector alignment weighting. Rural orgs weighted fairly (county 0.85, state 0.7). Missionaries filter by country. Solo caregivers locked to base state. Sector tags (tenant_sectors) add a relevance weight modifier without filtering. Includes watchlist monitoring, organization discovery, friction detection, and intel feed aggregation.', core_tables: ['org_watchlist', 'org_watchlist_signals', 'org_watchlist_snapshots', 'territories', 'tenant_territories', 'sectors', 'tenant_sectors', 'content_reports'], core_events: ['signal_detected', 'friction_idle', 'watchlist_crawled', 'territory_relevance_scored'] },
  { system_module: 'Expansion Planning', latin_name: '', body_part_metaphor: 'The Roots — growing into new ground', primary_role: 'Steward / Gardener', narrative_purpose: 'Planning and tracking expansion into new metro areas. Readiness scoring, resource allocation, and milestone tracking for new community penetration.', core_tables: ['expansion_signals', 'metros'], core_events: ['expansion_ready', 'first_anchor_milestone'] },
  { system_module: 'Accessibility Mode', latin_name: '', body_part_metaphor: 'The Welcome Mat — ensuring every person can participate', primary_role: 'All roles', narrative_purpose: 'WCAG 2.2 AA compliant accessibility overlay. Activates high-contrast theme, enhanced focus rings, motion suppression, larger touch targets, skip navigation, and increased typography readability. Persisted to localStorage. Toggle in user menu. NRI Compass is fully keyboard navigable with screen reader support (role=log, aria-live regions), voice-to-text input, and simplified structured responses when active.', core_tables: [], core_events: ['a11y_mode_toggled'] },
  { system_module: 'Guided Activation', latin_name: '', body_part_metaphor: 'The Welcome Mat — gentle onboarding guidance', primary_role: 'Steward / Gardener', narrative_purpose: 'Human-guided onboarding sessions where Gardeners walk new tenants through their first week. Includes scheduling, preparation, and consent workflows.', core_tables: ['activation_sessions', 'activation_checklists', 'activation_checklist_items', 'activation_offers'], core_events: ['session_scheduled', 'session_completed', 'checklist_item_completed'] },
  { system_module: 'Gardener Nexus', latin_name: '', body_part_metaphor: 'The Watchtower — stewardship command cockpit', primary_role: 'Gardener', narrative_purpose: 'Workflow-driven mission control for platform stewards. Organized into eight primary workflows: Arrivals, Activation, QA, Migrations, Support, Expansion, Presence, and Knowledge.', core_tables: ['tenants', 'operator_tenant_stats', 'lumen_signals', 'automation_runs'], core_events: ['tenant_arrived', 'activation_delay', 'drift_risk', 'migration_fragility'] },
  { system_module: 'Lumen', latin_name: 'Lumen', body_part_metaphor: 'The Nervous System — cross-tenant health signals', primary_role: 'Gardener', narrative_purpose: 'Intelligent signal aggregation that surfaces risks and opportunities across all tenants. Detects drift, activation delays, volunteer dropoff, and narrative surges.', core_tables: ['lumen_signals'], core_events: ['drift_risk', 'activation_delay', 'migration_fragility', 'volunteer_dropoff', 'expansion_ready', 'narrative_surge'] },
  { system_module: 'Familia', latin_name: 'Familia', body_part_metaphor: 'The Family Tree — organizational kinship', primary_role: 'Steward', narrative_purpose: 'Organizational kinship model allowing tenants to declare parent-child or sibling relationships. NRI detects kinship patterns from shared metros, contacts, and provision activity.', core_tables: ['tenants', 'provisions'], core_events: ['familia_kinship', 'shared_resource_pattern'] },
  { system_module: 'Recovery & Restoration', latin_name: '', body_part_metaphor: 'The Safety Net — undo and restore', primary_role: 'Gardener / Steward', narrative_purpose: 'Action breadcrumbs and recovery ticket system. Tenants can request assistant-guided undo; Gardeners review and restore soft-deleted records.', core_tables: ['recovery_tickets', 'app_event_stream'], core_events: ['restoration', 'recovery_ticket_created'] },
  { system_module: 'Garden Pulse', latin_name: '', body_part_metaphor: 'The Observatory — ecosystem visual layers', primary_role: 'Gardener', narrative_purpose: 'Five-layer visual ecosystem view: Constellation (node graph), Atlas (geographic), Living Timeline (Ignatian ribbon), Seasonal Rhythm (liturgical cadence), and Storybook (emerging essays). Includes Providence and Compass overlays.', core_tables: ['tenants', 'metros', 'testimonium_events', 'lumen_signals'], core_events: ['narrative_surge', 'expansion_ready', 'drift_risk'] },
  { system_module: 'Gardener Examen', latin_name: '', body_part_metaphor: 'The Journal — contemplative daily rhythm', primary_role: 'Gardener', narrative_purpose: 'Morning and Evening contemplative oversight views. Morning orients through Noticing, Gratitude, Attention, Invitation. Evening reflects through Where Life Moved, Resistance, Quiet Growth, NRI Learning.', core_tables: ['gardener_insights', 'lumen_signals'], core_events: [] },
  { system_module: 'Gardener Studio', latin_name: '', body_part_metaphor: 'The Workshop — safe content editing', primary_role: 'Gardener', narrative_purpose: 'Tabbed editorial workspace with five tabs: Library (essays), Playbooks (knowledge docs), Voice & Tone (NRI calibration), Communio Directory (moderation), and Atlas (territory visualization). Admin settings (Switches, Gardeners, Notifications) now live in Platform Config. All changes are versioned and auditable.', core_tables: ['library_essays', 'ai_knowledge_documents', 'gardener_audit_log'], core_events: [] },
  { system_module: 'Content Pipeline', latin_name: '', body_part_metaphor: 'The Triage Desk — quick content scanning', primary_role: 'Gardener', narrative_purpose: 'Raw list view of editorial drafts and published content. Lightweight companion to the Garden Studio for scanning status, last edit dates, and identifying stale drafts.', core_tables: ['library_essays', 'ai_knowledge_documents'], core_events: [] },
  { system_module: 'Platform Config', latin_name: '', body_part_metaphor: 'The Control Panel — administrative settings', primary_role: 'Gardener', narrative_purpose: 'Central admin hub housing feature switches, gardener team management, notification templates, global keywords, archetype profiles, and metro news feeds. Previously split between Studio and standalone tabs.', core_tables: ['tenant_feature_flags', 'gardeners', 'gardener_scopes', 'gardener_notification_settings'], core_events: [] },
  { system_module: 'Calm Digest', latin_name: '', body_part_metaphor: 'The Morning Letter — daily narrative summary', primary_role: 'All roles', narrative_purpose: 'Role-aware Ignatian-structured email summaries. Stewards receive relationship signals, Shepherds receive metro pulse, Companions see partner updates, Visitors see visit suggestions.', core_tables: ['tenant_digest_preferences'], core_events: [] },
  { system_module: 'Projects (Good Work)', latin_name: '', body_part_metaphor: 'The Workshop Floor — community service in action', primary_role: 'Companion / Shepherd', narrative_purpose: 'Community service projects modeled as first-class activity types. Enables tracking of project-based work alongside individual relationship activities.', core_tables: ['activities', 'activity_impact', 'activity_participants'], core_events: ['good_work_in_motion'] },
  { system_module: 'Compass Posture (CROS Companion)', latin_name: '', body_part_metaphor: 'The Compass — orientation through presence', primary_role: 'All roles', narrative_purpose: 'The CROS Companion launcher uses a compass icon that glows softly when helpful movement is detected. Inside the drawer, a posture label (Care, Narrative, Discernment, Restoration) is always visible, shifting with route and recent actions. Posture teaches users orientation without gamification.', core_tables: ['app_event_stream'], core_events: ['entity_created', 'entity_deleted', 'entity_restored', 'import_completed', 'publish'] },
  { system_module: 'Impact Dimensions', latin_name: '', body_part_metaphor: 'The Measuring Cup — structured impact capture', primary_role: 'Steward / Shepherd', narrative_purpose: 'Tenant-configurable structured metrics that attach to events, activities, and provisions. Aggregated totals feed NRI narrative rollups and public movement sharing (counts only). Guardrails prevent bloat (max 12 per entity type).', core_tables: ['impact_dimensions', 'impact_dimension_values'], core_events: ['impact_value_saved'] },
  { system_module: 'Gardener Team', latin_name: '', body_part_metaphor: 'The Council — distributed stewardship', primary_role: 'Gardener', narrative_purpose: 'Multi-gardener assignment system with scope-based routing. Tickets route through a 6-step ladder (explicit → metro → archetype → specialty → on-call → primary). Each gardener has a calm inbox and configurable notification preferences.', core_tables: ['gardeners', 'gardener_scopes', 'tenant_gardener_assignments', 'gardener_notification_settings'], core_events: ['ticket_routed', 'gardener_assigned'] },
  { system_module: 'Companion System', latin_name: '', body_part_metaphor: 'The Gentle Hand — dignified accompaniment memory', primary_role: 'Companion / Shepherd', narrative_purpose: 'Companion logging with per-entry privacy toggles, season summaries (versioned, narrative), and completion rituals. Designed for mentors, sponsors, caregivers, spiritual directors, coaches, and anyone who walks closely with others. Solo tier provides free private workspace; organization archetype adds leadership visibility (counts only) with dignity-first controls.', core_tables: ['activities', 'contacts', 'season_summaries'], core_events: ['care_log_created', 'season_summary_generated', 'care_completed'] },
  { system_module: 'Relational Orientation', latin_name: '', body_part_metaphor: 'The Lens — how the workspace sees relationships', primary_role: 'Steward / Shepherd', narrative_purpose: 'Tenants declare a relational orientation (human_focused, institution_focused, or hybrid) that controls UI richness density, compass signal weighting, and narrative phrasing. People and Partner detail pages adapt between flat (richness 1) and tabbed (richness 3) layouts. Orientation changes are audited via tenant_orientation_audit. Auto-manage mode lets richness follow orientation defaults.', core_tables: ['tenants', 'entity_richness_overrides', 'tenant_orientation_audit'], core_events: ['orientation_changed'] },
  { system_module: 'Seasonal Echo', latin_name: '', body_part_metaphor: 'The Calendar — recurring rhythms and anniversaries', primary_role: 'Steward / Shepherd', narrative_purpose: 'Conservative pattern detection for recurring rhythms, anniversaries, and cyclical activity. Archive candidates surface gently in the Compass drawer (SeasonalEchoCard) when enabled. Zero candidates is a valid outcome — no noise. Generates Ignatian-structured reflection drafts (Noticing, Gratitude, Movement, Invitation).', core_tables: ['archive_suggestion_candidates', 'archive_reflections', 'narrative_influence_events'], core_events: ['seasonal_echo_detected', 'archive_reflection_created'] },
  { system_module: 'Polymorphic Life Events', latin_name: '', body_part_metaphor: 'The Milestone Stones — marking the journey', primary_role: 'All roles', narrative_purpose: 'Life events support both Person and Partner entities via canonical (entity_type, entity_id) columns. CHECK constraints enforce type safety and person_id shadow sync. Trigger maintains backward compatibility. Supports milestones like sobriety, marriage, organizational mergers. Death events shift Compass toward Restoration and prompt private remembrance.', core_tables: ['life_events'], core_events: ['life_event_recorded'] },
  { system_module: 'Indoles', latin_name: 'Indoles', body_part_metaphor: 'The Temperament — personality and natural disposition', primary_role: 'All roles', narrative_purpose: 'Personality intelligence layer providing Enneagram assessments (36-question Likert), CliftonStrengths, DISC, birthday tracking with automatic zodiac derivation (DB trigger), and extended bio fields (skills, languages, interests). Privacy defaults to private. NRI Compass receives birthday nudges and personality context for relational pairing suggestions. Zodiac metadata is system-internal.', core_tables: ['contacts', 'profiles', 'volunteers'], core_events: ['birthday_upcoming', 'assessment_completed'] },
  { system_module: 'Providence Engine', latin_name: '', body_part_metaphor: 'The Seasons — long-arc relational reflection', primary_role: 'Steward / Shepherd', narrative_purpose: 'Synthesizes quarterly arc movements into Ignatian seasonal reflections. Three outputs: private narrative, shareable PDF, anonymized constellation signal. Deterministic rule-based analysis (direction matrix, life event clusters, rhythm patterns) with single AI call for phrasing only. Reports are versioned and never overwritten. Includes a Subtle Revelation Layer: when a meaningful arc shift occurs (threshold crossing, re-emergence, first activation, restorative shift), a 30-day revelation window subtly adjusts Compass tone and inserts one contemplative nudge per session. No alerts, no modals, no urgency.', core_tables: ['providence_reports', 'providence_constellation_signals'], core_events: ['providence_generated'] },
];

// ─────────────────────────────────────
// SECTION D — CORE WORKFLOWS
// ─────────────────────────────────────

export interface WorkflowEntry {
  flow_name: string;
  entry_page: string;
  exit_page: string;
  roles: string[];
  signals_generated: string[];
  automation_points: string[];
}

export const CORE_WORKFLOWS: WorkflowEntry[] = [
  { flow_name: 'First Login → Onboarding → Dashboard', entry_page: '/pricing', exit_page: '/:tenantSlug/dashboard', roles: ['Any authenticated user'], signals_generated: ['testimonium: first_login', 'lumen: tenant_arrived'], automation_points: ['Stripe checkout webhook', 'Tenant + metro provisioning', 'Auto steward role assignment'] },
  { flow_name: 'Visitor Voice Note → Activity Creation → NRI Signal', entry_page: '/:tenantSlug/visits', exit_page: '/:tenantSlug/activities', roles: ['Visitor', 'Companion'], signals_generated: ['testimonium: field_note_created', 'signum: friction_idle (if inactive)'], automation_points: ['Voice-to-transcript processing', 'Activity auto-creation from transcript'] },
  { flow_name: 'Add Opportunity → Journey Movement', entry_page: '/:tenantSlug/opportunities', exit_page: '/:tenantSlug/opportunities/:slug', roles: ['Shepherd', 'Companion', 'Steward'], signals_generated: ['testimonium: journey_advanced', 'auto pipeline creation on Discovery Held'], automation_points: ['Auto-advance stage on email sent', 'Auto-advance on attended activity', 'Pipeline entry auto-creation'] },
  { flow_name: 'Campaign Send → Unsubscribe Handling', entry_page: '/:tenantSlug/outreach/campaigns', exit_page: '/:tenantSlug/outreach/campaigns/:id', roles: ['Shepherd', 'Steward'], signals_generated: ['testimonium: campaign_sent'], automation_points: ['Gmail API send', 'Unsubscribe webhook processing', 'Stage advance on email communication'] },
  { flow_name: 'Migration → Activation', entry_page: '/:tenantSlug/relatio', exit_page: '/:tenantSlug/admin/activation', roles: ['Steward'], signals_generated: ['testimonium: migration_started', 'testimonium: migration_completed'], automation_points: ['CSV parsing and validation', 'Duplicate detection', 'Field mapping'] },
  { flow_name: 'Expansion Planning Flow', entry_page: '/:tenantSlug/momentum', exit_page: '/:tenantSlug/metros', roles: ['Steward', 'Shepherd'], signals_generated: ['expansion_ready signal', 'first_anchor milestone'], automation_points: ['Momentum materialized view refresh', 'Milestone trigger on anchor creation'] },
  { flow_name: 'Volunteer Registration → Hour Logging', entry_page: '/:tenantSlug/volunteers', exit_page: '/:tenantSlug/volunteer-hours-inbox', roles: ['Companion', 'Shepherd', 'Steward'], signals_generated: ['testimonium: volunteer_registered', 'testimonium: hours_logged'], automation_points: ['Stats auto-recomputation trigger', 'Shift validation'] },
  { flow_name: 'Gardener New Arrival Stewardship', entry_page: '/operator/nexus/arrival', exit_page: '/operator/tenants/:id', roles: ['Gardener'], signals_generated: ['lumen: tenant_arrived'], automation_points: ['48h arrival detection query', 'Guidance checklist dynamic rendering', 'Impersonation routing'] },
  { flow_name: 'Recovery Ticket → Gardener Restoration', entry_page: '/:tenantSlug (NRI assistant)', exit_page: '/operator/nexus/recovery', roles: ['Any user', 'Gardener'], signals_generated: ['restoration'], automation_points: ['Action breadcrumb capture', 'Recovery ticket creation', 'Gardener notification'] },
  { flow_name: 'Project Creation → Impact Logging', entry_page: '/:tenantSlug/projects', exit_page: '/:tenantSlug/activities', roles: ['Companion', 'Shepherd', 'Steward'], signals_generated: ['testimonium: good_work_in_motion'], automation_points: ['Activity-type project creation', 'Participant assignment', 'Impact metric capture'] },
  { flow_name: 'Narrative Thread Assembly', entry_page: '/:tenantSlug/narrative-threads', exit_page: '/:tenantSlug/narrative-threads', roles: ['Steward', 'Shepherd'], signals_generated: ['testimonium: narrative_surge'], automation_points: ['Weekly reflection aggregation', 'Visit + signal weaving', 'Thread auto-assembly'] },
  { flow_name: 'Companion Log → Season Summary', entry_page: '/:tenantSlug/activities', exit_page: '/:tenantSlug/people/:slug', roles: ['Companion', 'Shepherd', 'Steward'], signals_generated: ['care_log_created', 'season_summary_generated'], automation_points: ['Activity creation with privacy toggle', 'AI-assisted summary generation', 'Version control on summaries'] },
  { flow_name: 'Companion Completion → Archive', entry_page: '/:tenantSlug/people/:slug', exit_page: '/:tenantSlug/people', roles: ['Companion', 'Shepherd', 'Steward'], signals_generated: ['care_completed'], automation_points: ['Closing reflection capture', 'Final season summary generation', 'Person archive with constellation memory'] },
  { flow_name: 'Bi-Directional Sync → Conflict Review', entry_page: '/:tenantSlug/admin/integrations', exit_page: '/:tenantSlug/admin/integrations', roles: ['Steward'], signals_generated: ['sync_conflict_detected', 'outbound_sync_completed'], automation_points: ['Webhook-driven inbound/outbound sync', 'Conflict detection via OutboundAdapter.detectConflicts()', 'Flag-for-review conflict resolution'] },
];

// ─────────────────────────────────────
// SECTION E — SIDEBAR STRUCTURE BY ROLE
// ─────────────────────────────────────

export interface SidebarGroup {
  group: string;
  items: string[];
  visible_to: string[];
}

export const SIDEBAR_STRUCTURE: SidebarGroup[] = [
  { group: 'Home', items: ['Command Center'], visible_to: ['Steward', 'Shepherd', 'Companion'] },
  { group: 'Territories (Civitas)', items: ['Territories', 'Metros', 'Intel Feed', 'Metro Narratives', 'Momentum Map'], visible_to: ['Steward', 'Shepherd'] },
  { group: 'Partners', items: ['Partners (Opportunities)', 'Radar', 'Pipeline', 'Anchors', 'Prōvīsiō', 'People', 'Find People', 'Relationship Graph'], visible_to: ['Steward', 'Shepherd', 'Companion'] },
  { group: 'Scheduling', items: ['Calendar', 'Events', 'Find Events', 'Activities'], visible_to: ['Steward', 'Shepherd', 'Companion'] },
  { group: 'Outreach', items: ['Campaigns'], visible_to: ['Steward', 'Shepherd'] },
  { group: 'Grants', items: ['Grants', 'Find Grants'], visible_to: ['Steward', 'Shepherd', 'Companion'] },
  { group: 'Community', items: ['Voluntārium', 'Import Center'], visible_to: ['Steward', 'Shepherd', 'Companion'] },
  { group: 'Relatio', items: ['Relatio Marketplace'], visible_to: ['Steward', 'Shepherd'] },
  { group: 'Communio', items: ['Communio Network'], visible_to: ['Steward', 'Shepherd'] },
  { group: 'Admin', items: ['Workspace Admin', 'Activation Checklist', 'Admin How-To', 'Guided Activation'], visible_to: ['Steward', 'Shepherd'] },
  { group: 'Standalone', items: ['Testimonium', 'Impulsus', 'Movement Intelligence', 'Reports', 'Settings', 'Help', 'My Stats', 'NRI Guide', 'Help Requests', 'Recently Deleted'], visible_to: ['Varies per item'] },
  { group: 'Visitor View', items: ['Visits', 'Field Notes'], visible_to: ['Visitor'] },
  { group: 'Formation', items: ['Adoption & Daily Rhythm', 'Narrative Threads', 'Playbooks', 'Projects (Good Work)'], visible_to: ['Steward', 'Shepherd', 'Companion', 'Visitor (limited)'] },
  { group: 'Accompaniment (Companion)', items: ['Companion Logging', 'Season Summaries', 'Companion Completion', 'People'], visible_to: ['Steward', 'Shepherd', 'Companion'] },
];

// ─────────────────────────────────────
// SECTION F — NRI + TESTIMONIUM SIGNAL TYPES
// ─────────────────────────────────────

export interface SignalEntry {
  signal_type: string;
  trigger_event: string;
  visible_surface: string;
  operator_visibility: string;
}

export const SIGNAL_TYPES: SignalEntry[] = [
  { signal_type: 'momentum', trigger_event: 'Metro momentum materialized view refresh', visible_surface: 'Momentum Map, Metro Detail', operator_visibility: 'Nexus Expansion Watch' },
  { signal_type: 'drift_risk', trigger_event: 'Metro drift score exceeds threshold', visible_surface: 'Metro Detail sidebar, Radar', operator_visibility: 'Nexus Lumen, Friction panel' },
  { signal_type: 'reconnection', trigger_event: 'Activity logged after extended silence', visible_surface: 'Radar, Intel Feed', operator_visibility: 'Nexus Lumen' },
  { signal_type: 'growth', trigger_event: 'Partner advances pipeline stage or hits volume milestone', visible_surface: 'Pipeline, Partner Detail', operator_visibility: 'Nexus Expansion' },
  { signal_type: 'activation_delay', trigger_event: 'Tenant has not completed activation checklist within expected window', visible_surface: 'N/A (Gardener only)', operator_visibility: 'Nexus Lumen, Nexus Activation' },
  { signal_type: 'migration_fragility', trigger_event: 'Import job has high error rate or stalled', visible_surface: 'N/A (Gardener only)', operator_visibility: 'Nexus Lumen, Nexus Migrations' },
  { signal_type: 'volunteer_dropoff', trigger_event: 'Active volunteer has not logged hours in threshold period', visible_surface: 'Volunteer Detail card', operator_visibility: 'Nexus Lumen' },
  { signal_type: 'expansion_ready', trigger_event: 'Metro readiness index passes threshold', visible_surface: 'Momentum Map', operator_visibility: 'Nexus Expansion Watch' },
  { signal_type: 'narrative_surge', trigger_event: 'Spike in testimonium_events for a tenant in a short window', visible_surface: 'Testimonium dashboard', operator_visibility: 'Nexus Lumen' },
  { signal_type: 'friction_idle', trigger_event: 'User session idle past threshold (Signum hook)', visible_surface: 'N/A (telemetry)', operator_visibility: 'Nexus Signum/Friction' },
  { signal_type: 'friction_rage_click', trigger_event: 'Rapid repeated clicks detected by Signum', visible_surface: 'N/A (telemetry)', operator_visibility: 'Nexus Signum/Friction' },
  { signal_type: 'tenant_arrived', trigger_event: 'New tenant created (organic or Gardener-granted)', visible_surface: 'N/A (Gardener only)', operator_visibility: 'Nexus New Arrivals' },
  { signal_type: 'first_anchor', trigger_event: 'First anchor created in a metro', visible_surface: 'Momentum Map, Metro Detail milestone badge', operator_visibility: 'Nexus Expansion' },
  { signal_type: 'restoration', trigger_event: 'Entity restored from recycle bin', visible_surface: 'Garden Pulse (gold accents)', operator_visibility: 'Nexus Recovery & Restoration' },
  { signal_type: 'familia_kinship', trigger_event: 'NRI detects potential organizational kinship', visible_surface: 'Settings Familia card', operator_visibility: 'Gardener Insights' },
  { signal_type: 'care_pattern_emerging', trigger_event: 'Provision activity suggests community care trend', visible_surface: 'Prōvīsiō', operator_visibility: 'Gardener Insights' },
  { signal_type: 'good_work_in_motion', trigger_event: '3+ projects/week with story density', visible_surface: 'Activities, Testimonium', operator_visibility: 'Gardener Good Work Pulse' },
  { signal_type: 'shared_resource_pattern', trigger_event: 'Cross-Familia provision pattern detected', visible_surface: 'Familia Stewardship card', operator_visibility: 'Gardener Insights' },
  { signal_type: 'compass_glow', trigger_event: 'Recent action breadcrumb triggers companion glow (entity_created, entity_deleted, import_completed, publish)', visible_surface: 'Floating compass launcher button', operator_visibility: 'N/A (client-side only)' },
  { signal_type: 'ticket_routed', trigger_event: 'Recovery/support ticket auto-routed to gardener via routing ladder', visible_surface: 'Gardener Inbox', operator_visibility: 'Gardener Inbox' },
  { signal_type: 'impact_value_saved', trigger_event: 'Tenant saves structured impact metric on event/activity/provision', visible_surface: 'Reports Impact section, NRI rollups', operator_visibility: 'N/A (tenant-only)' },
  { signal_type: 'care_log_created', trigger_event: 'Caregiver logs a care visit or check-in activity', visible_surface: 'Activities, Season Summaries', operator_visibility: 'N/A (tenant-only)' },
  { signal_type: 'season_summary_generated', trigger_event: 'AI-assisted season summary created for a person record', visible_surface: 'Person Detail, Season Summaries', operator_visibility: 'N/A (tenant-only)' },
  { signal_type: 'care_completed', trigger_event: 'Person marked as care_completed via completion ritual', visible_surface: 'Person Detail, Constellation memory', operator_visibility: 'Gardener Insights (archetype trends)' },
  { signal_type: 'life_event_recorded', trigger_event: 'Structured life event (birth, marriage, death, etc.) recorded on a person or partner via polymorphic (entity_type, entity_id) schema', visible_surface: 'Person/Partner Detail, Compass, Constellation', operator_visibility: 'Gardener Insights (archetype trends)' },
  { signal_type: 'orientation_changed', trigger_event: 'Steward or Shepherd changes tenant relational orientation via Settings', visible_surface: 'Settings confirmation, Compass recalibration', operator_visibility: 'Tenant audit trail (tenant_orientation_audit)' },
  { signal_type: 'seasonal_echo_detected', trigger_event: 'Archive scan detects recurring pattern (anniversary, cyclical, seasonal) from historical data', visible_surface: 'Compass drawer (SeasonalEchoCard, when enabled)', operator_visibility: 'N/A (tenant-only)' },
  { signal_type: 'sync_conflict_detected', trigger_event: 'Bi-directional sync detects conflicting field values between CROS and external CRM', visible_surface: 'Integrations page (Steward)', operator_visibility: 'Nexus Migrations' },
  { signal_type: 'outbound_sync_completed', trigger_event: 'CROS data successfully written back to external CRM (Dynamics 365 or Salesforce)', visible_surface: 'Integration sync log', operator_visibility: 'N/A (tenant-only)' },
  { signal_type: 'territory_activated', trigger_event: 'Tenant activates a territory (metro, county bundle, state, or country) during onboarding or settings', visible_surface: 'Territory list, Atlas', operator_visibility: 'Nexus Expansion Watch' },
  { signal_type: 'territory_relevance_scored', trigger_event: 'Discovery result scored against activated territories using archetype-aware relevance weights', visible_surface: 'Find People, Find Events, Find Grants', operator_visibility: 'Discovery Insights' },
  { signal_type: 'content_reported', trigger_event: 'User reports a Communio profile or shared content via ReportProfileButton', visible_surface: 'N/A (admin review)', operator_visibility: 'Nexus Support' },
];

// ─────────────────────────────────────
// SECTION G — GARDENER NEXUS WORKFLOWS
// ─────────────────────────────────────

export interface NexusWorkflowEntry {
  workflow: string;
  purpose: string;
  data_sources: string[];
  primary_actions: string[];
  alerts_or_signals: string[];
}

export const NEXUS_WORKFLOWS: NexusWorkflowEntry[] = [
  { workflow: 'New Arrivals', purpose: 'Stewardship moment for newly signed-up organizations. Provides calm, actionable guidance with zero technical noise.', data_sources: ['tenants (created_at < 48h)', 'operator_tenant_stats', 'testimonium_events', 'guided_activation_sessions'], primary_actions: ['View arrival summary', 'Follow dynamic guidance checklist', 'Login as tenant admin', 'Open activation session', 'Send welcome message'], alerts_or_signals: ['tenant_arrived', 'Operator Sponsored badge for granted accounts'] },
  { workflow: 'Activation', purpose: 'Guide tenants through their first-week setup. Track checklist completion and schedule human-led onboarding.', data_sources: ['activation_checklists', 'activation_checklist_items', 'activation_sessions', 'activation_offers'], primary_actions: ['Monitor checklist progress', 'Schedule guided sessions', 'Manage activation offers', 'Track consent status'], alerts_or_signals: ['activation_delay'] },
  { workflow: 'QA & Stability', purpose: 'Automated quality assurance and self-healing. Monitor system sweeps, automation health, and error rates.', data_sources: ['automation_runs', 'automation_health_summary'], primary_actions: ['View sweep results', 'Retry failed runs', 'Mark stuck runs as failed', 'Review error desk'], alerts_or_signals: ['Stuck run detection', 'Error rate spikes'] },
  { workflow: 'Migrations & Integrations', purpose: 'Monitor and support data migrations from external CRMs, connector activations, and bi-directional sync for HubSpot, Salesforce, and Microsoft Dynamics 365.', data_sources: ['import_jobs', 'import_job_records', 'relatio_connectors', 'sync_conflicts', 'sync_direction_config'], primary_actions: ['View migration progress', 'Debug import errors', 'Manage connector configs', 'Review sync conflicts', 'Configure outbound sync direction'], alerts_or_signals: ['migration_fragility', 'sync_conflict_detected'] },
  { workflow: 'Support & Care', purpose: 'Tenant support inbox for feedback, bug reports, and feature requests.', data_sources: ['feedback', 'feedback_audit_log', 'feedback_notifications'], primary_actions: ['Triage incoming feedback', 'Update status', 'Add admin notes', 'Resolve or decline'], alerts_or_signals: ['New feedback submitted'] },
  { workflow: 'Expansion', purpose: 'Track readiness for expansion into new metros. Monitor momentum and resource allocation.', data_sources: ['expansion_signals', 'metro_momentum_signals', 'metros'], primary_actions: ['View expansion readiness scores', 'Monitor metro momentum', 'Track first-anchor milestones'], alerts_or_signals: ['expansion_ready'] },
  { workflow: 'Knowledge & Playbooks', purpose: 'Internal knowledge base housing activation scripts, migration guides, outreach templates, and QA procedures.', data_sources: ['ai_knowledge_documents', 'ai_knowledge_document_versions'], primary_actions: ['Browse playbook library', 'Read operational guides', 'Search knowledge vault'], alerts_or_signals: [] },
  { workflow: 'Garden Pulse', purpose: 'Five-layer visual ecosystem view for contemplative Gardener oversight. Reveals movement, presence, and story across the network.', data_sources: ['tenants', 'metros', 'testimonium_events', 'lumen_signals', 'communio_shared_signals'], primary_actions: ['Toggle between Constellation, Atlas, Timeline, Rhythm, Storybook layers', 'Enable Silent Mode', 'View Providence and Compass overlays'], alerts_or_signals: ['narrative_surge', 'expansion_ready'] },
  { workflow: 'Garden Studio', purpose: 'Editorial workspace for narrative content. Five tabs: Library, Playbooks, Voice & Tone, Communio Directory, Atlas. Draft-first with AI Assist and version history. Admin settings moved to Platform Config.', data_sources: ['library_essays', 'ai_knowledge_documents', 'gardener_audit_log'], primary_actions: ['Edit essays and playbooks', 'Calibrate voice and tone', 'Browse communio directory', 'Explore mission atlas'], alerts_or_signals: [] },
  { workflow: 'Morning & Evening Examen', purpose: 'Contemplative daily rhythm replacing traditional admin dashboards. Ignatian-structured narrative overview.', data_sources: ['gardener_insights', 'lumen_signals', 'tenants'], primary_actions: ['Read NRI-generated narrative summaries', 'Reflect on ecosystem movement', 'Note quiet growth patterns'], alerts_or_signals: [] },
  { workflow: 'Recovery & Restoration', purpose: 'Review recovery tickets from tenants. Restore soft-deleted records. Track action breadcrumbs for undo support.', data_sources: ['recovery_tickets', 'app_event_stream'], primary_actions: ['Review recovery requests', 'Restore records', 'View action breadcrumbs', 'Communicate with requesting user'], alerts_or_signals: ['restoration'] },
  { workflow: 'Discovery Insights', purpose: 'Human-centric behavioral pattern observations. Surfaces adoption friction and curiosity signals without surveillance.', data_sources: ['gardener_insights', 'app_event_stream'], primary_actions: ['Review behavioral patterns', 'Note friction observations', 'Track curiosity signals'], alerts_or_signals: ['friction_idle', 'friction_rage_click'] },
  { workflow: 'Gardener Inbox', purpose: 'Routed ticket inbox for multi-gardener teams. Tickets auto-route by metro, archetype, specialty, or on-call status. Each gardener sees only their assigned items.', data_sources: ['gardeners', 'gardener_scopes', 'tenant_gardener_assignments', 'recovery_tickets', 'feedback'], primary_actions: ['View assigned tickets', 'Acknowledge or snooze', 'Reassign to another gardener', 'Resolve tickets'], alerts_or_signals: ['ticket_routed'] },
  { workflow: 'Impact Dimensions Configuration', purpose: 'Tenant-driven structured metric setup. Stewards define what matters (e.g. devices distributed, meals served) and attach metrics to entity forms.', data_sources: ['impact_dimensions', 'impact_dimension_values'], primary_actions: ['Create/edit dimensions', 'Toggle public eligibility', 'View aggregated totals in Reports'], alerts_or_signals: [] },
  { workflow: 'Caregiver Solo Onboarding', purpose: 'Free-tier personal workspace creation for independent caregivers. Routes to caregiver-specific onboarding with privacy-first defaults.', data_sources: ['tenants', 'archetypes'], primary_actions: ['Select caregiver_solo at signup', 'Create private workspace', 'Add first person', 'Log first care visit'], alerts_or_signals: ['tenant_arrived'] },
  { workflow: 'Caregiver Agency Onboarding', purpose: 'Standard tenant signup selecting caregiver_agency archetype. Invites caregivers as Companion-role users.', data_sources: ['tenants', 'tenant_invites', 'archetypes'], primary_actions: ['Select caregiver_agency archetype', 'Invite caregivers', 'Configure visibility controls', 'Review care summaries'], alerts_or_signals: ['tenant_arrived'] },
  { workflow: 'Season Summary → Export/Share', purpose: 'Caregiver generates narrative care season summary and optionally shares to agency or exports PDF.', data_sources: ['season_summaries', 'activities', 'contacts'], primary_actions: ['Generate summary from person record', 'Review AI-assisted themes', 'Publish (private/shared/exported)', 'Export PDF'], alerts_or_signals: ['season_summary_generated'] },
  { workflow: 'Care Completion Ritual', purpose: 'Dignified closing flow when care season ends. Includes optional reflection, summary generation, and person archiving.', data_sources: ['contacts', 'season_summaries', 'activities'], primary_actions: ['Write closing reflection', 'Generate final season summary', 'Set completion date', 'Archive person'], alerts_or_signals: ['care_completed'] },
  { workflow: 'Territory Onboarding Selection', purpose: 'Archetype-aware territory selection during onboarding. Metro orgs pick metros, rural orgs bundle counties, missionary orgs select countries, solo caregivers set private base location.', data_sources: ['territories', 'tenant_territories', 'tenants'], primary_actions: ['Choose territory mode (metro/county/state/country)', 'Select territories within mode', 'Review activation slot cost', 'Confirm territory activation'], alerts_or_signals: ['territory_activated'] },
  { workflow: 'Missionary Org Country Activation', purpose: 'Country-level territory activation for missionary organizations. Optional city/region for mission field children.', data_sources: ['territories', 'tenant_territories'], primary_actions: ['Select country', 'Add mission city/region (optional)', 'Activate country territory'], alerts_or_signals: ['territory_activated'] },
  { workflow: 'Territory-Aware Discovery', purpose: 'Signum discovery filtered by activated territories with archetype-sensitive relevance scoring. Rural orgs scored fairly (county 0.85, state 0.7). Solo caregivers locked to base state with no expansion prompts.', data_sources: ['territories', 'tenant_territories', 'org_watchlist', 'content_reports'], primary_actions: ['Search within active territories', 'Toggle "Explore beyond" for wider results', 'Score results by territory relevance', 'Report inappropriate content'], alerts_or_signals: ['territory_relevance_scored', 'content_reported'] },
  { workflow: 'Relational Orientation Change', purpose: 'Steward or Shepherd recalibrates how the workspace emphasizes people vs organizations. Affects UI richness, compass weighting, and narrative density. No data is lost — only presentation adapts.', data_sources: ['tenants', 'tenant_orientation_audit', 'entity_richness_overrides'], primary_actions: ['Select orientation (human_focused / institution_focused / hybrid)', 'Toggle auto-manage richness', 'Confirm change via dialog', 'Review audit trail'], alerts_or_signals: ['orientation_changed'] },
  { workflow: 'Onboarding Relational Focus Step', purpose: 'New tenants select their relational orientation during onboarding (step 0). Sets initial people/partner richness defaults and compass calibration.', data_sources: ['tenants', 'onboarding_steps'], primary_actions: ['Choose human-focused, institution-focused, or hybrid', 'Enable or disable auto-manage richness', 'Proceed to next onboarding step'], alerts_or_signals: [] },
  { workflow: 'First 30-Day Calibration', purpose: 'Automatic sensitivity tuning for new tenants. Heightens Compass responsiveness, surfaces gentle reflection prompts, and auto-generates a foundational Providence entry between days 21–30. All calibration sunsets at day 31.', data_sources: ['tenants (created_at)', 'activities', 'life_events', 'opportunities', 'providence_reports'], primary_actions: ['No manual action required — fully automatic'], alerts_or_signals: ['foundational_providence_generated'] },
  { workflow: 'NRI Help & Platform Questions', purpose: 'Users ask NRI about any platform feature and receive accurate answers drawn from embedded help knowledge. NRI clearly communicates when it cannot perform a requested action.', data_sources: ['ai_chat_sessions', 'ai_chat_messages', 'app_sections (embedded)'], primary_actions: ['Ask platform questions', 'Get feature explanations', 'Receive honest action feedback'], alerts_or_signals: [] },
  { workflow: 'Local Pulse Discovery Run', purpose: 'Keyword-driven community event discovery using Perplexity search and Firecrawl extraction. Manual runs triggered by Steward or scheduled metro-level runs aggregate tenant keywords.', data_sources: ['local_pulse_events', 'local_pulse_sources', 'tenant_territories'], primary_actions: ['Run Pulse manually', 'Review discovered events', 'Tune keywords via Keyword Tuner', 'Dismiss irrelevant results'], alerts_or_signals: ['pulse_event_discovered'] },
  { workflow: 'Companion → Tenant Absorption', purpose: 'Free Companion joins any tenant organization while preserving relationship privacy and dignity. Supports three strategies: keep private, move selected, or copy selected relationships.', data_sources: ['companion_absorption_requests', 'tenant_invites', 'tenant_users', 'opportunities', 'contacts'], primary_actions: ['Accept invitation', 'Choose relationship strategy', 'Select relationships to move or copy', 'Join organization workspace'], alerts_or_signals: ['companion_absorbed'] },
];

// ─────────────────────────────────────
// SECTION H — AI & DISCERNMENT (FIELD GUIDE)
// ─────────────────────────────────────

export interface AiDiscernmentSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export const AI_DISCERNMENT_CONTENT: AiDiscernmentSection[] = [
  {
    heading: 'What NRI Actually Does',
    body: 'NRI stands for Narrative Relational Intelligence. It quietly works alongside you — reading the patterns in your own notes, visits, and activity — and surfaces things you might otherwise miss.\n\nIt follows a simple loop:',
    bullets: [
      'Recognize — It notices patterns across your records. Who you\'ve visited, what was said, what\'s coming up.',
      'Synthesize — It connects those dots into short, human-readable summaries.',
      'Prioritize — It gently suggests what might need your attention next.',
    ],
  },
  {
    heading: 'What That Looks Like in Practice',
    body: 'Here are a few examples of what NRI might surface:',
    bullets: [
      '"You haven\'t checked in with Maria in 14 days."',
      '"Three families mentioned eviction concerns this month."',
      '"Your Christmas drive starts in 4 weeks — last year you began outreach around this time."',
    ],
  },
  {
    heading: 'What NRI Does NOT Do',
    body: 'This is just as important to understand:',
    bullets: [
      'It does not make decisions for you.',
      'It does not score or rank people.',
      'It does not send messages or emails automatically.',
      'It does not share your private data with anyone.',
      'It does not replace your judgment — ever.',
    ],
  },
  {
    heading: 'You Remain Responsible',
    body: 'NRI is a companion, not a manager. It surfaces patterns — you decide what matters.\n\nYou choose what to act on. You choose when to reach out. You choose what to ignore. The system is designed to reduce your mental load, not to add pressure. If you see a suggestion and think "not right now," that\'s a perfectly valid response.',
  },
  {
    heading: 'Your Relationships Stay Local',
    body: 'Your data belongs to your organization. Period.\n\nCROS enforces a strict boundary around every tenant workspace:',
    bullets: [
      'Your notes, reflections, and visit records are never shared with other organizations.',
      'No cross-tenant data mixing or aggregation.',
      'No selling or monetizing of your data.',
      'Your private reflections remain sacred and visible only to you.',
    ],
  },
  {
    heading: 'If AI Ever Feels Wrong',
    body: 'Sometimes NRI will surface a suggestion that doesn\'t feel right. That\'s okay.\n\nIgnore it. Move on. The system learns from real use over time — not from blind automation. It\'s designed to get better as you use it, shaped by the patterns of your actual work.\n\nIf something feels consistently off, talk to your team lead or your Gardener. They can adjust how the system responds to your context.',
  },
  {
    heading: 'A Simple Promise',
    body: 'CROS exists to help you see clearly — not to replace your judgment.\n\nThe intelligence in this system comes from your relationships, your notes, your presence in the community. AI simply helps you hold it all without dropping anything important.',
  },
];
