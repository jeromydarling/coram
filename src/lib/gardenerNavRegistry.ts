/**
 * gardenerNavRegistry — Single source of truth for Gardener Console navigation and documentation.
 *
 * WHAT: Central registry of every Gardener Console section with route, zone, description, and How-To content.
 * WHERE: Consumed by OperatorHowToPage (documentation), sidebar (navigation), and zone registry (enforcement).
 * WHY: Adding a nav item here automatically creates a How-To stub — no manual sync needed.
 *
 * TO ADD A NEW SECTION:
 * 1. Add an entry to GARDENER_NAV_REGISTRY below
 * 2. Specify route, zone, icon key, and at minimum: title + summary
 * 3. The How-To page will automatically render a card (with "Documentation pending" if whatYouSee/whatToDo are empty)
 * 4. The zone registry will auto-validate against this list in dev mode
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Users,
  Building2,
  MapPin,
  Calendar,
  Mail,
  Inbox,
  Workflow,
  HeartPulse,
  Plug,
  Settings2,
  Shield,
  BookOpen,
  FlaskConical,
  Camera,
  HelpCircle,
  Clock,
  ShieldAlert,
  Megaphone,
  Globe,
  Sparkles,
  ClipboardList,
  TestTube2,
  UserSearch,
  CalendarSearch,
  ListChecks,
  Search,
  Settings,
  Compass,
  Radio,
  Heart,
  FileText,
  Sun,
  Pen,
  Feather,
  BarChart3,
  Sprout,
} from 'lucide-react';

// ─────────────────────────────────────
// TYPES
// ─────────────────────────────────────

export type GardenerZone = 'cura' | 'machina' | 'crescere' | 'scientia' | 'silentium';

export interface GardenerNavEntry {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Display title */
  title: string;
  /** Route path */
  route: string;
  /** Canonical zone */
  zone: GardenerZone;
  /** One-sentence summary */
  summary: string;
  /** Optional tab labels */
  tabs?: string[];
  /** What the gardener sees on this page */
  whatYouSee: string[];
  /** Recommended actions */
  whatToDo: string[];
  /** Practical tips */
  tips?: string[];
}

// ─────────────────────────────────────
// ZONE DISPLAY METADATA
// ─────────────────────────────────────

