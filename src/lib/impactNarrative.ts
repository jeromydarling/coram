/**
 * impactNarrative — Keyword-based detection for NRI-friendly impact phrases.
 *
 * WHAT: Detects "care-ish" labels and returns narrative-ready phrases.
 * WHERE: NRI rollups, Testimonium signals, movement sharing.
 * WHY: Lets NRI say "120 devices found new homes" without AI calls.
 */

const CARE_KEYWORDS = [
  'served', 'helped', 'families', 'people', 'meals',
  'devices', 'households', 'children', 'students', 'clients',
  'patients', 'visitors', 'members', 'participants', 'beneficiaries',
  'distributed', 'provided', 'delivered', 'connected', 'supported',
];

export function isCareMetric(label: string): boolean {
  const lower = label.toLowerCase();
  return CARE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Generates a human-readable narrative phrase from a dimension label and count.
 * Examples:
 *   ("Devices distributed", 120) => "120 devices distributed"
 *   ("Revenue", 5000)           => "5,000 recorded for Revenue"
 */
export function narrativePhrase(label: string, total: number): string {
  const formatted = total.toLocaleString();

  if (isCareMetric(label)) {
    return `${formatted} ${label.toLowerCase()}`;
  }

  return `${formatted} recorded for ${label}`;
}
