/**
 * Operator Presence Engine — Ignatian Notification Governance.
 *
 * WHAT: Categorises every operator signal into silent / gentle / urgent,
 *       and softens language through the Ignatian Filter before delivery.
 * WHERE: Consumed by Nexus cards, push dispatch, digest builder, and
 *        OperatorNotificationsPage.
 * WHY: CROS believes the system should speak only when meaningful,
 *      and always with warmth.
 */

// ───────────────────────── Types ─────────────────────────

export type PresenceLevel = 'silent' | 'gentle' | 'urgent';

export interface SignalInput {
  /** Severity from the source table (low | medium | high | info | notice | warning | critical) */
  severity: string;
  /** Does the operator need to take action? */
  operatorActionRequired: boolean;
  /** How many tenants / users are affected (0–∞) */
  tenantImpact: number;
  /** How many times a similar signal fired in the last 24 h (for de-dupe dampening) */
  repetitionCount: number;
}

export interface PresenceResult {
  level: PresenceLevel;
  score: number;
  /** Whether to send push notification */
  pushEnabled: boolean;
  /** Whether to include in daily email digest */
  digestIncluded: boolean;
}

// ───────────────────── Scoring Weights ───────────────────

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high:     30,
  warning:  20,
  medium:   15,
  notice:   10,
  low:       5,
  info:      3,
};

const ACTION_WEIGHT     = 20;   // bonus when operator must act
const IMPACT_WEIGHT     = 2;    // per-tenant multiplier (capped)
const IMPACT_CAP        = 10;   // max tenant-impact bonus
const REPETITION_DAMPEN = -5;   // penalty per repeat in the window

// ───────────────────── Thresholds ────────────────────────

const URGENT_THRESHOLD  = 50;
const GENTLE_THRESHOLD  = 20;

// ───────────────────── Core Scorer ───────────────────────

/**
 * Calculate a weighted presence score and map to a level.
 *
 * Score = severity + action + min(tenantImpact * 2, 10) - (repetition * 5)
 */
export function calculatePresence(signal: SignalInput): PresenceResult {
  const sev        = SEVERITY_WEIGHT[signal.severity] ?? 5;
  const action     = signal.operatorActionRequired ? ACTION_WEIGHT : 0;
  const impact     = Math.min(signal.tenantImpact * IMPACT_WEIGHT, IMPACT_CAP);
  const repetition = Math.max(0, signal.repetitionCount - 1) * REPETITION_DAMPEN;

  const score = Math.max(0, sev + action + impact + repetition);

  let level: PresenceLevel;
  if (score >= URGENT_THRESHOLD) {
    level = 'urgent';
  } else if (score >= GENTLE_THRESHOLD) {
    level = 'gentle';
  } else {
    level = 'silent';
  }

  return {
    level,
    score,
    pushEnabled: level === 'urgent' || level === 'gentle',
    digestIncluded: level !== 'silent',
  };
}

// ─────────────── Convenience: from DB row ────────────────

/**
 * Derive presence from an operator_notification or lumen_signal row.
 * Pass any object that carries at least { severity, type }.
 */
export function presenceFromRow(row: {
  severity?: string;
  type?: string;
  tenant_impact?: number;
}): PresenceResult {
  // Types that always require action
  const actionTypes = new Set([
    'critical_error', 'security_flag', 'migration_failed',
    'activation_stuck', 'qa_failure',
  ]);

  return calculatePresence({
    severity: row.severity ?? 'info',
    operatorActionRequired: actionTypes.has(row.type ?? ''),
    tenantImpact: row.tenant_impact ?? 0,
    repetitionCount: 0, // caller can override if de-dupe data is available
  });
}

// ───────────────── Ignatian Filter ───────────────────────

const IGNATIAN_REWRITES: [RegExp, string][] = [
  [/\bFAILED\b/gi,             'did not complete'],
  [/\bFAILURE\b/gi,            'outcome not as expected'],
  [/\bCRITICAL\b/gi,           'needs careful attention'],
  [/\bERROR\b/gi,              'something did not go as expected'],
  [/\bWARNING\b/gi,            'a gentle heads-up'],
  [/\bALERT\b/gi,              'something to be aware of'],
  [/\bDANGER\b/gi,             'needs careful attention'],
  [/\bIMMEDIATELY\b/gi,        'when you are ready'],
  [/\bURGENT(LY)?\b/gi,        'worth looking at soon'],
  [/\bYOU MUST\b/gi,           'you may want to'],
  [/\bREQUIRED\b/gi,           'suggested'],
  [/\bACTION REQUIRED\b/gi,    'an invitation to look'],
  [/\bFIX (THIS|IT)\b/gi,      'tend to this'],
  [/\bBROKEN\b/gi,             'not working as hoped'],
  [/\bBLOCKED\b/gi,            'paused for now'],
  [/\bTIMEOUT\b/gi,            'took longer than expected'],
  [/\bREJECTED\b/gi,           'not accepted this time'],
  [/\bOVERDUE\b/gi,            'ready for a follow-up'],
  [/⚠️|🚨|❌|🔴/g,              ''],    // strip alarm emoji
];

/**
 * Soften alarmist wording into warm, invitational Ignatian language.
 *
 * - Removes alarm emoji
 * - Replaces command verbs with invitations
 * - Trims extra whitespace
 */
export function applyIgnatianFilter(message: string): string {
  let text = message;
  for (const [pattern, replacement] of IGNATIAN_REWRITES) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s{2,}/g, ' ').trim();
}

// ───────────── CSS classes for Nexus cards ───────────────

/**
 * Returns Tailwind classes for visually encoding presence on Nexus cards.
 *
 * silent  → neutral (no extra styling)
 * gentle  → soft glow ring
 * urgent  → subtle accent border (never red)
 */
export function presenceCardClasses(level: PresenceLevel): string {
  switch (level) {
    case 'urgent':
      return 'border-accent/40 shadow-[0_0_8px_hsl(var(--accent)/0.15)]';
    case 'gentle':
      return 'border-primary/20 shadow-[0_0_6px_hsl(var(--primary)/0.08)]';
    case 'silent':
    default:
      return 'border-border/50';
  }
}

/**
 * Badge variant for presence indicators.
 */
export function presenceBadgeVariant(level: PresenceLevel): 'default' | 'secondary' | 'outline' {
  switch (level) {
    case 'urgent':  return 'default';
    case 'gentle':  return 'secondary';
    case 'silent':  return 'outline';
  }
}
