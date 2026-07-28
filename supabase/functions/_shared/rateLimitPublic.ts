/**
 * rateLimitPublic — Shared IP-based rate limiter for public edge functions.
 *
 * WHAT: In-memory per-instance rate limiting for public endpoints.
 * WHERE: Used by event-register, public-communio-signals, unsubscribe, and other public functions.
 * WHY: Prevents abuse/spam on public-facing endpoints without requiring auth.
 *
 * Note: Per-instance only (resets on cold start). For persistent rate limiting, use DB-backed approach.
 */

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Check if a request should be rate limited.
 *
 * @param key - Unique key (typically IP + endpoint)
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @param maxRequests - Max requests per window (default: 10)
 * @returns true if the request should be BLOCKED
 */
export function isRateLimited(
  key: string,
  windowMs = 60_000,
  maxRequests = 10,
): boolean {
  cleanup();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count++;
  return bucket.count > maxRequests;
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Simple bot detection heuristics for public endpoints.
 * Returns true if the request looks like a bot.
 */
export function isLikelyBot(req: Request): boolean {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();

  // No user-agent at all
  if (!ua) return true;

  // Common bot signatures
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl/', 'wget/',
    'python-requests', 'httpclient', 'go-http', 'java/',
    'headlesschrome', 'phantomjs', 'selenium',
  ];

  return botPatterns.some(p => ua.includes(p));
}

/**
 * Combined rate limit + bot check for public endpoints.
 * Returns null if allowed, or a Response if blocked.
 */
export function guardPublicEndpoint(
  req: Request,
  endpointName: string,
  opts?: { windowMs?: number; maxRequests?: number; allowBots?: boolean },
): Response | null {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Bot check (soft — just rate limit more aggressively)
  const ip = getClientIp(req);
  const bot = !opts?.allowBots && isLikelyBot(req);

  const windowMs = opts?.windowMs ?? 60_000;
  const maxRequests = bot ? Math.max(1, Math.floor((opts?.maxRequests ?? 10) / 5)) : (opts?.maxRequests ?? 10);

  const key = `${endpointName}:${ip}`;
  if (isRateLimited(key, windowMs, maxRequests)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again shortly.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return null;
}
