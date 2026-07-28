/**
 * /health — Watchtower health probe.
 *
 * Returns a compact JSON document describing whether this project can reach
 * its core dependencies. Watchtower hits this URL every 5 minutes.
 *
 * Update the project-specific checks below as the project grows.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

type Checks = Record<string, "ok" | "degraded" | "down">;

async function checkDatabase(): Promise<"ok" | "down"> {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );
    const { error } = await sb.from("_watchtower_probe").select("*").limit(1).abortSignal(AbortSignal.timeout(3000));
    // Table doesn't need to exist — a "relation does not exist" error still proves connectivity
    if (error && (error.code === "42P01" || error.code === "PGRST205")) return "ok";
    return error ? "down" : "ok";
  } catch { return "down"; }
}

async function checkAuth(): Promise<"ok" | "down"> {
  try {
    const url = Deno.env.get("SUPABASE_URL")! + "/auth/v1/settings";
    const res = await fetch(url, {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "" },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? "ok" : "down";
  } catch { return "down"; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const checks: Checks = {};
  const [db, auth] = await Promise.all([checkDatabase(), checkAuth()]);
  checks.database = db;
  checks.auth = auth;

  // Add project-specific checks here as needed, e.g.:
  //   checks.stripe = await checkStripe();

  const overall: "ok" | "degraded" | "down" =
    Object.values(checks).every((v) => v === "ok") ? "ok" :
    Object.values(checks).some((v) => v === "down") ? "down" : "degraded";

  return new Response(JSON.stringify({
    status: overall,
    checks,
    version: Deno.env.get("GIT_SHA") ?? "unknown",
    timestamp: new Date().toISOString(),
  }), {
    status: overall === "down" ? 503 : 200,
    headers: { ...CORS, "content-type": "application/json" },
  });
});
