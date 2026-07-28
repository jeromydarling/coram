/**
 * Shared service-to-service auth for worker edge functions.
 * Workers are called internally by dispatchers, not by end users.
 */

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export function authenticateWorkerRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET") ?? "";
  const workerSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") ?? "";

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKey = req.headers.get("x-api-key") ?? "";

  const token = apiKey || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "");
  if (!token) return false;

  return (!!serviceRoleKey && token === serviceRoleKey) ||
    (!!sharedSecret && constantTimeCompare(token, sharedSecret)) ||
    (!!workerSecret && constantTimeCompare(token, workerSecret));
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
