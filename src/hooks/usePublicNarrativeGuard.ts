/**
 * usePublicNarrativeGuard — Safety hook for public narrative content.
 *
 * WHAT: Validates narrative data before public display.
 * WHERE: Any component rendering narrative signals publicly.
 * WHY: Ensures minimum aggregation threshold, no PII, no tenant identifiers.
 */

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // phone numbers
  /\$[\d,]+(\.\d{2})?/g, // dollar amounts
];

const TENANT_KEYWORDS = [
  'tenant', 'org_id', 'organization', 'company', 'tenant_id',
  'user_id', 'email', 'phone', 'address', 'ssn',
];

interface GuardResult {
  safe: boolean;
  text: string;
  reason?: string;
}

/** Minimum number of data sources required before showing aggregated content */
const MIN_AGGREGATION_THRESHOLD = 2;

/**
 * Guard a text string for public display.
 * Returns safe=false if PII or tenant identifiers are detected.
 */
export function guardNarrativeText(text: string): GuardResult {
  if (!text || text.trim().length < 5) {
    return { safe: false, text: '', reason: 'empty_or_too_short' };
  }

  // Check for PII patterns
  for (const pattern of PII_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return { safe: false, text: '', reason: 'pii_detected' };
    }
  }

  // Check for tenant keywords
  const lower = text.toLowerCase();
  for (const keyword of TENANT_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { safe: false, text: '', reason: 'tenant_identifier_detected' };
    }
  }

  return { safe: true, text };
}

/**
 * Guard an array of data items — ensures minimum aggregation threshold.
 */
export function guardAggregation<T>(items: T[], minSources = MIN_AGGREGATION_THRESHOLD): T[] {
  if (items.length < minSources) return [];
  return items;
}

/**
 * Hook: validate and filter an array of narrative strings for public display.
 */
export function usePublicNarrativeGuard(
  texts: string[],
  minSources = MIN_AGGREGATION_THRESHOLD,
): string[] {
  if (texts.length < minSources) return [];
  return texts
    .map((t) => guardNarrativeText(t))
    .filter((r) => r.safe)
    .map((r) => r.text);
}