export const ZONE_LABELS: Record<GardenerZone, { label: string; color: string; description: string }> = {
  cura:      { label: 'Cura',      color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', description: 'What should I focus on today?' },
  machina:   { label: 'Machina',   color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', description: 'Is the system running correctly?' },
  crescere:  { label: 'Crescere',  color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400', description: 'Is the ecosystem growing well?' },
  scientia:  { label: 'Scientia',  color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400', description: 'What is the system teaching us?' },
  silentium: { label: 'Silentium', color: 'bg-muted text-muted-foreground', description: 'Internal tooling & dev utilities' },
};

// ─────────────────────────────────────
// THE REGISTRY
// ─────────────────────────────────────

export const GARDENER_NAV_REGISTRY: GardenerNavEntry[] = [
  // ═══════════════════════════════════════════════
  // CURA — The Living Work (Daily Stewardship)
  // ═══════════════════════════════════════════════
  {
    icon: Compass,
    title: 'Nexus Overview',
    route: '/operator/nexus',
    zone: 'cura',
    summary: 'The Nexus is your starting point each day. A high-level orientation hub that links to all daily stewardship tools with status indicators and quick-access cards.',
    whatYouSee: [
      'Quick-access cards for all Cura subsections',
      'Status indicators showing health of each area',
      'Gentle signals if anything needs attention',
    ],
    whatToDo: [
      'Start here when you\'re not sure where to begin your day',
      'Check status indicators for any section showing gentle warnings',
      'Let the Nexus guide your attention — it surfaces what matters',
    ],
  },
  {
    icon: Activity,
    title: 'Presence',
    route: '/operator/nexus/presence',
    zone: 'cura',
    summary: 'Real-time narrative presence dashboard showing which tenants are active, what signals are flowing, and overall platform vitality.',
    whatYouSee: [
      'Active tenant presence indicators',
      'Live signal flow across the platform',
      'Narrative vitality metrics',
    ],
    whatToDo: [
      'Monitor for tenants that have gone quiet — absence is a signal',
      'Use presence data to time your outreach and support efforts',
    ],
  },
  {
    icon: Compass,
    title: 'Lumen',
    route: '/operator/nexus/lumen',
    zone: 'cura',
    summary: 'Patterns of growth, drift, and momentum across communities. Quiet foresight — emerging signals detected before they become friction.',
    whatYouSee: [
      'Narrative direction indicators',
      'Emerging theme clusters across tenants',
      'Strategic alignment scores',
    ],
    whatToDo: [
      'Review weekly to understand narrative momentum',
      'Identify themes that could become shared Communio signals',
    ],
  },
  {
    icon: Radio,
    title: 'Signum',
    route: '/operator/nexus/friction',
    zone: 'cura',
    summary: 'Signal intelligence layer. Surfaces friction points, drift patterns, and attention-worthy signals across the tenant ecosystem.',
    whatYouSee: [
      'Friction signal feed with severity and source',
      'Drift pattern detection across tenants',
      'Signal clustering by archetype and metro',
    ],
    whatToDo: [
      'Triage high-severity signals daily',
      'Cross-reference with Presence data to identify at-risk tenants',
    ],
  },
  {
    icon: Heart,
    title: 'Adoption',
    route: '/operator/nexus/adoption',
    zone: 'cura',
    summary: 'Track how deeply tenants are adopting the platform. Measures feature usage, daily rhythm adherence, and formation progress.',
    whatYouSee: [
      'Adoption depth metrics per tenant',
      'Feature usage heatmaps',
      'Daily rhythm adherence scores',
    ],
    whatToDo: [
      'Identify tenants with low adoption — they may need Activation support',
      'Celebrate high-adoption tenants — they are your champions',
    ],
  },
  {
    icon: Sun,
    title: 'Daily Rhythm',
    route: '/operator/nexus/rhythm',
    zone: 'cura',
    summary: 'Your operating heartbeat. Define the cadence and flow of daily, weekly, and monthly gardener rituals.',
    whatYouSee: [
      'Rhythm schedule with daily/weekly/monthly cadences',
      'Ritual definitions and checklists',
    ],
    whatToDo: [
      'Follow the daily rhythm consistently — it anchors your stewardship',
      'Adjust cadences as the platform matures',
    ],
  },
  {
    icon: Sparkles,
    title: 'Activation',
    route: '/operator/activation',
    zone: 'cura',
    summary: 'Guided Activation™ — manage activation checklists, offers, live onboarding sessions, and audit logs for tenants. Track readiness scores and walk tenants through their first 30 days.',
    tabs: ['Tenants', 'Sessions', 'Offers', 'Audit Log'],
    whatYouSee: [
      'Tenants tab: Activation checklist status (complete, in-progress, not started) with readiness scores',
      'Sessions tab: Purchased onboarding session history with scheduling and notes',
      'Offers tab: Activation offers with consent tracking and scheduling',
      'Audit Log tab: Complete audit trail of activation-related actions',
    ],
    whatToDo: [
      'Review newly onboarded tenants and ensure their checklists are progressing',
      'Offer activation sessions to tenants stuck below 50% readiness',
      'Track consent status before any impersonation-based support',
      'Use session notes to document what was covered during each activation call',
    ],
    tips: [
      'Activation uses the impersonation system — consent must be granted before you can act on behalf of a tenant',
      'Readiness score is auto-calculated from checklist completion percentage',
    ],
  },
  {
    icon: Inbox,
    title: 'Support & Care',
    route: '/operator/nexus/support',
    zone: 'cura',
    summary: 'Listening when communities raise their hand. Review and respond to support requests, track resolution, and tend to tenant needs.',
    whatYouSee: [
      'Support request queue with priority and status',
      'Tenant context for each request',
      'Resolution tracking and response history',
    ],
    whatToDo: [
      'Triage incoming requests daily',
      'Respond within 24 hours for standard requests',
      'Escalate critical issues to the Error Desk',
    ],
  },
  {
    icon: Sprout,
    title: 'Arrival',
    route: '/operator/nexus/arrival',
    zone: 'cura',
    summary: 'New tenant arrival monitoring. Track the first moments of a tenant\'s journey from signup through initial configuration.',
    whatYouSee: [
      'Recent arrivals with onboarding step progress',
      'Time-to-first-action metrics',
      'Drop-off points in the onboarding flow',
    ],
    whatToDo: [
      'Monitor drop-off points to identify UX friction',
      'Reach out to tenants stuck in early onboarding steps',
    ],
  },
  {
    icon: HeartPulse,
    title: 'Recovery & Restoration',
    route: '/operator/nexus/recovery',
    zone: 'cura',
    summary: 'Three-layer recovery system: Recycle Bin (90-day soft-delete safety net), Action Breadcrumbs (30-day assistant context), and Recovery Tickets (emergency gardener help). Nothing is ever truly lost.',
    tabs: ['Recycle Bin', 'Recovery Tickets'],
    whatYouSee: [
      'Recycle Bin: Soft-deleted records across all tenants with one-click restore',
      'Recovery Tickets: Emergency requests from tenants needing data restoration',
      'Restoration signals: Anonymized narrative of what was recovered and when',
    ],
    whatToDo: [
      'Review recovery tickets promptly — tenants are waiting for help',
      'Restore soft-deleted records before the 90-day window closes',
      'Check restoration signals for patterns (repeated accidental deletions suggest UX friction)',
    ],
    tips: [
      'Action breadcrumbs are ON by default — tenants can disable in Settings',
      'Breadcrumbs never store content, names, or PII — only action types and entity references',
      'Retention: breadcrumbs 30 days, recycle bin 90 days, restoration signals 90 days',
    ],
  },
  {
    icon: Shield,
    title: 'Communio',
    route: '/operator/communio',
    zone: 'cura',
    summary: 'Cross-tenant collaboration oversight and caregiver network moderation. Monitor shared signal groups, privacy compliance, collaboration health, and caregiver network safety.',
    whatYouSee: [
      'Active Communio groups with member counts and sharing levels',
      'Signal sharing volume and types (drift, momentum, growth, reconnection)',
      'Privacy audit: shared signals checked for PII leakage',
      'Collaboration metrics: events shared, signals exchanged per week',
      'Caregiver Network tab: total profiles, active/visible count, open abuse reports',
    ],
    whatToDo: [
      'Review privacy audit results weekly — any PII detection is a critical issue',
      'Monitor group health: groups with declining activity may need attention',
      'Verify that sharing levels match tenant preferences',
      'Review caregiver network abuse reports — resolve or disable offending profiles',
      'Monitor caregiver network growth — ensure healthy adoption',
    ],
    tips: [
      'Communio is opt-in only. Never force a tenant into a sharing group',
      'The privacy regex checks for patterns like email addresses and phone numbers in signal summaries',
      'Caregiver network: you cannot see message content unless explicitly reported by a participant',
      'Disabling a profile sets hidden_at and network_opt_in=false — the caregiver can re-enable later',
    ],
  },
  {
    icon: Globe,
    title: 'Expansion',
    route: '/operator/nexus/expansion',
    zone: 'cura',
    summary: 'Growth planning and expansion intelligence. Track metro readiness for launch, expansion interest signals, and market opportunity analysis.',
    whatYouSee: [
      'Expansion candidate metros with readiness scores',
      'Interest signals from archetype communities',
      'Market opportunity analysis',
    ],
    whatToDo: [
      'Review expansion candidates quarterly',
      'Validate interest signals before committing resources to new metros',
    ],
  },
  {
    icon: BookOpen,
    title: 'Praeceptum (Guidance)',
    route: '/operator/nexus/guidance',
    zone: 'cura',
    summary: 'Gardener guidance hub. Curated formation content, onboarding principles, and narrative-first training materials.',
    whatYouSee: [
      'Formation content library',
      'Onboarding principles and best practices',
      'Training resource links',
    ],
    whatToDo: [
      'Review guidance materials before onboarding new tenants',
      'Update content as platform features evolve',
    ],
  },
  {
    icon: BookOpen,
    title: 'Knowledge Vault',
    route: '/operator/nexus/knowledge',
    zone: 'cura',
    summary: 'AI knowledge document repository. Manages the documents that power NRI (Neary) — version-controlled, sourced, and gardener-curated.',
    whatYouSee: [
      'Document list with version history',
      'Source URLs and content previews',
      'Active/inactive status for each document',
    ],
    whatToDo: [
      'Keep knowledge documents current — NRI quality depends on this',
      'Add new documents when platform capabilities change',
      'Version documents rather than overwriting them',
    ],
  },
  {
    icon: FileText,
    title: 'Gardener Playbooks',
    route: '/operator/nexus/playbooks',
    zone: 'cura',
    summary: 'Markdown-based procedure library. Activation scripts, migration guides, outreach templates, and QA troubleshooting steps.',
    whatYouSee: [
      'Playbook list organized by category',
      'Full markdown rendering with code blocks and checklists',
      'Search and filter capabilities',
    ],
    whatToDo: [
      'Reference playbooks during activation calls',
      'Update procedures when workflows change',
      'Create new playbooks for recurring gardener tasks',
    ],
  },
  {
    icon: Sun,
    title: 'Morning Examen',
    route: '/operator/nexus/examen/morning',
    zone: 'cura',
    summary: 'Daily orientation through narrative awareness. Grounds you in what is alive before the day begins — Noticing, Gratitude, Attention, Invitation, Sending Forth.',
    whatYouSee: [
      'NRI-generated summary of overnight ecosystem movement',
      'Growth signals and new arrivals since yesterday',
      'Gentle attention cues — not alerts, invitations',
    ],
    whatToDo: [
      'Begin each day here before checking any other surface',
      'Let the Examen guide your first action — it surfaces what matters most',
      'Shown once per calendar day to preserve its contemplative rhythm',
    ],
  },
  {
    icon: Sun,
    title: 'Evening Examen',
    route: '/operator/nexus/examen/evening',
    zone: 'cura',
    summary: 'End-of-day reflection. Notice where life moved, where resistance appeared, and what grew quietly — never as productivity review.',
    whatYouSee: [
      'Where Life Moved: tenant activity and milestones today',
      'Resistance: friction or stalled movement observed',
      'Quiet Growth: signals that wouldn\'t appear in a dashboard',
      'NRI Learning: what the system learned from today\'s patterns',
    ],
    whatToDo: [
      'Close each day here — it takes 2 minutes',
      'Let the reflection settle; this is not a scorecard',
      'Shown once per calendar day',
    ],
  },
  {
    icon: Sprout,
    title: 'Garden Pulse',
    route: '/operator/nexus/garden-pulse',
    zone: 'cura',
    summary: 'Five-layer visual ecosystem view: Constellation (tenant nodes by Familia), Atlas (geographic presence), Timeline (chronological movement), Seasonal Rhythm (cyclical patterns), and Storybook (narrative highlights). Movement, not metrics.',
    whatYouSee: [
      'Constellation: tenant nodes grouped by Familia — glow intensity reflects activity',
      'Atlas: metro presence with density indicators',
      'Timeline: recent movement events in chronological order',
      'Providence + Compass overlays showing grace patterns and directional movement',
    ],
    whatToDo: [
      'Visit weekly to sense the ecosystem\'s rhythm',
      'Toggle layers to focus on specific dimensions of movement',
      'Use Silent Mode to hide all indicators and simply observe',
    ],
    tips: [
      'Providence shows "where grace gathers"; Compass shows "how movement flows" — complementary lenses',
      'Silent Mode removes all labels and badges for pure contemplation',
    ],
  },
  {
    icon: Inbox,
    title: 'Gardener Inbox',
    route: '/operator/nexus/inbox',
    zone: 'cura',
    summary: 'Your routed ticket inbox. Tickets auto-route through a 6-step ladder: explicit assignment → metro match → archetype match → specialty match → on-call → primary fallback. Each gardener sees only their own assigned items.',
    whatYouSee: [
      'Tickets assigned to you with tenant name, type, severity, and module context',
      'On-call queue (visible when you are the on-call gardener)',
      'Filters by ticket type, severity, module, and tenant',
      'Routing reason displayed on each ticket for transparency',
    ],
    whatToDo: [
      'Review assigned tickets daily — acknowledge within 24 hours',
      'Snooze tickets that need follow-up (24h or 7d options)',
      'Reassign tickets to another gardener if they match a different scope',
      'Resolve tickets with a brief note for the audit trail',
    ],
    tips: [
      'Bug reports and feature requests always route to the Primary Gardener',
      'Support-specific requests route to the gardener assigned to that metro or archetype',
      'All assignment changes are logged in gardener_audit_log',
      'Record names and PII are never visible — only tenant name and metadata',
    ],
  },
  {
    icon: Heart,
    title: 'Companion Archetype Awareness',
    route: '/operator/tenants (companion filter)',
    zone: 'cura',
    summary: 'Tenants using the caregiver_solo or caregiver_agency archetypes are Companion workspaces — for mentors, sponsors, caregivers, spiritual directors, coaches, and anyone who walks closely with others. Solo companions are independent, privacy-first users. Organization tenants invite companions as team members with dignity-first visibility controls.',
    whatYouSee: [
      'Tenant archetype badge showing caregiver_solo or caregiver_agency (internal keys — displayed as "Companion" in UI)',
      'Solo tenants: single-user, free tier, no team members expected',
      'Organization tenants: team roster with Companion-role members',
      'Companion completion trends and season summary generation activity',
    ],
    whatToDo: [
      'Monitor companion organization tenants for healthy invite adoption — companions should be joining as team members',
      'Watch for solo tenants approaching the 10-person active cap — gentle expansion nudge, never pressure',
      'Never surface private log content or date_of_passing in any operator view',
      'Understand that companion tenants will NOT use most partner/metro modules — this is normal, not a retention risk',
    ],
    tips: [
      'Companion tenants have fundamentally different sidebar navigation — many standard sections are hidden',
      'Season summaries are the primary narrative artifact, not testimonium rollups',
      'The care_completed signal is sensitive — treat it with reverence, not as a metric',
      'Solo → Organization one-way export is available but should never be encouraged by operators',
      'High-potential adoption group: recovery sponsors and mentors — they naturally need long-arc memory',
    ],
  },

  // ═══════════════════════════════════════════════
  // MACHINA — The System Engine
  // ═══════════════════════════════════════════════
  {
    icon: TestTube2,
    title: 'QA Hub',
    route: '/operator/qa',
    zone: 'machina',
    summary: 'Unified quality assurance workspace. Run automated test suites and monitor QA health guardrails in one place.',
    tabs: ['Test Runner', 'Health Dashboard'],
    whatYouSee: [
      'Test Runner tab: Test suite list with pass/fail counts, individual test results, and coverage summary',
      'Health Dashboard tab: QA guardrail status, failing suites, and regression indicators',
    ],
    whatToDo: [
      'Run a full QA pass before every release',
      'Investigate any newly failing tests — they indicate regressions',
      'Use the Health Dashboard to monitor ongoing guardrail compliance',
    ],
    tips: [
      'QA tests use the same nav registry as the live app — if navigation changes, update the test helpers too',
      'Test environment uses dedicated QA user accounts configured via environment variables',
    ],
  },
  {
    icon: ClipboardList,
    title: 'Error Desk',
    route: '/operator/error-desk',
    zone: 'machina',
    summary: 'Centralized platform stabilization tool. View, triage, and resolve errors from across the system — failed automations, broken connectors, and tenant-reported issues.',
    whatYouSee: [
      'Error feed with source, severity, and timestamp',
      'Status badges: open, investigating, resolved, wont-fix',
      'Affected tenant and workflow information',
      'Quick-action buttons for re-dispatch, acknowledge, and resolve',
    ],
    whatToDo: [
      'Check the Error Desk daily — this is your first stop for platform health',
      'Triage by severity: critical errors first, then warnings',
      'Use re-dispatch for automation failures caused by transient issues',
      'Mark resolved errors with a brief explanation for the audit trail',
    ],
    tips: [
      'Errors older than 7 days without acknowledgment are escalated automatically',
      'Cross-reference with the Time Machine to understand the sequence of events leading to errors',
    ],
  },
  {
    icon: Settings2,
    title: 'Platform Config',
    route: '/operator/platform',
    zone: 'machina',
    summary: 'Central administrative hub. Manage feature switches, gardener team assignments, notification templates, keywords, archetypes, and metro news feeds. Admin settings that were previously in Studio now live here.',
    tabs: ['Switches', 'Gardeners', 'Notifications', 'Keywords', 'Archetypes', 'Metro News'],
    whatYouSee: [
      'Switches tab: Toggle tenant-facing feature flags with audit trail',
      'Gardeners tab: Add team members, assign metro/archetype/specialty scopes, toggle on-call',
      'Notifications tab: Manage operator notification templates and schedules',
      'Keywords tab: Global keyword sets that power Local Pulse discovery',
      'Archetypes tab: Mission archetype profiles with behavior configs and narrative styles',
      'Metro News tab: News source configuration for metro narrative engines',
    ],
    whatToDo: [
      'Check the Switches tab before any feature rollout',
      'Update gardener scopes when team assignments change',
      'Review notification templates seasonally for tone alignment',
      'Update global keywords quarterly based on community trends',
      'Test archetype changes in the Demo Lab before applying to production profiles',
      'Add metro news sources for any newly supported metros',
    ],
    tips: [
      'Switches, Gardeners, and Notifications moved here from Garden Studio to keep editorial work separate from admin settings',
    ],
  },
  {
    icon: Plug,
    title: 'Integrations',
    route: '/operator/integrations',
    zone: 'machina',
    summary: 'Unified Relatio integration hub. Manage connectors, review field mapping references, track migration runs, and configure bi-directional CRM sync for HubSpot, Salesforce, and Microsoft Dynamics 365.',
    tabs: ['Connectors', 'Reference', 'Migrations', 'HubSpot', 'Salesforce', 'Dynamics 365'],
    whatYouSee: [
      'Connectors tab: Full connector library with status indicators and configuration',
      'Reference tab: Field mapping documentation for all supported CRMs',
      'Migrations tab: Migration run history with status, record counts, and error details',
      'HubSpot tab: HubSpot-specific two-way sync settings and admin controls',
      'Salesforce tab: Salesforce bi-directional sync configuration and conflict queue',
      'Dynamics 365 tab: Microsoft Dynamics 365 OData v4 sync settings and conflict management',
    ],
    whatToDo: [
      'Investigate connectors showing "error" status immediately',
      'Review field mapping references when onboarding a tenant from a new CRM',
      'Monitor migration runs for failures and verify record counts',
      'Check the sync_conflicts queue for records needing manual resolution (two-way sync)',
      'Configure sync_direction_config for tenants that need outbound write-back enabled',
    ],
    tips: [
      'The Migrations tab supports 24+ connectors including Breeze, FellowshipOne, Planning Center, Rock RMS, and more',
      'Connector Confidence Score is calculated from success rate, simulation pass rate, and uptime',
      'Two-way sync is available for HubSpot, Salesforce, and Microsoft Dynamics 365 — conflicts are flagged for Steward review, never auto-overwritten',
      'Outbound sync uses direct Edge Function → Vendor API calls (no external orchestration dependency)',
    ],
  },
  {
    icon: Inbox,
    title: 'Intake',
    route: '/operator/intake',
    zone: 'machina',
    summary: 'A global inbox for user feedback, bug reports, and feature requests submitted from within tenant apps.',
    whatYouSee: [
      'Incoming feedback items with tenant name, type (bug, feature, question), and timestamp',
      'Status badges: new, acknowledged, resolved',
      'Priority indicators based on tenant tier and report frequency',
    ],
    whatToDo: [
      'Triage new items daily — acknowledge within 24 hours',
      'Route bugs to the appropriate system',
      'Mark resolved items and optionally respond to the tenant',
    ],
  },
  {
    icon: Workflow,
    title: 'Automation (Background Tending)',
    route: '/operator/automation',
    zone: 'machina',
    summary: 'Monitor all n8n workflow runs and Edge Function invocations. Track success rates, usage metering, ops controls, and AI learning metrics.',
    tabs: ['Results', 'Usage', 'Ops Feed', 'Learning', 'Ops Controls'],
    whatYouSee: [
      'Results tab: Recent automation runs with workflow key, status, tenant, and timing',
      'Usage tab: Platform consumption metering with trend charts',
      'Ops Feed tab: Live feed of operational events',
      'Learning tab: AI learning metrics and model performance',
      'Ops Controls tab: Manual workflow triggers and re-dispatch actions',
    ],
    whatToDo: [
      'Investigate any run stuck in "running" for more than 10 minutes — this is considered a failure',
      'Check retry_count for workflows that keep failing — may indicate an upstream API issue',
      'Review usage meters to track platform consumption trends',
    ],
    tips: [
      'All n8n workflows must be time-bounded. A stuck run means the workflow violated this contract',
      'The payload_fingerprint column helps identify duplicate dispatches',
    ],
  },
  {
    icon: Compass,
    title: 'Orientation Observatory',
    route: '/operator/machina/orientation',
    zone: 'machina',
    summary: 'Aggregate-only view of tenant orientation distribution, richness levels, and entity-level overrides. No tenant PII — counts and averages only.',
    whatYouSee: [
      'Orientation distribution cards (Human-Focused, Institution-Focused, Hybrid) with tenant counts',
      'Average people/partner richness per orientation',
      'Total entity-level richness overrides across the platform',
    ],
    whatToDo: [
      'Check periodically to understand ecosystem posture balance',
      'Investigate if override count is unexpectedly high — may indicate tenant confusion',
      'Use to validate that archetype defaults are producing expected orientation patterns',
    ],
    tips: [
      'All data is aggregate — no tenant names, entity names, or PII are shown',
      'Entity overrides let individual stewards customize richness without changing tenant defaults',
    ],
  },
  {
    icon: HeartPulse,
    title: 'System Health',
    route: '/operator/system',
    zone: 'machina',
    summary: 'Unified system monitoring hub. Infrastructure health, friction signals, automation history, and end-to-end pipeline sweeps.',
    tabs: ['Health', 'Friction', 'Background Tending', 'Walk the Garden'],
    whatYouSee: [
      'Health tab: Schedule status cards with cadence, last run time, and toggle controls',
      'Friction tab: System-level stability signals and degradation indicators',
      'Background Tending tab: Automation run status and history',
      'Walk the Garden tab: Full end-to-end pipeline check scoreboard',
    ],
    whatToDo: [
      'Monitor Health tab for schedule failures during peak hours',
      'Check Friction tab daily for emerging stability patterns',
      'Run a Garden Walk before every release candidate — green means launch-ready',
    ],
    tips: [
      'Sweeps are idempotent: re-running with the same key returns existing results',
      'The privacy sweep step checks for PII leakage in Communio shared signals',
    ],
  },
  {
    icon: FlaskConical,
    title: 'Simulation',
    route: '/operator/nexus/simulation',
    zone: 'machina',
    summary: 'Advanced archetype simulation runner. Execute tick-based simulations against archetype profiles to validate behavior patterns and narrative outcomes.',
    whatYouSee: [
      'Simulation run history with archetype, tenant, and status',
      'Tick-by-tick event ledger with outcomes',
      'Behavior pattern validation results',
    ],
    whatToDo: [
      'Run simulations when modifying archetype behavior profiles',
      'Verify simulation stats match expected patterns',
    ],
  },
  {
    icon: BookOpen,
    title: 'Garden Studio',
    route: '/operator/nexus/studio',
    zone: 'scientia',
    summary: 'Editorial workspace for narrative content. Write essays, manage playbooks, calibrate voice, browse the Communio directory, and explore the mission Atlas — all draft-first, versioned, and audited. Admin settings (Switches, Gardeners, Notifications) live in Platform Config.',
    tabs: ['Library', 'Playbooks', 'Voice & Tone', 'Communio Directory', 'Atlas'],
    whatYouSee: [
      'Library tab: Full essay CRUD with draft/publish workflow, SEO metadata, and AI assist',
      'Playbooks tab: Markdown editor for AI knowledge documents with version history',
      'Voice & Tone tab: Calibrate NRI narrative style per archetype',
      'Communio Directory tab: Moderate cross-tenant collaboration profiles',
      'Atlas tab: Geographic mission atlas for ecosystem territory visualization',
    ],
    whatToDo: [
      'Edit essays in draft mode, preview before publishing',
      'Update playbooks when operational procedures change',
      'Use AI Assist for tone refinement — always review before accepting',
      'Browse Communio directory to moderate profile content',
    ],
    tips: [
      'Every edit creates an audit trail in gardener_audit_log',
      'AI Assist has a 10-use-per-session limit to prevent over-reliance',
      'Playbook versions are preserved — you can always roll back',
      'For feature switches, gardener management, and notification templates, go to Platform Config',
    ],
  },

  // ═══════════════════════════════════════════════
  // CRESCERE — Growth & Economics
  // ═══════════════════════════════════════════════
  {
    icon: Activity,
    title: 'Dashboard (Overview)',
    route: '/operator',
    zone: 'crescere',
    summary: 'Your landing dashboard. Shows platform-wide health at a glance — active tenants, recent automation runs, ecosystem pulse, and narrative balance.',
    whatYouSee: [
      'Active tenant count and recent sign-ups',
      'Automation run success/failure rates (last 24h / 7d)',
      'Ecosystem Pulse — archetype-level heatmap of mission type activity',
      'Narrative Balance — distribution of NRI signal types (drift, momentum, reconnection, growth)',
      'Connector Confidence Score — weighted health of all integration connectors',
    ],
    whatToDo: [
      'Check this page daily to spot anomalies — a sudden drop in automation success or a spike in drift signals',
      'Click any metric card to drill into the relevant section',
      'Use the Ecosystem Pulse to identify underserved archetypes that may need onboarding support',
    ],
    tips: [
      'If Connector Confidence drops below 80%, jump to Integrations immediately',
      'Narrative Balance skewing heavily toward "drift" may indicate tenants need re-engagement nudges',
    ],
  },
  {
    icon: Users,
    title: 'Tenants',
    route: '/operator/tenants',
    zone: 'crescere',
    summary: 'The master list of every organization on the platform. View subscription status, usage meters, and drill into individual tenant health.',
    whatYouSee: [
      'Table of all tenants with name, archetype, tier, status, and last-active date',
      'Search and filter by archetype, tier, or status',
      'Click a tenant row to open the detail view',
    ],
    whatToDo: [
      'Review new tenants weekly to ensure onboarding is progressing',
      'Check usage meters for tenants approaching tier limits',
      'Flag tenants that have been inactive for 14+ days for outreach',
    ],
    tips: [
      'The detail page shows aggregated usage from the usage_events table — useful for billing accuracy checks',
      'Demo tenants are clearly labeled and safe for destructive testing',
    ],
  },
  {
    icon: Building2,
    title: 'Partners',
    route: '/operator/partners',
    zone: 'crescere',
    summary: 'The gardener CRM view of all opportunities (organizations). Search, filter, and drill into partner detail pages with subscription info, journey chapters, and contacts.',
    whatYouSee: [
      'Searchable table of all opportunities with organization name, metro, stage, status, and tier',
      'Filter by stage, status, partner tier, or metro',
      'Click a row to open the full Partner Detail page',
    ],
    whatToDo: [
      'Use this as your primary CRM workspace — every organization lives here',
      'On the detail page, review subscription status (plan tier, seats, onboarding state)',
      'Check the "Story" tab for journey chapters and reflections',
      'Use "Convert to Customer" when a partner signs an agreement',
    ],
    tips: [
      'Partners without a tenant_slug haven\'t been converted to customers yet — use the conversion flow',
    ],
  },
  {
    icon: MapPin,
    title: 'Metros',
    route: '/operator/metros',
    zone: 'crescere',
    summary: 'Full management for all metro regions. Create, edit, and delete metros that define geographic scope for the entire platform.',
    whatYouSee: [
      'Table of all metros with name, readiness index, status, demand score, and ops score',
      'Search by metro name',
      'Create, edit, and delete controls',
    ],
    whatToDo: [
      'Add new metros when expanding into a new geographic region',
      'Update readiness scores and recommendations as conditions change',
      'Review metros with low ops scores — they may need attention',
    ],
    tips: [
      'Metro data feeds Local Pulse keyword sets, narrative engines, and ecosystem intelligence',
      'Changing a metro name cascades to all linked opportunities and events in the UI',
    ],
  },
  {
    icon: Calendar,
    title: 'Scheduling',
    route: '/operator/scheduling',
    zone: 'crescere',
    summary: 'Gardener-scoped calendar for managing outreach meetings, demo sessions, onboarding calls, and platform-level events.',
    whatYouSee: [
      'Calendar view of gardener-created events',
      'Event types: outreach, demo, onboarding, and standard types',
      'Click a date to create a new event',
    ],
    whatToDo: [
      'Schedule demo sessions with prospective partners',
      'Book onboarding calls for newly converted customers',
      'Review upcoming outreach meetings weekly',
    ],
    tips: [
      'Events created here are visible in the gardener calendar only, not tenant calendars',
    ],
  },
  {
    icon: Users,
    title: 'People',
    route: '/operator/people',
    zone: 'crescere',
    summary: 'Browse and manage all contacts across the ecosystem. View contact details, organization affiliations, and relationship history.',
    whatYouSee: [
      'Full contact list with search and filters',
      'Contact details, linked opportunities, and metro context',
    ],
    whatToDo: [
      'Review contact records for completeness before outreach',
      'Navigate to individual contact profiles for deeper context',
    ],
  },
  {
    icon: UserSearch,
    title: 'Find People',
    route: '/operator/find-people',
    zone: 'crescere',
    summary: 'Cross-tenant people search. Find contacts across all tenants by name, email, organization, or metro.',
    whatYouSee: [
      'Global search across all tenant contacts',
      'Results with tenant context, organization, and metro',
    ],
    whatToDo: [
      'Use this to locate contacts when handling cross-tenant support requests',
      'Verify contact information before outreach campaigns',
    ],
  },
  {
    icon: CalendarSearch,
    title: 'Find Events',
    route: '/operator/find-events',
    zone: 'crescere',
    summary: 'Cross-tenant event search. Discover events across the ecosystem for coordination, overlap detection, and outreach planning.',
    whatYouSee: [
      'Global event search across all tenants',
      'Event details with tenant and metro context',
    ],
    whatToDo: [
      'Check for event overlaps when planning community gatherings',
      'Identify high-activity periods for capacity planning',
    ],
  },
  {
    icon: ListChecks,
    title: 'Activities',
    route: '/operator/activities',
    zone: 'crescere',
    summary: 'Gardener-scoped activity log. Track calls, meetings, emails, and touchpoints at the platform level.',
    whatYouSee: [
      'Activity feed with type, date, and linked opportunity/contact',
      'Filter by activity type and date range',
    ],
    whatToDo: [
      'Log all gardener-level touchpoints for accountability',
      'Review activity history before partner meetings for context',
    ],
  },
  {
    icon: Mail,
    title: 'Outreach',
    route: '/operator/outreach',
    zone: 'crescere',
    summary: 'Manage signup tracking links for campaigns. Create branded links, track conversion sources, and measure campaign performance.',
    whatYouSee: [
      'List of signup links with slug, campaign name, archetype, and creation date',
      'Copy-to-clipboard for each link URL',
      'Performance stats from conversion tracking',
    ],
    whatToDo: [
      'Create a tracking link before launching any outreach campaign',
      'Share links in emails, landing pages, or partner communications',
      'Review performance weekly — which campaigns are generating leads?',
    ],
    tips: [
      'Each link redirects through an edge function that stamps the conversion_source on the lead opportunity',
      'Slugs must be unique — use descriptive names like "spring-2026-churches"',
    ],
  },
  {
    icon: Globe,
    title: 'Ecosystem',
    route: '/operator/ecosystem',
    zone: 'crescere',
    summary: 'Aggregated metro-level ecosystem intelligence. View metros grouped by ecosystem status — emerging, expansion pipeline, dormant, or active — with growth metrics.',
    whatYouSee: [
      'Summary cards showing count of metros in each ecosystem status',
      'List view grouped by status with tenant counts and growth velocity',
      'Communio overlap scores showing cross-tenant collaboration density',
    ],
    whatToDo: [
      'Identify emerging metros that may need additional onboarding support',
      'Review expansion pipeline metros for readiness to advance',
      'Monitor dormant metros — consider whether to re-engage or archive',
    ],
    tips: [
      'No tenant data is exposed here — only aggregated metro-level metrics',
      'Ecosystem status is manually set on the metros table — categorize your growth strategy here',
    ],
  },
  {
    icon: Search,
    title: 'SEO',
    route: '/operator/seo',
    zone: 'crescere',
    summary: 'Platform SEO management. Monitor search visibility, meta configurations, and organic discovery for the public-facing CROS presence.',
    whatYouSee: [
      'SEO configuration for public pages',
      'Meta tag management and preview',
    ],
    whatToDo: [
      'Review and update meta descriptions for key landing pages',
      'Monitor organic search performance metrics',
    ],
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    route: '/operator/announcements',
    zone: 'crescere',
    summary: 'Broadcast soft neutral banners to all tenants or specific archetypes. Reduces support tickets by proactively communicating changes.',
    whatYouSee: [
      'List of active and expired announcements',
      'Create form: title, body, audience (all or archetype), expiry date',
      'Preview of how the banner appears to tenants',
    ],
    whatToDo: [
      'Announce planned maintenance windows 48 hours in advance',
      'Communicate new features or workflow changes',
      'Set appropriate expiry dates — stale banners erode trust',
    ],
    tips: [
      'Keep announcements brief and action-oriented',
      'Use archetype targeting for feature announcements only relevant to certain mission types',
    ],
  },
  {
    icon: Settings,
    title: 'Gardener Settings',
    route: '/operator/settings',
    zone: 'crescere',
    summary: 'Your personal gardener settings. Manage Gmail and Google Calendar connections, notification preferences, and workspace configuration.',
    whatYouSee: [
      'Gmail integration status and connection controls',
      'Google Calendar sync configuration',
      'Personal notification preferences',
    ],
    whatToDo: [
      'Connect Gmail for email campaign functionality',
      'Link Google Calendar for scheduling sync',
      'Adjust notification preferences to match your daily rhythm',
    ],
  },

  // ═══════════════════════════════════════════════
  // SCIENTIA — Insight & Understanding
  // ═══════════════════════════════════════════════
  {
    icon: BarChart3,
    title: 'Analytics',
    route: '/operator/nexus/analytics',
    zone: 'scientia',
    summary: 'Gardener-scoped analytics dashboard. Strategic metrics across the entire platform — not tenant-level, but ecosystem-level insights told through narrative, not charts alone.',
    whatYouSee: [
      'Ecosystem-wide metric summaries',
      'Trend lines for adoption, engagement, and narrative health',
    ],
    whatToDo: [
      'Review analytics weekly during your planning ritual',
      'Use trends to inform activation and outreach priorities',
    ],
  },
  {
    icon: Globe,
    title: 'Federation Analytics',
    route: '/operator/nexus/federation-analytics',
    zone: 'scientia',
    summary: 'Single-pane-of-glass view across all 22 federation apps. Web Vitals (GA4 traffic), Revenue (Stripe + tenants), and Health (tracking installation audit) in three tabs.',
    tabs: ['Web Vitals', 'Revenue', 'Health'],
    whatYouSee: [
      'Web Vitals tab: per-app GA4 sessions/users/pageviews (7d and 28d)',
      'Revenue tab: tenant counts and Stripe Connect split status per app',
      'Health tab: which apps are firing vs silent vs error — diagnoses missing GA installations',
      'Orphan GA properties — GA4 properties not mapped to any federation_apps slug',
      'Summary cards: total firing apps, silent apps, 7d sessions, active tenants',
    ],
    whatToDo: [
      'Check the Health tab to find apps with GA properties but no traffic — they need Measurement IDs installed in their frontend code',
      'Use Web Vitals to spot which apps are gaining/losing traction',
      'Refresh manually after a deploy to confirm new tracking is firing',
      'Click any property ID to jump straight into the GA4 console for that app',
    ],
    tips: [
      'Silent apps are the #1 finding — GA property exists but Measurement ID (G-XXXX) isn\'t in the app\'s index.html or root layout',
      'Federation GA report reuses the gardener_ga_connections OAuth from the Analytics page — authorize Google Analytics there first if you see errors',
      'Orphan GA properties should either be mapped to a slug or archived in the GA admin',
      'Data refreshes every 5 minutes automatically; manual refresh button forces a re-fetch',
    ],
  },
  {
    icon: Feather,
    title: 'Narrative',
    route: '/operator/nexus/narrative',
    zone: 'scientia',
    summary: 'Platform-wide narrative engine controls. Understand how NRI generates and surfaces narrative intelligence across the ecosystem.',
    whatYouSee: [
      'Narrative engine configuration',
      'NRI output samples and quality metrics',
    ],
    whatToDo: [
      'Review NRI output quality weekly',
      'Tune narrative parameters for different archetypes',
    ],
  },
  {
    icon: Pen,
    title: 'Content Pipeline',
    route: '/operator/nexus/content',
    zone: 'scientia',
    summary: 'Raw list view of editorial drafts and published content. A lightweight companion to the Garden Studio — use this to quickly scan all content items, their status, and last edit dates.',
    whatYouSee: [
      'Flat list of all essays, playbooks, and narrative drafts',
      'Status badges: draft, published, archived',
      'Last edited timestamp and author',
    ],
    whatToDo: [
      'Scan for stale drafts that need attention',
      'Click through to Garden Studio to edit any item',
      'Use as a quick inventory check before publishing cycles',
    ],
    tips: [
      'For full editing, use Garden Studio — the Content Pipeline is for triage and overview only',
    ],
  },
  {
    icon: Sparkles,
    title: 'Discovery Insights',
    route: '/operator/nexus/discovery-insights',
    zone: 'scientia',
    summary: 'Human-centric behavioral pattern observations. Insight cards surface Discovery Interest and Adoption Friction from anonymized app events — never technical errors, never PII.',
    whatYouSee: [
      'Insight cards framed in warm-professional language ("Visitors seem drawn to…")',
      'Discovery Interest: features or pages attracting sustained attention',
      'Adoption Friction: navigation loops, form hesitation, or drop-off patterns',
      'Linked playbooks for suggested responses',
    ],
    whatToDo: [
      'Review insights during your Morning Examen or weekly planning',
      'Follow linked playbooks to act on friction observations',
      'Maximum 3 insights per day — quality over quantity',
    ],
    tips: [
      'Insights are sourced from app_event_stream with is_error=false only',
      'Database-level deduplication prevents noise from repeated patterns',
    ],
  },
  {
    icon: Globe,
    title: 'Civitas Studio',
    route: '/operator/nexus/civitas',
    zone: 'scientia',
    summary: 'Community-layer design workspace. Configure how the Civitas (community) features present across the platform.',
    whatYouSee: [
      'Civitas feature configuration panels',
      'Community narrative settings',
    ],
    whatToDo: [
      'Configure community features for new metros',
      'Adjust narrative tone per archetype',
    ],
  },
  {
    icon: BookOpen,
    title: 'Testimonium',
    route: '/operator/testimonium',
    zone: 'scientia',
    summary: 'Platform-wide narrative intelligence rollups. View witness events, weekly story summaries, drift detection, and momentum signals across all tenants.',
    whatYouSee: [
      'Weekly rollup summaries with drift/momentum/reconnection counts per tenant',
      'Witness event timeline showing recent narrative captures',
      'Story signal distribution across archetypes',
      'Export-ready narrative reports for leadership',
    ],
    whatToDo: [
      'Review weekly rollups every Monday to understand platform narrative health',
      'Identify tenants with high drift counts — they may need proactive support',
      'Use the export feature to generate leadership reports',
    ],
  },
  {
    icon: Globe,
    title: 'Narrative Economy',
    route: '/operator/nexus/narrative-ecosystem',
    zone: 'scientia',
    summary: 'Ecosystem-level narrative economy metrics. Track how narrative intelligence flows, accumulates, and creates value across the platform.',
    whatYouSee: [
      'Narrative economy health indicators',
      'Signal flow patterns between tenants and archetypes',
      'Value creation metrics from NRI outputs',
    ],
    whatToDo: [
      'Monitor narrative economy health for imbalances',
      'Identify archetypes contributing disproportionately to or consuming narrative signals',
    ],
  },

  // ═══════════════════════════════════════════════
  // SILENTIUM — Internal Tooling & Dev Utilities
  // ═══════════════════════════════════════════════
  {
    icon: Camera,
    title: 'Tour Runner',
    route: '/operator/tour',
    zone: 'silentium',
    summary: 'Generate a step-by-step walkthrough of the tenant user experience. Walk through key screens and capture screenshots for QA documentation and leadership presentations.',
    whatYouSee: [
      'Scripted tour path through key tenant screens',
      'Step-by-step callouts explaining what each screen shows',
      '"Capture Screenshot" button at each step for local PNG download',
    ],
    whatToDo: [
      'Run a tour after major UI changes to update QA documentation',
      'Capture screenshots at each step for stakeholder presentations',
      'Use this for onboarding new gardeners — walk them through what a tenant sees',
    ],
    tips: [
      'Screenshots are saved locally, not stored in the database',
      'The tour operates on a demo tenant, so all data is safe for external sharing',
    ],
  },
  {
    icon: FlaskConical,
    title: 'Demo Lab (Scenario Lab)',
    route: '/operator/scenario-lab',
    zone: 'silentium',
    summary: 'Seed named scenarios and run deterministic simulations. Test the full CROS experience — journeys, reflections, campaigns, events — without touching production data.',
    whatYouSee: [
      'Scenario registry: church_small, gov_medium, coalition_large, importer_csv, hubspot_hybrid',
      'Demo tenant selector for targeting simulation runs',
      'Simulation controls: seed, run 7-day simulation, migration dry-run/commit/rollback',
      'Event ledger showing every simulated action with outcomes',
    ],
    whatToDo: [
      'Before any release, seed at least 2 scenarios and run full simulations',
      'Check the event ledger for any "error" or "warning" outcomes',
      'Use different intensity levels (light/normal/heavy) to stress-test the system',
    ],
    tips: [
      'Simulations are deterministic: same scenario_key + run_key = same outputs — ideal for regression testing',
      'Rollback is only available for demo tenants — enforced at the Edge Function level',
    ],
  },
  {
    icon: ShieldAlert,
    title: 'Global Overrides',
    route: '/operator/overrides',
    zone: 'silentium',
    summary: 'Platform-wide kill switches that override tenant-level feature flags. When an override disables a feature, no tenant can use it regardless of their own settings.',
    whatYouSee: [
      'Toggle switches for: campaigns, migrations, communio_sharing, ai_suggestions',
      'Reason field explaining why each override was set',
      'Timestamp and gardener who set each override',
    ],
    whatToDo: [
      'Disable campaigns during maintenance windows to prevent email sends',
      'Disable migrations if a connector is experiencing upstream issues',
      'Always add a reason when toggling — this creates an audit trail',
    ],
    tips: [
      'Gardener overrides ALWAYS win over tenant-level feature flags',
      'Re-enable features promptly after maintenance — tenants cannot override this themselves',
    ],
  },
  {
    icon: Clock,
    title: 'Time Machine',
    route: '/operator/time-machine',
    zone: 'silentium',
    summary: 'A unified narrative audit timeline that replays platform events chronologically — migrations, demo seeds, Testimonium captures, and Communio signals.',
    whatYouSee: [
      'Chronological feed of platform events with warm, narrative-style cards',
      'Filter chips: All / Migrations / Demo / Communio / Narrative / Integrations',
      'Infinite scroll for deep historical exploration',
    ],
    whatToDo: [
      'Use this to reconstruct what happened after an incident — "what changed when?"',
      'Filter to Migrations when debugging import issues',
      'Review Communio events to understand cross-tenant signal flow',
    ],
    tips: [
      'This is NOT analytics. It is narrative replay — read it like a story',
      'Events are aggregated from multiple source tables but displayed in a unified timeline',
    ],
  },
  {
    icon: BookOpen,
    title: 'Manuals',
    route: '/operator/manuals',
    zone: 'silentium',
    summary: 'Gardener reference manuals and technical documentation. Long-form guides for complex operational procedures.',
    whatYouSee: [
      'Manual library organized by topic',
      'Full document rendering with navigation',
    ],
    whatToDo: [
      'Reference manuals for complex operational procedures',
      'Keep manuals updated as platform processes evolve',
    ],
  },
  {
    icon: MapPin,
    title: 'Territory Management',
    route: '/operator/nexus/expansion',
    zone: 'crescere',
    summary: 'The unified territory model replaces metro-only geography with support for metros, county bundles, states, countries, and mission fields. Fair rural pricing ensures county bundles (up to 5) cost 1 slot.',
    whatYouSee: [
      'Territory activations per tenant (metro, county, state, country)',
      'County bundle compositions and state groupings',
      'Mission field hierarchies under parent countries',
      'Solo caregiver base locations (aggregate only, never individual)',
      'Activation slot consumption across the ecosystem',
    ],
    whatToDo: [
      'Monitor territory activation patterns across archetypes',
      'Verify county bundles respect same-state rule',
      'Track missionary org country activations',
      'Review expansion readiness by territory type',
      'Ensure solo caregiver base locations are never exposed publicly',
    ],
  },
  {
    icon: HelpCircle,
    title: 'Gardener Guide',
    route: '/operator/how-to',
    zone: 'silentium',
    summary: 'You are here. This guide covers every section of the Gardener Console with what you\'ll see, what to do, and practical tips.',
    whatYouSee: ['This page!'],
    whatToDo: ['Bookmark it. Reference it. Share it with new gardeners.'],
  },
];

// ─────────────────────────────────────
// HELPERS
// ─────────────────────────────────────

/** Get all entries for a specific zone */
export function getEntriesByZone(zone: GardenerZone): GardenerNavEntry[] {
  return GARDENER_NAV_REGISTRY.filter(e => e.zone === zone);
}

/** Get a single entry by route */
export function getEntryByRoute(route: string): GardenerNavEntry | undefined {
  return GARDENER_NAV_REGISTRY.find(e => e.route === route);
}

/** All unique routes in the registry */
export function getAllRegisteredRoutes(): string[] {
  return GARDENER_NAV_REGISTRY.map(e => e.route);
}

/** Dev-mode: warn if a route exists in the zone registry but not here */
export function warnMissingRegistryEntries(zoneRoutes: string[]): void {
  if (!import.meta.env.DEV) return;
  const registered = new Set(getAllRegisteredRoutes());
  for (const route of zoneRoutes) {
    if (!registered.has(route)) {
      console.warn(
        `[GardenerNavRegistry] Route "${route}" is in the zone registry but missing from GARDENER_NAV_REGISTRY. ` +
        `Add it to gardenerNavRegistry.ts so it appears in the Gardener Guide.`
      );
    }
  }
}
