/**
 * privacyPosture — Privacy-aware narrative phrasing for HIPAA-Sensitive Mode.
 *
 * WHAT: Transforms names and identifiers into anonymized narrative language
 *       when a tenant's compliance_posture is 'hipaa_sensitive'.
 * WHERE: Used by Testimonium, Living Signals, NRI summaries, and public presence.
 * WHY: Some tenants operate in healthcare-adjacent environments. We protect
 *       stories with care — no medical compliance claims, just gentle anonymization.
 */

export type CompliancePosture = 'standard' | 'hipaa_sensitive';

/**
 * Returns the appropriate care unit label based on family status.
 */
export function getCareUnit(hasFamily: boolean): string {
  return hasFamily ? 'a family' : 'a person';
}

/**
 * Anonymizes a person's name when in HIPAA-sensitive mode.
 * In standard mode, returns the name as-is.
 */
export function anonymizeName(
  name: string,
  posture: CompliancePosture,
  hasFamily = false
): string {
  if (posture === 'standard') return name;
  return hasFamily ? 'a family' : 'a person';
}

/**
 * Anonymizes an organization name when in HIPAA-sensitive mode.
 * Returns 'an organization' or 'a community partner' instead.
 */
export function anonymizeOrganization(
  orgName: string,
  posture: CompliancePosture
): string {
  if (posture === 'standard') return orgName;
  return 'a community partner';
}

/**
 * Wraps a narrative sentence, replacing any direct identifiers
 * with compassionate anonymized phrasing.
 */
export function anonymizeNarrative(
  text: string,
  names: string[],
  posture: CompliancePosture
): string {
  if (posture === 'standard') return text;

  let result = text;
  for (const name of names) {
    if (name && name.length > 1) {
      // Replace all occurrences case-insensitively
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), 'a person');
    }
  }
  return result;
}

/**
 * Returns narrative-safe phrasing for counts/aggregations.
 * Avoids any tenant-specific language leakage.
 */
export function narrativeAggregate(
  count: number,
  posture: CompliancePosture,
  unit: 'person' | 'family' | 'care_unit' = 'care_unit'
): string {
  if (posture === 'standard') {
    const labels = { person: 'people', family: 'families', care_unit: 'people' };
    return `${count} ${count === 1 ? unit.replace('care_unit', 'person') : labels[unit]}`;
  }

  // HIPAA-sensitive: use care-unit language
  if (count === 1) return 'one individual served';
  return `${count} individuals and families served`;
}

/**
 * Checks if a tenant is in HIPAA-sensitive mode.
 * Defaults to 'standard' if not set.
 */
export function isHipaaSensitive(posture: CompliancePosture | null | undefined): boolean {
  return posture === 'hipaa_sensitive';
}
