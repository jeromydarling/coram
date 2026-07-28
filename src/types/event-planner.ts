/**
 * Event Planner (Conference Mode) Types
 * 
 * Types for attendee management, matching, target scoring, and conference plans.
 */

export type AttendeeMatchStatus = 'matched' | 'possible' | 'new' | 'unmatched' | 'dismissed';

export interface EventAttendee {
  id: string;
  event_id: string;
  raw_full_name: string;
  raw_org: string | null;
  raw_title: string | null;
  raw_email: string | null;
  raw_phone: string | null;
  linkedin_url: string | null;
  tags: string[];
  match_status: AttendeeMatchStatus;
  matched_contact_id: string | null;
  matched_opportunity_id: string | null;
  confidence_score: number;
  target_score: number;
  target_reasons: string[];
  is_target: boolean;
  created_at: string;
  updated_at: string;
  // Joined data for display
  matched_contact?: { id: string; name: string; email: string | null; title: string | null } | null;
  matched_opportunity?: { id: string; organization: string; stage: string } | null;
}

export interface ConferencePlanItem {
  id: string;
  rank: number;
  attendee_id: string;
  attendee_name: string;
  organization: string | null;
  title: string | null;
  recommended_action: string;
  primary_cta: {
    label: string;
    action: 'log_activity' | 'schedule_followup' | 'open_attendee' | 'create_contact';
  };
  score: number;
  reasons: string[];
  status: 'open' | 'done' | 'dismissed';
}

// Target scoring weights (deterministic, no AI)
export const TARGET_SCORING_WEIGHTS = {
  ALREADY_IN_CRM: 20,
  ORG_IS_ANCHOR_HIGH_VOLUME: 25,
  TITLE_DIRECTOR_VP_PARTNERSHIPS: 15,
  ORG_KEYWORDS_MATCH_GOALS: 15,
  LOCAL_METRO_RELEVANCE: 10,
} as const;

export const TARGET_TITLE_KEYWORDS = [
  'director', 'vp', 'vice president', 'partnerships', 'partner', 
  'executive', 'ceo', 'coo', 'president', 'manager', 'lead',
  'chief', 'head', 'coordinator', 'outreach'
];

// Placeholder org keywords for goal matching
export const ORG_GOAL_KEYWORDS = [
  'housing', 'community', 'digital', 'equity', 'access',
  'nonprofit', 'foundation', 'services', 'education'
];

// Import row from CSV/paste
export interface AttendeeImportRow {
  raw_full_name: string;
  raw_org?: string;
  raw_title?: string;
  raw_email?: string;
  raw_phone?: string;
  linkedin_url?: string;
}

// For matching algorithm
export interface MatchResult {
  status: AttendeeMatchStatus;
  confidence: number;
  contact?: { id: string; name: string; email: string | null } | null;
  opportunity?: { id: string; organization: string } | null;
}
