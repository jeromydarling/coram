/**
 * normalizeCsvColumns — Canonical header normalization for CSV imports.
 *
 * WHAT: Maps messy CSV headers to canonical field names.
 * WHERE: Used by Flocknote Bridge and other CSV-based connectors.
 * WHY: Real-world exports use inconsistent headers; this ensures reliable mapping.
 */

const PEOPLE_ALIASES: Record<string, string> = {
  id: 'external_id',
  'external id': 'external_id',
  external_id: 'external_id',
  'person id': 'external_id',

  'first name': 'first_name',
  firstname: 'first_name',
  first: 'first_name',
  first_name: 'first_name',

  'last name': 'last_name',
  lastname: 'last_name',
  last: 'last_name',
  last_name: 'last_name',

  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  'primary email': 'email',

  phone: 'phone',
  'mobile phone': 'phone',
  cell: 'phone',
  'cell phone': 'phone',
  'primary phone': 'phone',

  'street address': 'address',
  address: 'address',
  'address 1': 'address',
  street: 'address',

  city: 'city',
  state: 'state',

  'postal code': 'zip',
  zip: 'zip',
  'zip code': 'zip',

  // Household aliases
  'household members': 'household_members',
  'family members': 'family_members',
  household: 'household_members',
  family: 'family_members',
  'household size': 'household_size',
  'family size': 'household_size',
};

const GIVING_ALIASES: Record<string, string> = {
  // Date
  date: 'gift_date',
  'gift date': 'gift_date',
  gift_date: 'gift_date',
  'donation date': 'gift_date',
  donationdate: 'gift_date',
  'received on': 'gift_date',
  received_on: 'gift_date',
  'transaction date': 'gift_date',

  // Amount
  amount: 'amount',
  'gift amount': 'amount',
  gift_amount: 'amount',
  'donation amount': 'amount',
  total: 'amount',

  // Recurring
  recurring: 'is_recurring',
  'is recurring': 'is_recurring',
  is_recurring: 'is_recurring',
  pledgor: 'is_recurring',

  // Interval
  frequency: 'recurring_interval',
  'recurring interval': 'recurring_interval',
  recurring_interval: 'recurring_interval',
  'recurring period': 'recurring_interval',

  // Note
  note: 'note',
  notes: 'note',
  memo: 'note',
  fund: 'note',
  'fund name': 'note',
  fund_name: 'note',
  campaign: 'note',
  'campaign name': 'note',
  designation: 'note',

  // Person identification
  'first name': 'first_name',
  firstname: 'first_name',
  first_name: 'first_name',
  'last name': 'last_name',
  lastname: 'last_name',
  last_name: 'last_name',
  email: 'email',
  'email address': 'email',
  phone: 'phone',
};

const MEMBERSHIP_ALIASES: Record<string, string> = {
  group: 'group_name',
  'group name': 'group_name',
  group_name: 'group_name',
  ministry: 'group_name',

  email_or_phone: 'email_or_phone',
  'email or phone': 'email_or_phone',
  member: 'email_or_phone',
  'member contact': 'email_or_phone',
  email: 'email_or_phone',
  phone: 'email_or_phone',
};

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type CsvType = 'people' | 'memberships' | 'giving';

export interface NormalizationResult {
  /** Ordered array of canonical header names (or original if unmapped) */
  canonicalHeaders: string[];
  /** Map from original header → canonical key */
  headerMap: Record<string, string>;
  /** Headers that could not be mapped to a canonical key */
  unknownHeaders: string[];
}

export function normalizeCsvColumns(
  rawHeaders: string[],
  type: CsvType
): NormalizationResult {
  const aliases = type === 'people' ? PEOPLE_ALIASES : type === 'giving' ? GIVING_ALIASES : MEMBERSHIP_ALIASES;
  const headerMap: Record<string, string> = {};
  const unknownHeaders: string[] = [];
  const canonicalHeaders: string[] = [];

  for (const raw of rawHeaders) {
    const key = normalizeKey(raw);
    const canonical = aliases[key];
    if (canonical) {
      headerMap[raw] = canonical;
      canonicalHeaders.push(canonical);
    } else {
      unknownHeaders.push(raw);
      canonicalHeaders.push(raw);
    }
  }

  return { canonicalHeaders, headerMap, unknownHeaders };
}

/**
 * Parse a CSV string into rows using the normalized header map.
 * Returns objects keyed by canonical field names, plus a `_raw` object for unmapped columns.
 */
export function parseCsvWithNormalization(
  csvText: string,
  type: CsvType
): { rows: Record<string, string>[]; normalization: NormalizationResult } {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return { rows: [], normalization: { canonicalHeaders: [], headerMap: {}, unknownHeaders: [] } };

  const rawHeaders = lines[0].split(',').map((h) => h.trim());
  const normalization = normalizeCsvColumns(rawHeaders, type);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    const raw: Record<string, string> = {};

    for (let j = 0; j < rawHeaders.length; j++) {
      const val = values[j] ?? '';
      const canonical = normalization.headerMap[rawHeaders[j]];
      if (canonical) {
        row[canonical] = val;
      } else {
        raw[rawHeaders[j]] = val;
      }
    }

    if (Object.keys(raw).length > 0) {
      row['_raw'] = JSON.stringify(raw);
    }
    rows.push(row);
  }

  return { rows, normalization };
}
