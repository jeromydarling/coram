/**
 * errorEnvelope — Standardized response format for all edge functions.
 *
 * WHAT: Consistent JSON response envelope with machine-readable codes.
 * WHERE: Used by all edge functions for success and error responses.
 * WHY: Ensures predictable API contracts across the platform.
 */

import { getCorsHeaders, handleCorsPreflightResponse } from './cors.ts';

export interface SuccessEnvelope<T = unknown> {
  ok: true;
  data?: T;
  [key: string]: unknown;
}

export interface ErrorEnvelope {
  ok: false;
  error: string;
  code: string;
  request_id?: string;
}

/**
 * Generate a short correlation ID. Reuses the inbound `x-request-id` header
 * if present so traces can hop across services; otherwise mints a fresh one.
 */
export function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') || crypto.randomUUID().slice(0, 8);
}

/**
 * Create a success response with consistent envelope.
 */
export function successResponse<T>(req: Request, data?: T, extra?: Record<string, unknown>, status = 200): Response {
  const body: SuccessEnvelope<T> = { ok: true, ...extra };
  if (data !== undefined) body.data = data;
  const requestId = getRequestId(req);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'x-request-id': requestId },
  });
}

/**
 * Create an error response with consistent envelope.
 * Always includes a correlation `request_id` so support can trace failures
 * in one round-trip without spelunking through logs.
 */
export function errorResponse(
  req: Request,
  message: string,
  code: string,
  status = 400,
): Response {
  const requestId = getRequestId(req);
  const body: ErrorEnvelope = { ok: false, error: message, code, request_id: requestId };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json', 'x-request-id': requestId },
  });
}

/**
 * Standard error codes for common situations.
 */
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_TENANT: 'MISSING_TENANT',
  FEATURE_NOT_ENABLED: 'FEATURE_NOT_ENABLED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  NO_DATA: 'NO_DATA',
  DUPLICATE: 'DUPLICATE',
  SEND_LIMIT_EXCEEDED: 'SEND_LIMIT_EXCEEDED',
} as const;

/**
 * Wrap an edge function handler with standard error handling + CORS.
 * Catches unhandled errors and returns a consistent error envelope.
 */
export function withErrorEnvelope(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return handleCorsPreflightResponse(req);
    }
    try {
      return await handler(req);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error('[edge-function] Unhandled error:', detail);
      // Never leak internal error details to client
      return errorResponse(req, 'An internal error occurred. Please try again.', ERROR_CODES.INTERNAL_ERROR, 500);
    }
  };
}

// ── Legacy API (backwards-compatible, deprecated) ──────────────────
// These maintain the old signatures for functions not yet migrated.
// @deprecated Use the request-aware versions above.

const legacyCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** @deprecated Use successResponse(req, data, extra, status) */
export function legacySuccessResponse<T>(data?: T, extra?: Record<string, unknown>, status = 200): Response {
  const body: SuccessEnvelope<T> = { ok: true, ...extra };
  if (data !== undefined) body.data = data;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...legacyCorsHeaders, 'Content-Type': 'application/json' },
  });
}

/** @deprecated Use errorResponse(req, message, code, status) */
export function legacyErrorResponse(message: string, code: string, status = 400): Response {
  const body: ErrorEnvelope = { ok: false, error: message, code };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...legacyCorsHeaders, 'Content-Type': 'application/json' },
  });
}
