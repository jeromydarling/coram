/**
 * parseHouseholdMembers — Extracts household/family members from CSV data.
 *
 * WHAT: Parses various CSV household formats into a normalized array.
 * WHERE: Used by Import Center and Relatio migration harness.
 * WHY: Real-world exports encode household data in many inconsistent ways.
 */

export interface HouseholdMemberInput {
  name: string;
  relationship: string | null;
  notes: string | null;
}

/**
 * Compute a dedupe signature for a household member.
 * Ensures we don't insert duplicates per contact.
 */
export function householdDedupeSignature(member: HouseholdMemberInput): string {
  return `${member.name.toLowerCase().trim()}|${(member.relationship || '').toLowerCase().trim()}`;
}

/**
 * Deduplicate household members by signature.
 */
export function dedupeHouseholdMembers(members: HouseholdMemberInput[]): HouseholdMemberInput[] {
  const seen = new Set<string>();
  return members.filter((m) => {
    const sig = householdDedupeSignature(m);
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/**
 * Parse a single embedded string containing household members.
 *
 * Supported formats:
 * - "John (son); Mary (spouse); Ava (daughter)"
 * - "John|son, Mary|spouse, Ava|daughter"
 * - "John - son; Mary - spouse"
 * - "John; Mary; Ava" (no relationship)
 */
export function parseHouseholdString(value: string): HouseholdMemberInput[] {
  if (!value || !value.trim()) return [];

  // Split on semicolons first; if only one segment, try comma (but avoid splitting inside parens)
  let segments = splitRespectingParens(value, ';');
  if (segments.length <= 1) {
    segments = splitRespectingParens(value, ',');
  }

  return segments
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .map((seg) => parseSingleMember(seg));
}

/**
 * Split a string by a delimiter but avoid splitting inside parentheses.
 */
function splitRespectingParens(value: string, delimiter: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === delimiter && depth === 0) {
      result.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current);
  return result;
}

/**
 * Parse a single member segment like "John (son)" or "John|son" or "John - son".
 */
function parseSingleMember(segment: string): HouseholdMemberInput {
  // Try parentheses format: "John (son)"
  const parenMatch = segment.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim().slice(0, 120),
      relationship: parenMatch[2].trim().slice(0, 60),
      notes: null,
    };
  }

  // Try pipe format: "John|son"
  const pipeIdx = segment.indexOf('|');
  if (pipeIdx > 0) {
    return {
      name: segment.slice(0, pipeIdx).trim().slice(0, 120),
      relationship: segment.slice(pipeIdx + 1).trim().slice(0, 60) || null,
      notes: null,
    };
  }

  // Try dash format: "John - son" (only if dash has spaces around it)
  const dashMatch = segment.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    return {
      name: dashMatch[1].trim().slice(0, 120),
      relationship: dashMatch[2].trim().slice(0, 60),
      notes: null,
    };
  }

  // Just a name
  return {
    name: segment.trim().slice(0, 120),
    relationship: null,
    notes: null,
  };
}

/**
 * Extract household members from a CSV row using multi-column repeated fields.
 * Supports patterns like:
 * - household_member_1_name, household_member_1_relationship, household_member_1_notes
 * - family_member_1_name, family_member_1_relationship
 * - household1_name
 */
export function parseHouseholdMultiColumn(row: Record<string, unknown>): HouseholdMemberInput[] {
  const members: HouseholdMemberInput[] = [];
  const patterns = [
    /^(?:household_member|family_member|household|family)_?(\d+)_?name$/i,
  ];

  // Find all name columns matching patterns
  const nameColumns: { index: number; key: string }[] = [];
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().replace(/\s+/g, '_');
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        nameColumns.push({ index: parseInt(match[1], 10), key });
        break;
      }
    }
  }

  // Sort by index
  nameColumns.sort((a, b) => a.index - b.index);

  for (const { index, key } of nameColumns) {
    const name = String(row[key] || '').trim();
    if (!name) continue;

    // Try to find matching relationship and notes columns
    const relKey = findMatchingColumn(row, index, 'relationship');
    const notesKey = findMatchingColumn(row, index, 'notes');

    members.push({
      name: name.slice(0, 120),
      relationship: relKey ? String(row[relKey] || '').trim().slice(0, 60) || null : null,
      notes: notesKey ? String(row[notesKey] || '').trim().slice(0, 300) || null : null,
    });
  }

  return members;
}

function findMatchingColumn(row: Record<string, unknown>, index: number, suffix: string): string | null {
  const variants = [
    `household_member_${index}_${suffix}`,
    `family_member_${index}_${suffix}`,
    `household${index}_${suffix}`,
    `family${index}_${suffix}`,
    `household_member${index}_${suffix}`,
  ];
  for (const v of variants) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().replace(/\s+/g, '_') === v) return key;
    }
  }
  return null;
}

/**
 * Detect and extract household size from a row (count-only, no member creation).
 */
export function parseHouseholdSize(row: Record<string, unknown>): number | null {
  const sizeKeys = ['household_size', 'family_size'];
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().replace(/\s+/g, '_');
    if (sizeKeys.includes(normalized)) {
      const val = parseInt(String(row[key] || ''), 10);
      return isNaN(val) ? null : val;
    }
  }
  return null;
}

/**
 * Extract all household members from a CSV row, trying all supported formats.
 * Returns members (possibly empty) and optional household_size count.
 */
export function extractHouseholdFromRow(row: Record<string, unknown>): {
  members: HouseholdMemberInput[];
  householdSize: number | null;
} {
  let members: HouseholdMemberInput[] = [];

  // 1) Check for single embedded column
  const embeddedKeys = ['household_members', 'family_members', 'household', 'family'];
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().replace(/\s+/g, '_');
    if (embeddedKeys.includes(normalized)) {
      const val = String(row[key] || '').trim();
      if (val) {
        members = parseHouseholdString(val);
      }
      break;
    }
  }

  // 2) If no embedded members found, try multi-column format
  if (members.length === 0) {
    members = parseHouseholdMultiColumn(row);
  }

  // 3) Parse household size (count-only, no placeholder rows)
  const householdSize = parseHouseholdSize(row);

  return { members: dedupeHouseholdMembers(members), householdSize };
}

/** Household column aliases for CSV normalization */
export const HOUSEHOLD_ALIASES: Record<string, string> = {
  'household members': 'household_members',
  'family members': 'family_members',
  household: 'household_members',
  family: 'family_members',
  'household size': 'household_size',
  'family size': 'household_size',
};
