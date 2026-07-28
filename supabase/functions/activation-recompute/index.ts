/**
 * activation-recompute — Recompute checklist readiness score after item changes.
 *
 * WHAT: Recalculates readiness_score and status for a tenant's checklist.
 * WHERE: Called after toggling checklist items.
 * WHY: Keeps readiness metrics accurate without complex client-side logic.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing auth token");
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonError(401, "Invalid token");
  }

  const svc = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { checklist_id } = body;
    if (!checklist_id) return jsonError(400, "checklist_id required");

    const { data: items } = await svc
      .from("activation_checklist_items")
      .select("required, completed, notes")
      .eq("checklist_id", checklist_id);

    const requiredItems = (items ?? []).filter((i: any) => i.required);
    const completedRequired = requiredItems.filter((i: any) => i.completed);
    const hasBlocked = (items ?? []).some((i: any) =>
      i.notes && String(i.notes).toLowerCase().includes("blocked")
    );

    const score = requiredItems.length > 0
      ? Math.round((completedRequired.length / requiredItems.length) * 100)
      : 0;

    let status = "not_started";
    if (hasBlocked) {
      status = "blocked";
    } else if (score >= 90) {
      status = "ready";
    } else if (completedRequired.length > 0) {
      status = "in_progress";
    }

    await svc
      .from("activation_checklists")
      .update({ readiness_score: score, status })
      .eq("id", checklist_id);

    return jsonOk({ ok: true, readiness_score: score, status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(500, msg);
  }
});
