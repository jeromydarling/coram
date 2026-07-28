/**
 * activation-bootstrap — Creates or refreshes a per-tenant activation checklist.
 *
 * WHAT: Assembles checklist items from templates based on tenant config (addons, connectors).
 * WHERE: Called after Guided Activation purchase or manually by operator.
 * WHY: Ensures each tenant has a tailored preparation checklist for onboarding.
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

  // Auth
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
  const userId = claimsData.claims.sub as string;

  const svc = createClient(supabaseUrl, serviceRoleKey);

  // Only admin can bootstrap
  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "leadership");
  if (!isAdmin) {
    return jsonError(403, "Admin role required");
  }

  try {
    const body = await req.json();
    const { tenant_id } = body;
    if (!tenant_id) return jsonError(400, "tenant_id required");

    // Determine applicable template keys
    const templateKeys: string[] = ["base"];

    // Check tenant feature flags for addons
    const { data: flags } = await svc
      .from("tenant_feature_flags")
      .select("flag_key, enabled")
      .eq("tenant_id", tenant_id);

    const flagMap = new Map((flags ?? []).map((f: any) => [f.flag_key, f.enabled]));

    if (flagMap.get("campaigns_enabled")) templateKeys.push("campaigns");
    if (flagMap.get("civitas_enabled")) templateKeys.push("metros");
    if (flagMap.get("communio_enabled")) templateKeys.push("communio");

    // Check tenant connectors
    const { data: connectors } = await svc
      .from("tenant_integrations")
      .select("connector_key")
      .eq("tenant_id", tenant_id)
      .eq("status", "active");

    for (const c of connectors ?? []) {
      const key = (c as any).connector_key;
      if (["hubspot", "salesforce", "gmail", "outlook"].includes(key)) {
        templateKeys.push(key);
      }
    }

    // Fetch templates
    const { data: templates } = await svc
      .from("activation_checklist_templates")
      .select("*")
      .in("key", templateKeys)
      .eq("active", true);

    // Upsert checklist
    const { data: checklist, error: upsertErr } = await svc
      .from("activation_checklists")
      .upsert(
        { tenant_id, template_keys: templateKeys, status: "not_started", readiness_score: 0 },
        { onConflict: "tenant_id" }
      )
      .select("id")
      .single();

    if (upsertErr) return jsonError(500, upsertErr.message);

    // Flatten template items and upsert checklist items
    const allItems: any[] = [];
    for (const t of templates ?? []) {
      const items = (t.items as any[]) ?? [];
      for (const item of items) {
        allItems.push({
          checklist_id: checklist.id,
          item_key: item.key,
          category: item.category,
          label: item.label,
          help: item.help ?? null,
          required: item.required ?? true,
        });
      }
    }

    if (allItems.length > 0) {
      const { error: itemsErr } = await svc
        .from("activation_checklist_items")
        .upsert(allItems, { onConflict: "checklist_id,item_key", ignoreDuplicates: true });
      if (itemsErr) {
        console.error("[activation-bootstrap] items upsert error:", itemsErr.message);
      }
    }

    // Compute readiness
    const { data: items } = await svc
      .from("activation_checklist_items")
      .select("required, completed")
      .eq("checklist_id", checklist.id);

    const requiredItems = (items ?? []).filter((i: any) => i.required);
    const completedRequired = requiredItems.filter((i: any) => i.completed);
    const score = requiredItems.length > 0
      ? Math.round((completedRequired.length / requiredItems.length) * 100)
      : 0;
    const status = score >= 90 ? "ready" : completedRequired.length > 0 ? "in_progress" : "not_started";

    await svc
      .from("activation_checklists")
      .update({ readiness_score: score, status })
      .eq("id", checklist.id);

    return jsonOk({
      ok: true,
      checklist_id: checklist.id,
      template_keys: templateKeys,
      item_count: allItems.length,
      readiness_score: score,
      status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[activation-bootstrap] Error:", msg);
    return jsonError(500, msg);
  }
});
