/**
 * scenario-list — Returns enabled demo scenarios.
 *
 * WHAT: Lists available demo scenarios from demo_scenarios table.
 * WHERE: Admin Scenario Lab.
 * WHY: Registry of named test scenarios for seeding + simulation.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "Missing auth");

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.slice(7));
  if (claimsErr || !claimsData?.claims) return jsonError(401, "unauthorized", "Invalid token");

  const userId = claimsData.claims.sub as string;
  const svc = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) return jsonError(403, "forbidden", "Admin only");

  const { data: scenarios, error } = await svc
    .from("demo_scenarios")
    .select("*")
    .eq("enabled", true)
    .order("key");

  if (error) return jsonError(500, "internal_error", error.message);
  return jsonOk({ ok: true, scenarios: scenarios ?? [] });
});
