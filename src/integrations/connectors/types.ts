/**
 * Connector Adapter Interface
 * 
 * WHAT: Defines the normalization contract for CRM connectors.
 * WHERE: Used by migration harness + fixture tests.
 * WHY: Consistent mapping regardless of source system.
 */

export interface NormalizedAccount {
  external_id: string;
  organization: string;
  website_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  description: string | null;
  org_type: string | null;
  industry: string | null;
}

export interface NormalizedContact {
  external_id: string;
  account_external_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  city: string | null;
  state: string | null;
  household_members?: NormalizedHouseholdMember[];
}

export interface NormalizedHouseholdMember {
  name: string;
  relationship: string | null;
  notes: string | null;
}

export interface NormalizedTask {
  external_id: string;
  contact_external_id: string | null;
  account_external_id: string | null;
  title: string;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  description: string | null;
}

export interface NormalizedEvent {
  external_id: string;
  contact_external_id: string | null;
  account_external_id: string | null;
  event_name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  description: string | null;
}

export interface NormalizedActivity {
  external_id: string;
  parent_external_id: string | null;
  title: string;
  body_snippet: string | null; // max 200 chars, no PII
  created_date: string | null;
}

/**
 * NormalizedGiving — canonical CROS shape for generosity records.
 *
 * WHAT: Standard giving record structure across all connectors.
 * WHERE: ConnectorAdapter.normalizeGiving() implementations.
 * WHY: CROS remembers generosity in a single, clean format regardless of source CRM.
 */
export interface NormalizedGiving {
  date: string;                       // ISO 8601 — 'YYYY-MM-DD'
  amount: number;                     // Decimal, donor-currency
  is_recurring: boolean;              // true = part of a recurring schedule
  recurring_interval: string | null;  // 'monthly' | 'annually' | 'weekly' | 'quarterly' | etc.
  note: string | null;                // Fund, campaign, or memo — max 500 chars
  warnings: string[];                 // Non-fatal issues found during mapping
}

export interface MappingWarning {
  type: 'duplicate_email' | 'missing_required' | 'invalid_date' | 'orphan_contact' | 'truncated_field' | 'normalization';
  message: string;
  row_index?: number;
  field?: string;
  value?: string;
}

export interface ConnectorAdapter {
  key: string;
  displayName: string;
  normalizeAccount(raw: Record<string, unknown>): { result: NormalizedAccount | null; warnings: MappingWarning[] };
  normalizeContact(raw: Record<string, unknown>): { result: NormalizedContact | null; warnings: MappingWarning[] };
  normalizeTask(raw: Record<string, unknown>): { result: NormalizedTask | null; warnings: MappingWarning[] };
  normalizeEvent(raw: Record<string, unknown>): { result: NormalizedEvent | null; warnings: MappingWarning[] };
  normalizeActivity(raw: Record<string, unknown>): { result: NormalizedActivity | null; warnings: MappingWarning[] };
  /** Normalize giving/donation records — optional, only for connectors with giving data */
  normalizeGiving?(raw: Record<string, unknown>): { result: NormalizedGiving | null; warnings: MappingWarning[] };
}

/** Normalize various date formats to ISO string */
export function normalizeDate(value: unknown): { date: string | null; warning: string | null } {
  if (!value || value === '') return { date: null, warning: null };
  const str = String(value).trim();

  // Try ISO first
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime()) && str.match(/^\d{4}-\d{2}/)) {
    return { date: isoDate.toISOString(), warning: null };
  }

  // MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const d = new Date(`${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return { date: d.toISOString(), warning: `Normalized non-ISO date: ${str}` };
  }

  // YYYY/MM/DD
  const ymdSlash = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymdSlash) {
    const d = new Date(`${ymdSlash[1]}-${ymdSlash[2]}-${ymdSlash[3]}`);
    if (!isNaN(d.getTime())) return { date: d.toISOString(), warning: `Normalized date format: ${str}` };
  }

  // "Mon DD YYYY" or "DD-MM-YYYY" etc — try native parse as last resort
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return { date: fallback.toISOString(), warning: `Loosely parsed date: ${str}` };
  }

  return { date: null, warning: `Invalid date could not be parsed: ${str}` };
}

/** Truncate a string safely to a max length */
export function safeSnippet(text: unknown, maxLen = 200): string | null {
  if (!text) return null;
  const s = String(text).replace(/\r\n/g, '\n').trim();
  return s.length > maxLen ? s.slice(0, maxLen - 3) + '...' : s;
}

/** Normalize US state abbreviations */
export function normalizeState(state: unknown): string | null {
  if (!state) return null;
  const s = String(state).trim();
  const map: Record<string, string> = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR',
    california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
    florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
    illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS',
    kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
    massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
    missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
    oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
    vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
    wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
    // Common abbreviations
    al: 'AL', ak: 'AK', az: 'AZ', ar: 'AR', ca: 'CA', co: 'CO', ct: 'CT',
    de: 'DE', fl: 'FL', ga: 'GA', hi: 'HI', id: 'ID', il: 'IL', in: 'IN',
    ia: 'IA', ks: 'KS', ky: 'KY', la: 'LA', me: 'ME', md: 'MD', ma: 'MA',
    mi: 'MI', mn: 'MN', ms: 'MS', mo: 'MO', mt: 'MT', ne: 'NE', nv: 'NV',
    nh: 'NH', nj: 'NJ', nm: 'NM', ny: 'NY', nc: 'NC', nd: 'ND', oh: 'OH',
    ok: 'OK', or: 'OR', pa: 'PA', ri: 'RI', sc: 'SC', sd: 'SD', tn: 'TN',
    tx: 'TX', ut: 'UT', vt: 'VT', va: 'VA', wa: 'WA', wv: 'WV', wi: 'WI',
    wy: 'WY', dc: 'DC',
  };
  return map[s.toLowerCase()] ?? s.toUpperCase().slice(0, 2);
}
