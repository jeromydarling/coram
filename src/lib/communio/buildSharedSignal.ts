/**
 * Communio Signal Sanitizer
 * 
 * Transforms internal NRI signals into safe, anonymized communio_shared_signals.
 * 
 * SAFETY INVARIANTS:
 * - NEVER include organization names, emails, contacts, financial data
 * - NEVER include volunteer identities or provision details
 * - Only narrative summaries and anonymized trends
 * - Summaries truncated to 180 chars max
 * - Timestamps bucketed by week
 */

const FORBIDDEN_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // phone numbers
  /\$[\d,]+(\.\d{2})?/g, // dollar amounts
  /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g, // proper names (two capitalized words)
];

const FORBIDDEN_KEYS = [
  'email', 'phone', 'contact_name', 'organization', 'org_name',
  'volunteer_name', 'provision_id', 'financial', 'revenue', 'cost',
  'address', 'street', 'zip', 'ssn', 'donor', 'name', 'first_name',
  'last_name', 'full_name', 'company', 'employer', 'note_text',
  'body', 'email_body', 'raw_body', 'reflection_body',
];

interface RawNriSignal {
  signal_type: string;
  summary?: string;
  body?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  metro_id?: string;
}

interface SanitizedSignal {
  signal_type: string;
  signal_summary: string;
  metro_id?: string;
}

/** Remove forbidden patterns from text */
function scrubText(text: string): string {
  let cleaned = text;
  for (const pattern of FORBIDDEN_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, '[redacted]');
  }
  return cleaned;
}

/** Check if metadata contains any forbidden keys */
function hasForbiddenKeys(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  return keys.some(k => FORBIDDEN_KEYS.includes(k));
}

/**
 * Transform an internal NRI signal into a sanitized communio shared signal.
 * Returns null if the signal cannot be safely shared.
 */
export function buildSharedSignal(raw: RawNriSignal): SanitizedSignal | null {
  if (!raw.signal_type) return null;

  const summarySource = raw.summary || raw.body || raw.title;
  if (!summarySource) return null;

  // Check metadata for forbidden content
  if (raw.metadata && hasForbiddenKeys(raw.metadata)) {
    return null;
  }

  // Deep check metadata values
  if (raw.metadata && containsForbiddenData(raw.metadata)) {
    return null;
  }

  const sanitized = scrubText(summarySource);

  // If too much was redacted, skip the signal
  const redactedCount = (sanitized.match(/\[redacted\]/g) || []).length;
  if (redactedCount > 2) return null;

  // Truncate to 180 chars max for privacy
  const trimmed = sanitized.length > 180 ? sanitized.slice(0, 177) + '...' : sanitized;

  return {
    signal_type: raw.signal_type,
    signal_summary: trimmed,
    metro_id: raw.metro_id,
  };
}

/**
 * Build a sanitized good_work_pulse signal from project aggregates.
 * Only aggregate counts — no names, no locations, no PII.
 */
export function buildGoodWorkPulseSignal(agg: {
  projectCount: number;
  peopleHelped: number;
  noteCount: number;
  helpersCount: number;
  metro_id?: string;
}): SanitizedSignal | null {
  if (agg.projectCount === 0) return null;

  const parts: string[] = [`${agg.projectCount} projects`];
  if (agg.peopleHelped > 0) parts.push(`${agg.peopleHelped} people helped`);
  if (agg.helpersCount > 0) parts.push(`${agg.helpersCount} helpers`);
  if (agg.noteCount > 0) parts.push(`${agg.noteCount} reflections captured`);

  return {
    signal_type: 'good_work_pulse',
    signal_summary: parts.join(', '),
    metro_id: agg.metro_id,
  };
}

/** Validate a payload doesn't contain forbidden keys or PII (deep check) */
export function containsForbiddenData(obj: unknown): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj === 'string') {
    return FORBIDDEN_PATTERNS.some(p => {
      p.lastIndex = 0;
      return p.test(obj);
    });
  }
  if (typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    if (hasForbiddenKeys(record)) return true;
    return Object.values(record).some(v => containsForbiddenData(v));
  }
  return false;
}
