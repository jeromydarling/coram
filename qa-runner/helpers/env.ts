/**
 * Require an environment variable or throw.
 */
export function requireEnv(name: string): string {
  // Support common aliases
  const aliases: Record<string, string[]> = {
    QA_DEFAULT_BASE_URL: ['BASE_URL', 'QA_DEFAULT_BASE_URL'],
    QA_LOGIN_EMAIL: ['QA_EMAIL', 'QA_LOGIN_EMAIL'],
    QA_LOGIN_PASSWORD: ['QA_PASSWORD', 'QA_LOGIN_PASSWORD'],
  };

  const keys = aliases[name] || [name];
  for (const k of keys) {
    const val = process.env[k];
    if (val) return val;
  }

  throw new Error(`Missing required env var: ${name} (checked: ${keys.join(', ')})`);
}
