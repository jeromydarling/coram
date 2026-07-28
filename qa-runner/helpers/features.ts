/**
 * Check if an optional feature flag env var is enabled.
 * Returns true if the env var is set to '1', 'true', or 'yes'.
 */
export function isEnabled(envVar: string): boolean {
  const val = process.env[envVar];
  if (!val) return false;
  return ['1', 'true', 'yes'].includes(val.toLowerCase());
}
