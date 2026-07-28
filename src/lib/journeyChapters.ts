/**
 * Journey Chapter mapping — display-only rename from legacy pipeline stages.
 * NO database migrations. NO bulk data rewrites.
 * Legacy values are mapped to chapters on read; canonical chapter labels
 * are written only when the user explicitly creates or changes a chapter.
 */

export const CHAPTERS = [
  'Found',
  'First Conversation',
  'Discovery',
  'Pricing Shared',
  'Account Setup',
  'First Devices',
  'Growing Together',
  'Not the Right Time',
] as const;

export type Chapter = (typeof CHAPTERS)[number];

/** Map from legacy DB stage values → canonical chapter label */
const LEGACY_TO_CHAPTER: Record<string, Chapter> = {
  'Target Identified': 'Found',
  'Contacted': 'First Conversation',
  'Discovery Scheduled': 'Discovery',
  'Discovery Held': 'Discovery',
  'Proposal Sent': 'Pricing Shared',
  'Agreement Pending': 'Account Setup',
  'Agreement Signed': 'Account Setup',
  'First Volume': 'First Devices',
  'Stable Producer': 'Growing Together',
  'Closed - Not a Fit': 'Not the Right Time',
};

const CANONICAL_SET = new Set<string>(CHAPTERS);

/**
 * Convert any stored stage value (legacy or canonical) to a display chapter label.
 * - If storedValue is already a canonical chapter, return it.
 * - If it matches a legacy stage, return the mapped chapter.
 * - Otherwise return 'Found' as a safe fallback.
 */
export function toChapterLabel(storedValue: string | null | undefined): Chapter {
  if (!storedValue) return 'Found';
  if (CANONICAL_SET.has(storedValue)) return storedValue as Chapter;
  return LEGACY_TO_CHAPTER[storedValue] ?? 'Found';
}

/** Check whether a value is already a canonical chapter label. */
export function isCanonicalChapter(value: string): value is Chapter {
  return CANONICAL_SET.has(value);
}

/** Chapter colors for UI badges / pills */
export const CHAPTER_COLORS: Record<Chapter, string> = {
  'Found': 'hsl(280, 60%, 55%)',
  'First Conversation': 'hsl(199, 89%, 48%)',
  'Discovery': 'hsl(217, 91%, 50%)',
  'Pricing Shared': 'hsl(38, 92%, 50%)',
  'Account Setup': 'hsl(25, 95%, 53%)',
  'First Devices': 'hsl(142, 71%, 45%)',
  'Growing Together': 'hsl(173, 80%, 40%)',
  'Not the Right Time': 'hsl(0, 0%, 50%)',
};

/** CSS class names for chapter badges (reusing existing stage-* classes where possible) */
export const CHAPTER_BADGE_CLASS: Record<Chapter, string> = {
  'Found': 'stage-target',
  'First Conversation': 'stage-contacted',
  'Discovery': 'stage-discovery',
  'Pricing Shared': 'stage-proposal',
  'Account Setup': 'stage-agreement',
  'First Devices': 'stage-signed',
  'Growing Together': 'stage-volume',
  'Not the Right Time': 'bg-muted text-muted-foreground',
};

/**
 * The "early" chapters that live in the `opportunities` table.
 * Used by Pipeline/Journey page to pull from opportunities vs anchor_pipeline.
 */
export const EARLY_CHAPTERS: Chapter[] = ['Found', 'First Conversation', 'Discovery'];

/**
 * The "early" legacy stage values that also map to early chapters.
 * Needed to query the DB which may still hold legacy values.
 */
export const EARLY_LEGACY_STAGES = [
  'Target Identified', 'Contacted', 'Discovery Scheduled',
  // Also include canonical early chapters for records already updated
  'Found', 'First Conversation', 'Discovery',
];

/**
 * Journey chapters displayed on the kanban board (excludes "Not the Right Time").
 */
export const JOURNEY_KANBAN_CHAPTERS: Chapter[] = [
  'Found',
  'First Conversation',
  'Discovery',
  'Pricing Shared',
  'Account Setup',
  'First Devices',
  'Growing Together',
];
