/**
 * Turning CSV rows into contact fields.
 *
 * Lives in `shared` because preview and commit must agree exactly. If the
 * preview said "create" and the commit decided "skip", the dry-run was a lie —
 * and a dry-run an organizer cannot trust is worse than no dry-run, because
 * they will act on it.
 */

import { IMPORTABLE_FIELDS, type ImportableField } from '../schemas/contacts';

export interface MappedRow {
  displayName?: string;
  email?: string;
  phone?: string;
  postalCode?: string;
}

/**
 * Apply a column mapping to one CSV row.
 *
 * Values are trimmed, blanks become undefined, and email is lowercased so
 * deduplication matches the database's `lower(email)` index rather than
 * treating "Ada@example.org" and "ada@example.org" as two people.
 */
export function mapRow(row: Record<string, string>, mapping: Record<string, ImportableField>): MappedRow {
  const mapped: MappedRow = {};

  for (const [column, field] of Object.entries(mapping)) {
    const raw = row[column];
    if (raw == null) continue;

    const value = String(raw).trim();
    if (!value) continue;

    mapped[field] = field === 'email' ? value.toLowerCase() : value;
  }

  return mapped;
}

/** A row is importable if it has a name or some way to reach the person. */
export function isReachable(row: MappedRow): boolean {
  return Boolean(row.displayName || row.email || row.phone);
}

/**
 * Guess a mapping from CSV headers.
 *
 * A suggestion for the mapping UI, never applied on its own — §5.1 wants
 * column mapping to be something an organizer confirms. Guessing wrong and
 * importing silently is how a phone column ends up in a postcode field across
 * four thousand records.
 */
export function suggestMapping(headers: string[]): Record<string, ImportableField> {
  const patterns: Array<[RegExp, ImportableField]> = [
    [/^(e[-_ ]?mail|email[-_ ]?address)$/i, 'email'],
    [/^(phone|mobile|cell|telephone|phone[-_ ]?number)$/i, 'phone'],
    [/^(zip|zipcode|postal[-_ ]?code|postcode)$/i, 'postalCode'],
    [/^(name|full[-_ ]?name|display[-_ ]?name|contact[-_ ]?name)$/i, 'displayName'],
  ];

  const suggestion: Record<string, ImportableField> = {};
  const claimed = new Set<ImportableField>();

  for (const header of headers) {
    const key = header.trim();
    for (const [pattern, field] of patterns) {
      // First header to match a field wins; a second "email" column is left
      // unmapped for the organizer to resolve rather than silently overwriting.
      if (!claimed.has(field) && pattern.test(key)) {
        suggestion[header] = field;
        claimed.add(field);
        break;
      }
    }
  }

  return suggestion;
}

/** Headers that could not be mapped, so the UI can show what is being dropped. */
export function unmappedHeaders(
  headers: string[],
  mapping: Record<string, ImportableField>,
): string[] {
  return headers.filter((h) => !(h in mapping));
}

export { IMPORTABLE_FIELDS };
