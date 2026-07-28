/**
 * Scoring weights for weekly focus plan items
 * Positive values = more urgent/important
 * Negative values = dampen priority
 */
export const SCORING_WEIGHTS = {
  // High priority signals
  OVERDUE_NEXT_ACTION: 40,
  GRANT_DEADLINE_14_DAYS: 35,
  ANCHOR_PROBABILITY_70_PLUS: 30,
  NEXT_ACTION_7_DAYS: 25,
  OPPORTUNITY_INACTIVE_30_DAYS: 25,
  
  // Medium priority signals
  EVENT_THIS_WEEK_NO_FOLLOWUP: 20,
  ESTIMATED_VOLUME_60_DAYS: 20,
  NO_PRIMARY_CONTACT: 15,
  PENDING_AI_BUNDLES: 10,
  PENDING_AI_BUNDLES_OLD: 15,
  
  // Dampening signals (reduce priority)
  RECENT_ACTIVITY_3_DAYS: -15,
  OPPORTUNITY_ON_HOLD: -50,
  MARKED_DONE_THIS_WEEK: -100,
  
  // Event Week context (boosts items related to active conference)
  EVENT_WEEK_ACTIVE_CONFERENCE: 15,
  EVENT_WEEK_RECENT_CONFERENCE: 10,  // ended within 2 days
} as const;

/**
 * Minimum score required for an item to appear in the focus plan
 */
export const MIN_SCORE_THRESHOLD = 25;

/**
 * Maximum number of items in the focus plan
 */
export const MAX_ITEMS = 10;

/**
 * Maximum items per category to ensure diversity
 */
export const MAX_PER_CATEGORY = 3;

export type ScoringWeightKey = keyof typeof SCORING_WEIGHTS;
