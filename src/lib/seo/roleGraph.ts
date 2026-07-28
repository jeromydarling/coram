/**
 * Role Graph — Maps roles to archetypes, stories, modules, and guides.
 *
 * WHAT: Semantic relationship map centered on CROS roles.
 * WHERE: Powers "Related Paths" blocks at bottom of role pages and guides.
 * WHY: Builds role-centric SEO authority by connecting identity to platform features.
 */

import { stories } from '@/content/stories';
import { insights } from '@/content/insights';
import type { ArchetypeKey } from '@/config/brand';

export interface RoleNode {
  key: string;
  label: string;
  motto: string;
  archetypes: ArchetypeKey[];
  modules: { name: string; description: string }[];
  guides: { slug: string; title: string }[];
}

export const ROLE_GRAPH: Record<string, RoleNode> = {
  shepherd: {
    key: 'shepherd',
    label: 'Shepherd',
    motto: 'Keep the story',
    archetypes: ['church', 'social_enterprise', 'workforce'],
    modules: [
      { name: 'Metro Narrative', description: 'Weekly community story summaries' },
      { name: 'Testimonium', description: 'Drift detection and story signals' },
      { name: 'Signum', description: 'Community signal intelligence' },
      { name: 'Reflections', description: 'Private leadership reflections' },
    ],
    guides: [
      { slug: 'home-visits', title: 'Overseeing Home Visits' },
      { slug: 'weekly-narrative', title: 'Reading the Weekly Narrative' },
      { slug: 'drift-detection', title: 'Understanding Drift Detection' },
    ],
  },
  companion: {
    key: 'companion',
    label: 'Companion',
    motto: 'Keep the thread',
    archetypes: ['digital_inclusion', 'education_access', 'library_system'],
    modules: [
      { name: 'Email-to-Tasks', description: 'Follow-ups from email conversations' },
      { name: 'Reflections', description: 'Journaling after conversations' },
      { name: 'Voluntārium', description: 'Volunteer coordination and hours' },
      { name: 'Events & Calendar', description: 'Community events and scheduling' },
    ],
    guides: [
      { slug: 'provisions', title: 'Managing Technology Provisions' },
      { slug: 'reflections', title: 'Writing Effective Reflections' },
      { slug: 'follow-ups', title: 'Email Follow-up Workflows' },
    ],
  },
  visitor: {
    key: 'visitor',
    label: 'Visitor',
    motto: 'Keep the witness',
    archetypes: ['church', 'refugee_support'],
    modules: [
      { name: 'Voice Notes', description: 'Tap, speak, done — field recording' },
      { name: 'Visit Assignments', description: 'Simple list of who to visit' },
      { name: 'Mobile Experience', description: 'Phone-first, no forms' },
    ],
    guides: [
      { slug: 'voice-notes', title: 'Recording Voice Notes' },
      { slug: 'visit-checklist', title: 'Preparing for a Visit' },
    ],
  },
  steward: {
    key: 'steward',
    label: 'Steward',
    motto: 'Tend the workspace',
    archetypes: ['church', 'digital_inclusion', 'social_enterprise'],
    modules: [
      { name: 'Admin Console', description: 'Workspace setup and team management' },
      { name: 'Activation Checklist', description: 'Guided platform readiness' },
      { name: 'Relatio', description: 'CRM migration and integrations' },
      { name: 'Communio', description: 'Shared narrative network' },
    ],
    guides: [
      { slug: 'workspace-setup', title: 'Setting Up Your Workspace' },
      { slug: 'team-invites', title: 'Inviting Your Team' },
    ],
  },
};

/** Get stories related to a role */
export function getRoleStories(roleKey: string) {
  return stories.filter((s) =>
    s.timeline.some((m) => m.role === roleKey),
  );
}

/** Get insights related to a role */
export function getRoleInsights(roleKey: string) {
  return insights.filter((i) => i.suggestedRole === roleKey);
}

/** Get the role node */
export function getRoleNode(roleKey: string): RoleNode | undefined {
  return ROLE_GRAPH[roleKey];
}
