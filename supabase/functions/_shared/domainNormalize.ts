/**
 * Normalize a URL or domain string to a bare domain.
 * - Lowercase
 * - Strip protocol, path, query, fragment
 * - Strip www. prefix
 * Example: https://WWW.Example.org/about → example.org
 */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let input = raw.trim().toLowerCase();
  if (!input) return null;

  // Add protocol if missing so URL parser works
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;

  try {
    const parsed = new URL(input);
    let host = parsed.hostname;
    // Strip www.
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    return null;
  }
}
