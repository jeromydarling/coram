import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth: admin only
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "unauthorized", "Missing auth token");
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonError(401, "unauthorized", "Invalid token");

  const svc = createClient(supabaseUrl, serviceRoleKey);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    return jsonError(403, "forbidden", "Admin role required");
  }

  try {
    const body = await req.json();
    const { target_tenant_id } = body as { target_tenant_id: string };

    if (!target_tenant_id) {
      return jsonError(400, "bad_request", "target_tenant_id required");
    }

    // Verify target tenant exists
    const { data: tenant, error: tErr } = await svc
      .from("tenants")
      .select("id, slug")
      .eq("id", target_tenant_id)
      .single();
    if (tErr || !tenant) return jsonError(404, "not_found", "Target tenant not found");

    // Create import batch
    const { data: batch, error: batchErr } = await svc
      .from("import_batches")
      .insert({
        tenant_id: target_tenant_id,
        source_system: "profunda",
        source_label: "Profunda vCurrent",
        status: "running",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (batchErr) throw new Error(`Batch creation failed: ${batchErr.message}`);

    const stats = {
      opportunities: { copied: 0, skipped: 0 },
      contacts: { copied: 0, skipped: 0 },
      events: { copied: 0, skipped: 0 },
      activities: { copied: 0, skipped: 0 },
    };

    // Import opportunities (set tenant_id on existing rows that have none)
    const { data: opps } = await svc
      .from("opportunities")
      .select("id")
      .is("tenant_id", null)
      .limit(1000);

    for (const opp of opps ?? []) {
      // Check if already mapped
      const { data: existing } = await svc
        .from("cros_import_mappings")
        .select("id")
        .eq("batch_id", batch.id)
        .eq("entity", "opportunity")
        .eq("source_id", opp.id)
        .maybeSingle();

      if (existing) {
        stats.opportunities.skipped++;
        continue;
      }

      await svc.from("opportunities").update({ tenant_id: target_tenant_id }).eq("id", opp.id);
      await svc.from("cros_import_mappings").insert({
        batch_id: batch.id,
        entity: "opportunity",
        source_id: opp.id,
        target_id: opp.id,
      });
      stats.opportunities.copied++;
    }

    // Import contacts
    const { data: contacts } = await svc
      .from("contacts")
      .select("id")
      .is("tenant_id", null)
      .limit(5000);

    for (const c of contacts ?? []) {
      const { data: existing } = await svc
        .from("cros_import_mappings")
        .select("id")
        .eq("batch_id", batch.id)
        .eq("entity", "contact")
        .eq("source_id", c.id)
        .maybeSingle();

      if (existing) {
        stats.contacts.skipped++;
        continue;
      }

      await svc.from("contacts").update({ tenant_id: target_tenant_id }).eq("id", c.id);
      await svc.from("cros_import_mappings").insert({
        batch_id: batch.id,
        entity: "contact",
        source_id: c.id,
        target_id: c.id,
      });
      stats.contacts.copied++;
    }

    // Import events
    const { data: events } = await svc
      .from("events")
      .select("id")
      .is("tenant_id", null)
      .limit(2000);

    for (const ev of events ?? []) {
      const { data: existing } = await svc
        .from("cros_import_mappings")
        .select("id")
        .eq("batch_id", batch.id)
        .eq("entity", "event")
        .eq("source_id", ev.id)
        .maybeSingle();

      if (existing) {
        stats.events.skipped++;
        continue;
      }

      await svc.from("events").update({ tenant_id: target_tenant_id }).eq("id", ev.id);
      await svc.from("cros_import_mappings").insert({
        batch_id: batch.id,
        entity: "event",
        source_id: ev.id,
        target_id: ev.id,
      });
      stats.events.copied++;
    }

    // Import activities
    const { data: acts } = await svc
      .from("activities")
      .select("id")
      .is("tenant_id", null)
      .limit(5000);

    for (const act of acts ?? []) {
      const { data: existing } = await svc
        .from("cros_import_mappings")
        .select("id")
        .eq("batch_id", batch.id)
        .eq("entity", "activity")
        .eq("source_id", act.id)
        .maybeSingle();

      if (existing) {
        stats.activities.skipped++;
        continue;
      }

      await svc.from("activities").update({ tenant_id: target_tenant_id }).eq("id", act.id);
      await svc.from("cros_import_mappings").insert({
        batch_id: batch.id,
        entity: "activity",
        source_id: act.id,
        target_id: act.id,
      });
      stats.activities.copied++;
    }

    // Update batch status
    await svc.from("import_batches").update({
      status: "completed",
      stats,
    }).eq("id", batch.id);

    return jsonOk({
      ok: true,
      batch_id: batch.id,
      stats,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-from-profunda error:", msg);
    return jsonError(500, "internal_error", msg);
  }
});

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
