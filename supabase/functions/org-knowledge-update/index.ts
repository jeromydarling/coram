import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

const VALID_KEYS = [
  "org_name", "mission", "positioning", "who_we_serve", "who_they_serve",
  "geographies", "programs", "key_stats", "tone_keywords",
  "approved_claims", "disallowed_claims", "partnership_angles", "sources",
  "headquarters",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) {
      return jsonError("Invalid token", 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ADMIN ONLY
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    // deno-lint-ignore no-explicit-any
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return jsonError("Admin access required", 403);
    }

    const body = await req.json();
    const { org_id, patch, notes } = body;

    if (!org_id) return jsonError("org_id required");
    if (!patch || typeof patch !== "object") return jsonError("patch required (object)");

    // Validate patch keys
    const patchKeys = Object.keys(patch);
    const invalidKeys = patchKeys.filter((k) => !VALID_KEYS.includes(k));
    if (invalidKeys.length > 0) {
      return jsonError(`Invalid keys: ${invalidKeys.join(", ")}`);
    }

    // Load current active snapshot
    const { data: current } = await supabase
      .from("org_knowledge_snapshots")
      .select("*")
      .eq("org_id", org_id)
      .eq("active", true)
      .eq("is_authoritative", true)
      .maybeSingle();

    const currentJson = (current?.structured_json || {}) as Record<string, unknown>;
    const currentVersion = current?.version || 0;

    // Merge patch into current
    const mergedJson = { ...currentJson, ...patch };

    // Deactivate previous BEFORE inserting new (unique constraint)
    if (current) {
      await supabase
        .from("org_knowledge_snapshots")
        .update({ active: false })
        .eq("id", current.id);
    }

    // Create new version
    const { data: newSnapshot, error: insertErr } = await supabase
      .from("org_knowledge_snapshots")
      .insert({
        org_id,
        source_url: current?.source_url || "",
        captured_at: new Date().toISOString(),
        model: "admin_manual",
        content_hash: `manual_${Date.now()}`,
        raw_excerpt: current?.raw_excerpt || "",
        structured_json: mergedJson,
        created_by: userId,
        version: currentVersion + 1,
        source_type: "admin_curated",
        is_authoritative: true,
        active: true,
        notes: notes || null,
      })
      .select("id, version")
      .single();

    if (insertErr) {
      console.error("Insert failed:", insertErr);
      return jsonError("Failed to create new version", 500);
    }

    // Update replaced_by on old snapshot
    if (current) {
      await supabase
        .from("org_knowledge_snapshots")
        .update({ replaced_by: newSnapshot.id })
        .eq("id", current.id);
    }

    // Backfill opportunity location from headquarters if present
    if (org_id && patch.headquarters) {
      const hq = patch.headquarters as { address_line1?: string; city?: string; state?: string; zip?: string };
      if (hq.city || hq.zip) {
        const { data: currentOrg } = await supabase
          .from("opportunities")
          .select("city, state, state_code, zip, address_line1")
          .eq("id", org_id)
          .maybeSingle();

        if (currentOrg) {
          const isGarbage = (v: string | null | undefined) => !v || /^(information not available|not found|n\/a|unknown)$/i.test(v.trim());
          const isUsable = (v: string | null | undefined): v is string => !!v && !isGarbage(v);
          const updates: Record<string, string> = {};
          if (isGarbage(currentOrg.city) && isUsable(hq.city)) updates.city = hq.city;
          if (isGarbage(currentOrg.state) && isUsable(hq.state)) updates.state = hq.state;
          if (isGarbage(currentOrg.state_code) && isUsable(hq.state)) updates.state_code = hq.state;
          if (isGarbage(currentOrg.zip) && isUsable(hq.zip)) updates.zip = hq.zip;
          if (isGarbage(currentOrg.address_line1) && isUsable(hq.address_line1)) updates.address_line1 = hq.address_line1;

          if (Object.keys(updates).length > 0) {
            await supabase.from("opportunities").update(updates).eq("id", org_id);
            console.log(`Backfilled location for org ${org_id}: ${JSON.stringify(updates)}`);
          }
        }
      }
    }

    return jsonResponse({
      ok: true,
      snapshot_id: newSnapshot.id,
      version: newSnapshot.version,
    });
  } catch (error) {
    console.error("org-knowledge-update error:", error);
    return jsonError(error instanceof Error ? error.message : "Internal error", 500);
  }
});
