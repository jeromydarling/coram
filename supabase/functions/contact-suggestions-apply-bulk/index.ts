import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_ENTITY_TYPES = ["event", "opportunity", "grant"];

interface SuggestedContact {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  source_url?: string | null;
  confidence?: number | null;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { entity_type, entity_id, indices, min_confidence } = body;

  if (!entity_type || !VALID_ENTITY_TYPES.includes(entity_type as string)) {
    return new Response(
      JSON.stringify({ ok: false, error: "entity_type must be one of: event, opportunity, grant" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!entity_id || typeof entity_id !== "string") {
    return new Response(
      JSON.stringify({ ok: false, error: "entity_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Fetch suggestion row via user client (RLS enforced)
  const { data: rows, error: fetchErr } = await userClient
    .from("contact_suggestions")
    .select("id, suggestions, status, applied_indices")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ ok: false, error: "Database query failed" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!rows || rows.length === 0) {
    return new Response(
      JSON.stringify({ ok: false, error: "No suggestions found for this entity" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const row = rows[0];
  const suggestions = row.suggestions as SuggestedContact[];
  let appliedIndices: number[] = (row.applied_indices as number[]) || [];

  // Determine which indices to process
  let targetIndices: number[];
  if (Array.isArray(indices)) {
    targetIndices = (indices as number[]).filter(
      (i) => typeof i === "number" && i >= 0 && i < suggestions.length,
    );
  } else {
    // All indices that meet confidence threshold
    const threshold = typeof min_confidence === "number" ? min_confidence : null;
    targetIndices = suggestions
      .map((_s, i) => i)
      .filter((i) => {
        if (threshold === null) return true;
        const conf = suggestions[i].confidence;
        return conf === null || conf === undefined || conf >= threshold;
      });
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  let createdCount = 0;
  let skippedApplied = 0;
  let skippedDuplicate = 0;
  const errors: { index: number; code: string; message: string }[] = [];

  for (const idx of targetIndices) {
    // Skip already applied
    if (appliedIndices.includes(idx)) {
      skippedApplied++;
      continue;
    }

    const contact = suggestions[idx];
    const finalName = contact.name;
    const finalEmail = contact.email;
    const finalPhone = contact.phone;
    const finalTitle = contact.title;

    if (!finalName && !finalEmail && !finalPhone) {
      errors.push({ index: idx, code: "no_identifier", message: "No name, email, or phone" });
      continue;
    }

    // Duplicate check
    let isDuplicate = false;
    if (finalEmail) {
      const dupQuery = adminClient.from("contacts").select("id").eq("email", finalEmail);
      if (entity_type === "opportunity") dupQuery.eq("opportunity_id", entity_id as string);
      else if (entity_type === "event") dupQuery.eq("met_at_event_id", entity_id as string);
      const { data: existing } = await dupQuery.limit(1);
      if (existing && existing.length > 0) isDuplicate = true;
    } else if (finalName && finalPhone) {
      const dupQuery = adminClient.from("contacts").select("id").eq("name", finalName).eq("phone", finalPhone);
      if (entity_type === "opportunity") dupQuery.eq("opportunity_id", entity_id as string);
      else if (entity_type === "event") dupQuery.eq("met_at_event_id", entity_id as string);
      const { data: existing } = await dupQuery.limit(1);
      if (existing && existing.length > 0) isDuplicate = true;
    }

    if (isDuplicate) {
      skippedDuplicate++;
      appliedIndices = [...new Set([...appliedIndices, idx])];
      continue;
    }

    // Create contact
    const contactRecord: Record<string, unknown> = {
      name: finalName || "Unknown",
      email: finalEmail || null,
      phone: finalPhone || null,
      title: finalTitle || null,
      created_by: user.id,
    };

    if (entity_type === "opportunity") contactRecord.opportunity_id = entity_id;
    else if (entity_type === "event") contactRecord.met_at_event_id = entity_id;

    const { error: createErr } = await adminClient
      .from("contacts")
      .insert(contactRecord)
      .select("id")
      .single();

    if (createErr) {
      errors.push({ index: idx, code: "create_failed", message: createErr.message });
      continue;
    }

    createdCount++;
    appliedIndices = [...new Set([...appliedIndices, idx])];
  }

  // Update applied_indices
  const allApplied = appliedIndices.length >= suggestions.length;
  const updatePayload: Record<string, unknown> = { applied_indices: appliedIndices };
  if (allApplied) updatePayload.status = "applied";

  await adminClient
    .from("contact_suggestions")
    .update(updatePayload)
    .eq("id", row.id);

  return new Response(
    JSON.stringify({
      ok: true,
      attempted: targetIndices.length,
      created_count: createdCount,
      skipped_applied: skippedApplied,
      skipped_duplicate: skippedDuplicate,
      errors,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(handleRequest);
