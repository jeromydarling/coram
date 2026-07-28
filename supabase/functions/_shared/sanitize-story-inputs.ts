/**
 * sanitizeStoryInputs — Hard server-side privacy guard.
 *
 * Used by all narrative builders to ensure no private content leaks.
 * Strips: email_body, reflection body text, raw note_text, PII.
 * Allows: topics, signal_type, timestamps, counts, safe snippets.
 */

export interface SanitizedStoryInput {
  topics: string[];
  signal_types: string[];
  timestamps: string[];
  counts: Record<string, number>;
}

/**
 * Strip all private fields from a record, returning only safe narrative inputs.
 */
export function sanitizeStoryInputs(
  rawInputs: Record<string, unknown>[],
): SanitizedStoryInput {
  const topics: string[] = [];
  const signalTypes: string[] = [];
  const timestamps: string[] = [];
  const counts: Record<string, number> = {};

  for (const item of rawInputs) {
    // Extract topics
    if (Array.isArray(item.topics)) {
      for (const t of item.topics as string[]) {
        if (typeof t === "string" && t.length < 100 && !topics.includes(t)) {
          topics.push(t);
        }
      }
    }

    // Extract signal types
    if (typeof item.signal_type === "string") {
      const st = item.signal_type;
      if (!signalTypes.includes(st)) signalTypes.push(st);
    }
    if (Array.isArray(item.relationship_signals)) {
      for (const s of item.relationship_signals as Array<{ type: string }>) {
        if (typeof s.type === "string" && !signalTypes.includes(s.type)) {
          signalTypes.push(s.type);
        }
      }
    }

    // Extract timestamps
    if (typeof item.created_at === "string") {
      timestamps.push(item.created_at);
    }
    if (typeof item.sent_at === "string") {
      timestamps.push(item.sent_at);
    }

    // Count by type
    const countKey = (item.signal_type as string) || (item.sentiment as string) || "other";
    counts[countKey] = (counts[countKey] || 0) + 1;
  }

  return { topics: topics.slice(0, 20), signal_types: signalTypes, timestamps, counts };
}

/**
 * Ensure a record has NO private fields before passing to AI.
 * Returns a cleaned copy with dangerous keys removed.
 */
export function stripPrivateFields(obj: Record<string, unknown>): Record<string, unknown> {
  const BANNED_KEYS = [
    "body", "email_body", "note_text", "raw_body", "html_body",
    "full_text", "content", "message_body", "reflection_body",
  ];

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (BANNED_KEYS.includes(key.toLowerCase())) continue;
    // Recurse one level for nested objects
    if (value && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = stripPrivateFields(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}
