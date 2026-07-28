/**
 * Calm Mode — Global UX system for CROS operator experience.
 *
 * WHAT: Constants + helpers that enforce narrative-first, non-urgent language.
 * WHERE: Used across operator and tenant UI to soften alert language.
 * WHY: CROS believes systems should serve humans gently, not alarm them.
 *
 * Governed by: src/lib/toneCharter.ts (CROS™ Tone & Language Charter)
 */

/** Master toggle — when true, all urgency styling is suppressed. */
export const CALM_MODE = true;

/**
 * Narrative rewrites: maps harsh system language to warm, human phrasing.
 */
const narrativeRewrites: Record<string, string> = {
  // System status
  'Integration Failure': 'This connection may need a quick look',
  'Critical Issue': 'Something may be waiting for attention',
  'Error': 'Something did not go as expected',
  'Warning': 'A gentle heads-up',
  'Failed': 'Did not complete this time',
  'Timeout': 'Took longer than expected',
  'Unauthorized': 'Access could not be confirmed',
  'Rate Limited': 'We are pacing things — try again shortly',
  'Connection Lost': 'Connection paused — we will keep trying',
  'Invalid Data': 'Something looks a little off with this data',
  'Missing Required Field': 'We need a bit more information here',
  'Sync Failed': 'Sync paused — may need a quick look',
  'Deployment Failed': 'Deployment paused — we are looking into it',
  'Subscription Expired': 'Your plan may need a renewal',
  'Quota Exceeded': 'You have reached this period usage pool',
  'Stale': 'It has been a while since this was updated',
  'Alert': 'Something to be aware of',
  'Danger': 'Needs careful attention',
  'Blocked': 'Paused for now',
  'Rejected': 'Not accepted this time',
  'Expired': 'This has run its course',

  // Charter-mandated replacements
  'No Data': 'Every relationship begins somewhere',
  'No data': 'Every relationship begins somewhere',
  'No results': 'Every relationship begins somewhere',
  'Overdue': 'Waiting',
  'Inactive': 'The thread is still here',
  'Loading...': 'Still gathering the thread…',
  'Saved': 'Held',
  'Saved!': 'Held.',
  'Success': 'Noted',
  'Success!': 'Noted.',
  'Completed': 'Follow-through recorded',
  'Deleted': 'Removed',
  'Done': 'Noted',
  'Done!': 'Noted.',
};

/**
 * Rewrite a system message into calm, narrative language.
 * If no rewrite exists, returns the original.
 */
export function calmText(original: string): string {
  if (!CALM_MODE) return original;
  return narrativeRewrites[original] ?? original;
}

/**
 * Returns a calm-safe CSS variant for badges and status indicators.
 * In Calm Mode, destructive/warning variants are softened.
 */
export function calmVariant(
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (!CALM_MODE) {
    if (status === 'error' || status === 'failed') return 'destructive';
    if (status === 'warning') return 'secondary';
    return 'default';
  }

  // In calm mode, nothing is destructive - everything is gentle
  if (status === 'error' || status === 'failed') return 'secondary';
  if (status === 'warning') return 'outline';
  if (status === 'ok' || status === 'success' || status === 'resolved') return 'default';
  return 'outline';
}

/**
 * Progressive disclosure layer names for operator console.
 * Content should be revealed layer by layer, not all at once.
 */
export type DisclosureLayer = 'overview' | 'health' | 'diagnostics' | 'telemetry';

export const DISCLOSURE_LAYERS: { key: DisclosureLayer; label: string }[] = [
  { key: 'overview', label: 'Human Overview' },
  { key: 'health', label: 'Health Summaries' },
  { key: 'diagnostics', label: 'Diagnostics' },
  { key: 'telemetry', label: 'Raw Telemetry' },
];
