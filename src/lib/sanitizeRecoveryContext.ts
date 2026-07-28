/**
 * sanitizeRecoveryContext — Strips PII from recovery ticket context before DB write.
 *
 * WHAT: Allowlist-based sanitizer for recovery ticket context payloads.
 * WHERE: useCreateRecoveryTicket, any ticket creation flow.
 * WHY: Prevents entity names, emails, phones, and freeform content from leaking
 *      into recovery_tickets where operators (Gardeners) have read access.
 */

const ALLOWED_KEYS = new Set([
  'event_type',
  'entity_type',
  'entity_id',
  'route',
  'current_route',
  'timestamp',
  'created_at',
  'correlation_id',
  'action',
  'surface',
  'source',
  'metadata',
]);

const PII_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,                     // phone numbers
];

function containsPII(value: string): boolean {
  return PII_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Sanitize a single action breadcrumb — keep only safe keys,
 * strip any string values that contain PII patterns.
 */
function sanitizeAction(action: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(action)) {
    if (!ALLOWED_KEYS.has(key)) continue;

    if (typeof value === 'string') {
      if (containsPII(value)) continue; // Drop values with PII
      clean[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    }
    // Drop objects/arrays — no nested content allowed
  }

  return clean;
}

/**
 * Sanitize recent_actions array for recovery ticket creation.
 * Returns a cleaned array safe for operator visibility.
 */
export function sanitizeRecoveryActions(actions: unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(actions)) return [];

  return actions
    .filter((a): a is Record<string, unknown> => a !== null && typeof a === 'object' && !Array.isArray(a))
    .map(sanitizeAction)
    .slice(0, 25); // Cap at 25 breadcrumbs
}
