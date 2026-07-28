/**
 * CROS Type Aliases — Human-centered names for legacy CRM types.
 *
 * WHAT: Re-exports existing types under CROS-aligned names so new code can use relationship language.
 * WHERE: Import from '@/types/cros' in all new components.
 * WHY: Gradual migration from CRM jargon (Opportunity, Pipeline) to CROS language (Partner, Journey) without breaking existing imports.
 */

// ── Core entity aliases ──
export type { Opportunity as Partner } from './index';
export type { Contact as Person } from './index';
export type { AnchorPipeline as JourneyEntry } from './index';
export type { Anchor as SustainedPartner } from './index';
export type { Event as CommunityEvent } from './index';
export type { Activity as TouchPoint } from './index';

// ── Stage aliases ──
export type { OpportunityStage as JourneyChapter } from './index';
export type { PipelineStage as JourneyStage } from './index';
export type { OpportunityStatus as PartnerStatus } from './index';

// ── Tier aliases ──
export type { PartnerTier as RelationshipTier } from './index';
export type { AnchorTier as SustainedTier } from './index';

// ── Dashboard ──
export type { DashboardKPI, PipelineByStage as JourneyByChapter, AnchorsByMonth as SustainedByMonth } from './index';

// ── Territory types ──
export type TerritoryType = 'metro' | 'county' | 'state' | 'country' | 'mission_field' | 'custom_region';

export interface Territory {
  id: string;
  territory_type: TerritoryType;
  name: string;
  parent_id: string | null;
  state_code: string | null;
  country_code: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  population_estimate: number | null;
  metro_id: string | null;
  active: boolean;
}

export interface TenantTerritory {
  id: string;
  tenant_id: string;
  territory_id: string;
  bundle_id: string | null;
  activation_slots: number;
  is_home: boolean;
}

// ── Human-language stage labels ──
export const JOURNEY_CHAPTER_LABELS: Record<string, string> = {
  'Target Identified': 'Found',
  'Contacted': 'First Conversation',
  'Discovery Scheduled': 'Meeting Planned',
  'Discovery Held': 'Discovery',
  'Proposal Sent': 'Pricing Shared',
  'Agreement Pending': 'Account Setup',
  'Agreement Signed': 'Agreement',
  'First Volume': 'First Devices',
  'Stable Producer': 'Growing Together',
  'Closed - Not a Fit': 'Not the Right Time',
};

// ── Re-export everything from index for convenience ──
export * from './index';
