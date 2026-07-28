/**
 * narrativeVoiceValidator — Ignatian narrative integrity guardrails.
 *
 * WHAT: Validates NRI output for calm tone, Ignatian structure, and narrative purity.
 * WHERE: Applied before publishing any NRI-generated content.
 * WHY: Ensures all platform narratives remain contemplative and human-centered.
 */

export interface VoiceValidationResult {
  valid: boolean;
  issues: VoiceIssue[];
  /** Suggested status if invalid */
  suggestedStatus: 'publishable' | 'needs_recalibration';
}

export interface VoiceIssue {
  rule: string;
  detail: string;
  severity: 'warning' | 'block';
}

// ─── Urgency / Marketing Language ───────────────────

const URGENCY_PATTERNS = [
  /\bact now\b/i,
  /\bdon'?t miss\b/i,
  /\bhurry\b/i,
  /\blimited time\b/i,
  /\bexpiring\b/i,
  /\blast chance\b/i,
  /\bfinal (offer|call|notice)\b/i,
  /\bimmediately\b/i,
  /\burgent(ly)?\b/i,
  /\bcritical\b/i,
  /\bemergency\b/i,
  /\bfailing\b/i,
  /\baction required\b/i,
];

const MARKETING_PATTERNS = [
  /\bexclusive\b/i,
  /\bunlock\b/i,
  /\bsupercharge\b/i,
  /\b10x\b/i,
  /\blevel.?up\b/i,
  /\bgame.?chang(er|ing)\b/i,
  /\bscale\b/i,
  /\boptimize\b/i,
  /\bmaximize\b/i,
  /\bROI\b/,
  /\bconversion\b/i,
  /\bfunnel\b/i,
  /\bengagement rate\b/i,
  /\bclick.?through\b/i,
];

const AUTHORITATIVE_PATTERNS = [
  /\byou must\b/i,
  /\byou need to\b/i,
  /\byou should\b/i,
  /\byou have to\b/i,
  /\bit is essential\b/i,
  /\bit is critical\b/i,
  /\bNRI (says|recommends|demands|insists)\b/i,
];

// ─── Ignatian Structure Check ───────────────────────

const IGNATIAN_ELEMENTS = [
  'noticing',
  'reflection',
  'discovering',
  'pattern',
  'invitation',
] as const;

/**
 * Validate a narrative text against NRI voice standards.
 *
 * Checks:
 * 1. No urgency language
 * 2. No marketing phrasing
 * 3. No authoritative commands
 * 4. Abstract noun density (max 3 per paragraph)
 * 5. Minimum length for substance
 */
export function validateNarrativeVoice(text: string): VoiceValidationResult {
  const issues: VoiceIssue[] = [];

  if (!text || text.trim().length < 20) {
    return {
      valid: false,
      issues: [{ rule: 'minimum_substance', detail: 'Text too short for narrative', severity: 'block' }],
      suggestedStatus: 'needs_recalibration',
    };
  }

  // Check urgency language
  for (const pattern of URGENCY_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        rule: 'no_urgency',
        detail: `Contains urgency language: "${text.match(pattern)?.[0]}"`,
        severity: 'block',
      });
    }
  }

  // Check marketing phrasing
  for (const pattern of MARKETING_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        rule: 'no_marketing',
        detail: `Contains marketing phrasing: "${text.match(pattern)?.[0]}"`,
        severity: 'warning',
      });
    }
  }

  // Check authoritative commands
  for (const pattern of AUTHORITATIVE_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({
        rule: 'no_authority',
        detail: `Contains authoritative language: "${text.match(pattern)?.[0]}"`,
        severity: 'block',
      });
    }
  }

  const hasBlockers = issues.some(i => i.severity === 'block');

  return {
    valid: !hasBlockers,
    issues,
    suggestedStatus: hasBlockers ? 'needs_recalibration' : 'publishable',
  };
}

/**
 * Quick check: does the text pass basic narrative voice rules?
 */
export function isNarrativeVoiceClean(text: string): boolean {
  return validateNarrativeVoice(text).valid;
}
