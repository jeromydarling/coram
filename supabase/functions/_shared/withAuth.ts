/**
 * withAuth — JWT validation helper for edge functions.
 *
 * WHAT: Verifies the inbound Bearer token via supabase.auth.getClaims() and
 *       returns the authenticated user's claims plus a request-scoped client
 *       that forwards the Authorization header (so RLS applies).
 * WHERE: Use in edge functions that require an authenticated caller. Pair
 *        with withErrorEnvelope from ./errorEnvelope.ts for end-to-end
 *        CORS + auth + error handling.
 * WHY: Centralizes the "extract bearer → getClaims → 401 on failure" boilerplate
 *      that's currently duplicated across ~200 edge functions. Drift here is
 *      a security risk (each handler reimplementing auth gates).
 *
 * Usage:
 *   const auth = await requireAuth(req);
 *   if (!auth.ok) return auth.response;
 *   const { userId, claims, supabase } = auth;
 *   // ... use supabase with RLS as the caller
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { errorResponse, ERROR_CODES } from './errorEnvelope.ts';

export interface AuthClaims {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
  [key: string]: unknown;
}

export type AuthResult =
  | {
      ok: true;
      userId: string;
      token: string;
      claims: AuthClaims;
      /** Request-scoped client; queries run with the caller's RLS context. */
      supabase: SupabaseClient;
    }
  | { ok: false; response: Response };

/**
 * Validate the Authorization header on an inbound request.
 * Returns either the authenticated context or a 401 response ready to send.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: errorResponse(req, 'Missing or invalid Authorization header', ERROR_CODES.UNAUTHORIZED, 401),
    };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return {
      ok: false,
      response: errorResponse(req, 'Empty bearer token', ERROR_CODES.UNAUTHORIZED, 401),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      response: errorResponse(req, 'Auth not configured', ERROR_CODES.INTERNAL_ERROR, 500),
    };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return {
      ok: false,
      response: errorResponse(req, 'Invalid or expired session', ERROR_CODES.UNAUTHORIZED, 401),
    };
  }

  return {
    ok: true,
    userId: data.claims.sub as string,
    token,
    claims: data.claims as AuthClaims,
    supabase,
  };
}
