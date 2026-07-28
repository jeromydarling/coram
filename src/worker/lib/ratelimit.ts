/**
 * ratelimit — KV-backed fixed windows.
 *
 * §3.7 permits holding an IP address for a rate-limit window of at most 24
 * hours and nowhere else. That constraint shapes this file:
 *
 *   - The IP is hashed before it becomes a key, so the stored value is not the
 *     address itself.
 *   - Every key gets a KV TTL. Expiry is the storage policy, not a cleanup job
 *     that might not run.
 *   - Nothing here writes to Postgres. An IP never reaches the database.
 *
 * The previous codebase rate-limited in per-isolate memory, which on Workers
 * means each of hundreds of isolates keeps its own count and the effective
 * limit is the stated one times the isolate count. KV is shared, so the number
 * configured is close to the number enforced.
 */

import type { Env } from '../env';
import { sha256Hex } from './crypto';

export interface RateLimit {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. Must not exceed 24h (§3.7). */
  windowSeconds: number;
}

/** Login is the one endpoint where a slow limit is worth the friction. */
export const LOGIN_LIMIT: RateLimit = { limit: 8, windowSeconds: 15 * 60 };
export const SIGNUP_LIMIT: RateLimit = { limit: 5, windowSeconds: 60 * 60 };
export const RESET_LIMIT: RateLimit = { limit: 5, windowSeconds: 60 * 60 };

const MAX_WINDOW_SECONDS = 24 * 60 * 60;

export interface RateResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window rolls over. */
  resetIn: number;
}

/**
 * Count one request against `bucket` for this client.
 *
 * Fixed window rather than sliding: it costs one KV read and one write instead
 * of a list, and the failure mode — up to 2x the limit across a window
 * boundary — is acceptable for the endpoints above.
 */
export async function consume(
  env: Env,
  bucket: string,
  clientIp: string | null,
  rule: RateLimit,
): Promise<RateResult> {
  if (rule.windowSeconds > MAX_WINDOW_SECONDS) {
    throw new Error(`Rate limit window exceeds the 24h ceiling in §3.7: ${rule.windowSeconds}s`);
  }

  // No IP means we cannot attribute the request. Allow it rather than block
  // everyone behind an unusual proxy; the endpoints this guards all have a
  // second line of defence (password verification, token redemption).
  if (!clientIp) return { allowed: true, remaining: rule.limit, resetIn: rule.windowSeconds };

  const window = Math.floor(Date.now() / 1000 / rule.windowSeconds);
  const key = `rate:${bucket}:${await sha256Hex(clientIp)}:${window}`;

  const current = Number((await env.KV_RATE.get(key)) ?? 0);
  const used = current + 1;

  await env.KV_RATE.put(key, String(used), {
    // Two windows of TTL so a key written at the very end of a window is not
    // evicted before that window closes.
    expirationTtl: Math.max(60, rule.windowSeconds * 2),
  });

  const elapsed = Math.floor(Date.now() / 1000) % rule.windowSeconds;
  return {
    allowed: used <= rule.limit,
    remaining: Math.max(0, rule.limit - used),
    resetIn: rule.windowSeconds - elapsed,
  };
}

/** Cloudflare sets this on every inbound request. */
export function clientIp(req: Request): string | null {
  return req.headers.get('cf-connecting-ip');
}
