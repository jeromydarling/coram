/**
 * appSections — Shared registry of CROS app section metadata.
 *
 * WHAT: Single source of truth for section names, descriptions, and feature requirements.
 * WHERE: Used by Help.tsx (full content) and AdminHowTo.tsx (admin guide) to prevent drift.
 * WHY: Without a shared registry, section metadata drifts between the help page and admin guide.
 */

import type { LucideIcon } from 'lucide-react';

export interface AppSectionMeta {
  /** Unique key matching the section in Help.tsx */
  id: string;
  /** Display name */
  title: string;
  /** One-line description */
  description: string;
  /** Optional feature gate key — section hidden if tenant plan doesn't include it */
  requiredFeature?: string;
  /** Nav group this section belongs to (for cross-referencing) */
  navGroup?: string;
  /** Which lens roles can see this section */
  visibleTo?: ('steward' | 'shepherd' | 'companion' | 'visitor')[];
}

/**
 * Master list of all user-facing app sections.
 * Help.tsx provides the full content; AdminHowTo references this for consistency.
 */
export const APP_SECTIONS: AppSectionMeta[] = [
  { id: 'command-center', title: 'Command Center', description: 'Your daily relationship dashboard — signals, suggestions, and weekly focus.', navGroup: 'Home' },
  { id: 'intelligence', title: 'Movement Intelligence', description: 'Territory-aware movement metrics — care, presence, relationships, and narrative threads.', navGroup: 'Home' },
  { id: 'metros', title: 'Metros', description: 'Geographic territories where your organization operates.', navGroup: 'Metros', visibleTo: ['steward', 'shepherd'] },
  { id: 'intel-feed', title: 'Intelligence Feed', description: 'Prioritized daily summary of signals and new connections.', navGroup: 'Metros', visibleTo: ['steward', 'shepherd'] },
  { id: 'opportunities', title: 'Opportunities', description: 'Partner organizations and the relationships you\'re building.', navGroup: 'Partners' },
  { id: 'pipeline', title: 'Journey', description: 'Visualize where each partnership is in its journey.', navGroup: 'Partners' },
  { id: 'anchors', title: 'Anchors', description: 'Organizations that have reached sustained partnership.', navGroup: 'Partners' },
  { id: 'people', title: 'The People', description: 'Individuals you\'re building relationships with.', navGroup: 'Partners' },
  { id: 'radar', title: 'Radar', description: 'Prioritized partner attention signals.', navGroup: 'Partners' },
  { id: 'graph', title: 'Relationship Graph', description: 'Visual map of connections between organizations.', navGroup: 'Partners' },
  { id: 'calendar', title: 'Calendar', description: 'Upcoming meetings, events, and scheduled activities.', navGroup: 'Scheduling' },
  { id: 'events', title: 'Events', description: 'Community outreach events and partner engagements.', navGroup: 'Scheduling' },
  { id: 'activities', title: 'Activities', description: 'Log of calls, meetings, emails, and touchpoints.', navGroup: 'Scheduling' },
  { id: 'campaigns', title: 'Relatio Campaigns™', description: 'Build and send relationship-first email campaigns.', navGroup: 'Outreach', requiredFeature: 'outreach_campaigns' },
  { id: 'grants', title: 'Grants', description: 'Track funding opportunities from research through award.', navGroup: 'Grants' },
  { id: 'reports', title: 'Reports', description: 'Custom reports, scheduled delivery, and narrative exports.', navGroup: 'Home' },
  { id: 'volunteers', title: 'Voluntārium', description: 'Volunteer management, hours tracking, and recognition.', navGroup: 'Partners' },
  { id: 'provisions', title: 'Prōvīsiō', description: 'Technology provision requests and order tracking.', navGroup: 'Partners' },
  { id: 'testimonium', title: 'Testimonium', description: 'Narrative storytelling and impact insights.', requiredFeature: 'testimonium', navGroup: 'Home' },
  { id: 'communio', title: 'Communio', description: 'Opt-in narrative sharing between CROS workspaces.', navGroup: 'Communio' },
  { id: 'search', title: 'Global Search', description: 'Find anything quickly across the application.', navGroup: 'Home' },
  { id: 'settings', title: 'Settings', description: 'Your profile, notifications, and workspace preferences.', navGroup: 'Home' },
  { id: 'discovery', title: 'Discovery (Signum)', description: 'Territory-aware discovery — finds partners, events, and grants within your activated territories using archetype-sensitive relevance scoring.', navGroup: 'Partners' },
  { id: 'local-pulse', title: 'Local Pulse', description: 'Community event discovery powered by mission keywords via Perplexity search and Firecrawl extraction.', navGroup: 'Scheduling', visibleTo: ['steward', 'shepherd'] },
  { id: 'playbooks', title: 'Playbooks', description: 'Reusable relationship guides and metro-specific procedures.', navGroup: 'Home' },
  { id: 'visits', title: 'Visits', description: 'Simplified mobile-first visit tracking for Visitors.', navGroup: 'Home', visibleTo: ['visitor', 'companion'] },
  { id: 'projects', title: 'Projects (Good Work)', description: 'Community service projects — good work your team does together.', navGroup: 'Scheduling' },
  { id: 'recycle-bin', title: 'Recently Deleted', description: 'Recover soft-deleted records within 7 days.', navGroup: 'Home' },
  { id: 'nri-guide', title: 'NRI Guide (Neary)', description: 'Your AI relationship assistant for questions and suggestions.', navGroup: 'Home' },
  { id: 'stats', title: 'My Stats', description: 'Personal activity summary and contribution metrics.', navGroup: 'Home' },
  { id: 'help-requests', title: 'Help Requests', description: 'Submit feedback, report issues, or request features.', navGroup: 'Home' },
  { id: 'guided-activation', title: 'Guided Activation™', description: 'Human-led onboarding service with operator support.', navGroup: 'Admin' },
  { id: 'help-adoption', title: 'Adoption & Daily Rhythm', description: 'Narrative-first formation space for building daily rhythm across roles.', navGroup: 'Home', visibleTo: ['steward', 'shepherd', 'companion', 'visitor'] },
  { id: 'narrative-threads', title: 'Narrative Threads', description: 'Weekly story threads assembled from reflections, visits, and signals.', navGroup: 'Home' },
  { id: 'impact-dimensions', title: 'Impact Dimensions', description: 'Tenant-configurable structured metrics for events, activities, and provisions.', navGroup: 'Settings', visibleTo: ['steward', 'shepherd'] },
  { id: 'care-logging', title: 'Companion Logging', description: 'Dignified visit and activity logs for companions — private by default.', navGroup: 'Scheduling', visibleTo: ['steward', 'shepherd', 'companion'] },
  { id: 'season-summaries', title: 'Season Summaries', description: 'AI-assisted narrative summaries of accompaniment seasons for a person.', navGroup: 'Home', visibleTo: ['steward', 'shepherd', 'companion'] },
  { id: 'care-completion', title: 'Companion Completion', description: 'Dignified closing ritual when a season of accompaniment ends — reflection, summary, and archiving.', navGroup: 'Home', visibleTo: ['steward', 'shepherd', 'companion'] },
  { id: 'caregiver-privacy', title: 'Privacy Controls (Companions)', description: 'Per-entry privacy toggles and leadership visibility rules for companion organizations.', navGroup: 'Admin', visibleTo: ['steward', 'shepherd'] },
  { id: 'caregiver-guide', title: 'Companion Guide', description: 'Standalone guide for companions — mentors, sponsors, caregivers, and those who walk closely with others.', navGroup: 'Home', visibleTo: ['steward', 'shepherd', 'companion'] },
  {
    id: 'life-events',
    title: 'Life Events',
    description: 'Record structured life events — beginnings, milestones, and endings — on a person\'s record.',
    navGroup: 'people',
    visibleTo: ['steward', 'shepherd', 'companion'],
  },
  {
    id: 'territories',
    title: 'Territories',
    description: 'Unified geography layer — metros, counties, states, countries, and mission fields.',
    navGroup: 'Metros',
    visibleTo: ['steward', 'shepherd'],
  },
  {
    id: 'territory-selection',
    title: 'Territory Selection (Onboarding)',
    description: 'Choose your service area type during onboarding — metro, county bundle, state, or country.',
    navGroup: 'Home',
  },
  {
    id: 'caregiver-base-location',
    title: 'Base Location (Caregivers)',
    description: 'Private location for solo caregivers — never displayed publicly or counted as activation.',
    navGroup: 'Home',
    visibleTo: ['steward', 'shepherd', 'companion'],
  },
  {
    id: 'caregiver-network',
    title: 'Caregiver Network',
    description: 'Privacy-first opt-in network for caregivers to discover and message each other with mediated communication.',
    navGroup: 'communio',
    visibleTo: ['steward', 'shepherd', 'companion'],
  },
  {
    id: 'content-reports',
    title: 'Content Reports',
    description: 'Abuse reporting for Communio profiles and shared content — reviewed by leadership and operators.',
    navGroup: 'Admin',
    visibleTo: ['steward', 'shepherd'],
  },
  {
    id: 'indoles',
    title: 'Personality & Strengths (Indoles)',
    description: 'Personality intelligence — Enneagram, CliftonStrengths, DISC, birthday tracking, and bio enrichment.',
    navGroup: 'people',
    visibleTo: ['steward', 'shepherd', 'companion'],
  },
  {
    id: 'enneagram-assessment',
    title: 'Enneagram Assessment',
    description: 'Self-guided 36-question Enneagram assessment using Ignatian design language.',
    navGroup: 'people',
    visibleTo: ['steward', 'shepherd', 'companion'],
  },
  {
    id: 'organizations',
    title: 'Your Organizations',
    description: 'View and manage your organization memberships — accept invitations, choose how to handle relationships.',
    navGroup: 'Settings',
    visibleTo: ['steward', 'shepherd', 'companion', 'visitor'],
  },
];

/**
 * Lookup a section by id.
 */
export function getSection(id: string): AppSectionMeta | undefined {
  return APP_SECTIONS.find(s => s.id === id);
}

/**
 * Get all sections for a specific nav group.
 */
export function getSectionsForGroup(navGroup: string): AppSectionMeta[] {
  return APP_SECTIONS.filter(s => s.navGroup === navGroup);
}
