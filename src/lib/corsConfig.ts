/**
 * corsConfig — Shared CORS origin allowlist for edge functions.
 *
 * WHAT: Provides a validated origin check instead of wildcard '*'.
 * WHERE: Import into any edge function that sets CORS headers.
 * WHY: Wildcard CORS allows any site to call authenticated endpoints.
 *
 * NOTE: Edge functions run in Deno and can't import from src/.
 * This file documents the canonical allowlist for reference.
 * The actual implementation is in each edge function via getAllowedOrigin().
 */

/**
 * Canonical list of allowed origins for CROS.
 * Update this when adding custom domains.
 */
export const ALLOWED_ORIGINS = [
  'https://thecros.lovable.app',
  'https://id-preview--42b69f1f-4d36-4265-955d-fba8e0c00a1a.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;

/**
 * Deno-compatible origin checker for edge functions.
 * Copy this function into edge functions that need origin validation.
 *
 * Usage in edge function:
 * ```ts
 * const allowedOrigins = ['https://thecros.lovable.app', ...];
 * function getAllowedOrigin(req: Request): string {
 *   const origin = req.headers.get('Origin') ?? '';
 *   return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
 * }
 * const corsHeaders = {
 *   'Access-Control-Allow-Origin': getAllowedOrigin(req),
 *   ...
 * };
 * ```
 */
export function getAllowedOrigin(requestOrigin: string | null): string {
  const origin = requestOrigin ?? '';
  if ((ALLOWED_ORIGINS as readonly string[]).includes(origin)) return origin;
  // In development/preview, allow lovable.app subdomains
  if (origin.endsWith('.lovable.app')) return origin;
  return ALLOWED_ORIGINS[0];
}
