import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LEASE_SECONDS = 300;
const MAX_ATTEMPTS = 3;

// ── Exported for testing ──

export function authenticateRequest(req: Request): { ok: true } | { ok: false; response: Response } {
  const secret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  if (!secret) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Server misconfigured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== secret) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return { ok: true };
}

export function parseQueryParams(url: string) {
  const parsed = new URL(url);
  return {
    leaseSeconds: parseInt(parsed.searchParams.get("lease_seconds") ?? String(LEASE_SECONDS), 10),
    workerId: parsed.searchParams.get("worker_id") ?? "default",
    maxAttempts: parseInt(parsed.searchParams.get("max_attempts") ?? String(MAX_ATTEMPTS), 10),
  };
}

export function buildJobResponse(data: unknown, error: { message: string } | null): Response {
  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: "Database unavailable" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({ ok: true, job: data ?? null }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ── Handler ──

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const auth = authenticateRequest(req);
  if (!auth.ok) return auth.response;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const params = parseQueryParams(req.url);

  try {
    const { data, error } = await supabase.rpc("enrichment_job_next", {
      p_lease_seconds: params.leaseSeconds,
      p_worker_id: params.workerId,
      p_max_attempts: params.maxAttempts,
    });

    return buildJobResponse(data, error);
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal error" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

Deno.serve(handleRequest);
