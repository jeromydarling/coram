/**
 * CROS™ Tone & Language Charter
 *
 * WHAT: The canonical source of truth for all UI copy, system messaging,
 *       Compass language, friction moments, and future feature development.
 * WHERE: Referenced by every component that renders user-facing text.
 * WHY: CROS is pastoral, steady, and human-centered. Language must reflect
 *       dignity, continuity, and calm. This charter prevents SaaS drift.
 *
 * ────────────────────────────────────────
 * CORE IDENTITY
 * ────────────────────────────────────────
 *
 * CROS™ IS:
 *   Pastoral · Steady · Human-centered
 *
 * CROS™ IS NOT:
 *   Corporate · Gamified · Transactional · Urgent · Manipulative
 *   Sentimental · Theologically explicit in UI
 *
 * ────────────────────────────────────────
 * FOUNDATIONAL PRINCIPLES
 * ────────────────────────────────────────
 *
 * 1. Assume good intent.
 * 2. Never shame.
 * 3. Never rush.
 * 4. Never gamify.
 * 5. Never exaggerate urgency.
 * 6. Always preserve dignity.
 * 7. Prefer continuity over productivity.
 *
 * ────────────────────────────────────────
 * CONFIRMATION LANGUAGE
 * ────────────────────────────────────────
 *
 * Avoid celebratory animations.
 * Use: Noted. Held. Updated. Recorded.
 * Never: Success! Great job! Done! 🎉
 *
 * ────────────────────────────────────────
 * GENEROSITY LANGUAGE
 * ────────────────────────────────────────
 *
 * Never rank donors.
 * Never sort by largest first.
 * Never use: Major donor · Top giver · High-value
 * Use: Generosity · Recurring generosity · Recent generosity
 * Alphabetical default in reports.
 *
 * ────────────────────────────────────────
 * COMPASS VOICE
 * ────────────────────────────────────────
 *
 * Grounded · Brief · Direct · Non-performative
 * No emojis. No exclamation marks. No hype.
 * Opening line: Verso l'alto.
 *
 * ────────────────────────────────────────
 * DRIFT PREVENTION
 * ────────────────────────────────────────
 *
 * Before any new feature ships, evaluate:
 *   1. Does this language preserve dignity?
 *   2. Does it reduce anxiety?
 *   3. Does it avoid urgency manipulation?
 *   4. Does it feel steady?
 *   5. Does it respect relational work?
 * If not, rewrite.
 */

// ─── BANNED WORDS ─────────────────────────────────────────────
// These terms must NEVER appear in user-facing UI copy.
export const BANNED_WORDS = [
  'Boost',
  'Optimize',
  'Crush',
  'Dominate',
  'High-performing',
  'Top donor',
  'Pipeline',
  'Major donor',
  'Top giver',
  'High-value',
  'Success!',
  'Great job!',
  'Done!',
] as const;

// ─── CROS VOCABULARY ──────────────────────────────────────────
// SaaS term → CROS equivalent
export const CROS_VOCABULARY: Record<string, string> = {
  // Confirmations
  'Saved': 'Held',
  'Saved!': 'Held.',
  'Saved successfully': 'Held.',
  'Success': 'Noted',
  'Success!': 'Noted.',
  'Completed': 'Follow-through recorded',
  'Completed!': 'Follow-through recorded.',
  'Done': 'Noted',
  'Done!': 'Noted.',
  'Great job!': 'Noted.',

  // Deletions
  'Deleted': 'Removed',
  'Deleted!': 'Removed.',
  'Deleted successfully': 'Removed.',

  // Empty states
  'No data': 'Every relationship begins somewhere',
  'No data found': 'Every relationship begins somewhere',
  'No results': 'Every relationship begins somewhere',
  'No results found': 'Every relationship begins somewhere',

  // Status
  'Overdue': 'Waiting',
  'Inactive': 'The thread is still here',

  // Loading
  'Loading...': 'Still gathering the thread…',
  'Loading': 'Still gathering the thread…',
};

// ─── FRICTION MOMENT COPY ─────────────────────────────────────
export const FRICTION_COPY = {
  /** System error — Compass auto-opens with this */
  systemError:
    "We noticed something didn't go through. It's already been sent to the gardener. Nothing is lost.",

  /** Loading state — replaces generic spinners */
  loading: 'Still gathering the thread…',

  /** Offline / connection drop */
  offline:
    "We're still here. Your words are safe locally. We'll sync when the connection returns.",

  /** Backlog / overdue tasks */
  backlog: 'These relationships are waiting. Choose one.',

  /** Returning after absence */
  welcomeBack: 'Welcome back. The thread is still here.',

  /** Empty states */
  emptyDefault: 'Every relationship begins somewhere.',

  /** Autosave confirmation */
  autosaveHeld: 'Held.',

  /** Autosave failure fallback */
  autosaveFallback: "We're still holding your words locally.",

  /** Draft recovered */
  draftRecovered: 'We found where you left off.',
} as const;

// ─── CONFIRMATION WORDS ───────────────────────────────────────
// These are the ONLY acceptable confirmation words.
export const CONFIRMATIONS = ['Noted.', 'Held.', 'Updated.', 'Recorded.'] as const;

/**
 * Translate a SaaS-flavored string into CROS-charter language.
 * Falls through to original if no mapping exists.
 */
export function crosText(original: string): string {
  return CROS_VOCABULARY[original] ?? original;
}

/**
 * Check whether a string contains any banned words.
 * Useful for lint / CI checks on copy.
 */
export function containsBannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word.toLowerCase())) return word;
  }
  return null;
}
