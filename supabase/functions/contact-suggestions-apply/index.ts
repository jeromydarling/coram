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

interface Override {
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
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

  const { entity_type, entity_id, suggestion_index, override } = body;

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

  if (typeof suggestion_index !== "number" || suggestion_index < 0) {
    return new Response(
      JSON.stringify({ ok: false, error: "suggestion_index must be a non-negative number" }),
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
  const appliedIndices: number[] = (row.applied_indices as number[]) || [];

  if (suggestion_index >= suggestions.length) {
    return new Response(
      JSON.stringify({ ok: false, error: `suggestion_index out of range (max: ${suggestions.length - 1})` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const contact = suggestions[suggestion_index as number];
  const ovr = (override && typeof override === "object" ? override : {}) as Override;

  // Merge override with suggestion (override wins)
  const finalName = ovr.name || contact.name;
  const finalEmail = ovr.email || contact.email;
  const finalPhone = ovr.phone || contact.phone;
  const finalTitle = ovr.title || contact.title;

  // Require at least one identifying field
  if (!finalName && !finalEmail && !finalPhone) {
    return new Response(
      JSON.stringify({ ok: false, error: "Suggestion has no name, email, or phone — cannot create contact" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  // Duplicate check: email-based if present, else name+phone
  if (finalEmail) {
    const dupQuery = adminClient
      .from("contacts")
      .select("id")
      .eq("email", finalEmail);

    if (entity_type === "opportunity") {
      dupQuery.eq("opportunity_id", entity_id);
    } else if (entity_type === "event") {
      dupQuery.eq("met_at_event_id", entity_id);
    }

    const { data: existing } = await dupQuery.limit(1);
    if (existing && existing.length > 0) {
      // Still mark as applied
      if (!appliedIndices.includes(suggestion_index as number)) {
        const newIndices = [...appliedIndices, suggestion_index as number];
        await adminClient
          .from("contact_suggestions")
          .update({ applied_indices: newIndices })
          .eq("id", row.id);
      }
      return new Response(
        JSON.stringify({ ok: true, created: false, reason: "duplicate", contact_id: existing[0].id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } else if (finalName && finalPhone) {
    const dupQuery = adminClient
      .from("contacts")
      .select("id")
      .eq("name", finalName)
      .eq("phone", finalPhone);

    if (entity_type === "opportunity") {
      dupQuery.eq("opportunity_id", entity_id);
    } else if (entity_type === "event") {
      dupQuery.eq("met_at_event_id", entity_id);
    }

    const { data: existing } = await dupQuery.limit(1);
    if (existing && existing.length > 0) {
      if (!appliedIndices.includes(suggestion_index as number)) {
        const newIndices = [...appliedIndices, suggestion_index as number];
        await adminClient
          .from("contact_suggestions")
          .update({ applied_indices: newIndices })
          .eq("id", row.id);
      }
      return new Response(
        JSON.stringify({ ok: true, created: false, reason: "duplicate", contact_id: existing[0].id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // Build contact record
  const contactRecord: Record<string, unknown> = {
    name: finalName || "Unknown",
    email: finalEmail || null,
    phone: finalPhone || null,
    title: finalTitle || null,
    created_by: user.id,
  };

  if (entity_type === "opportunity") {
    contactRecord.opportunity_id = entity_id;
  } else if (entity_type === "event") {
    contactRecord.met_at_event_id = entity_id;
  }

  const { data: newContact, error: createErr } = await adminClient
    .from("contacts")
    .insert(contactRecord)
    .select("id")
    .single();

  if (createErr) {
    console.error("Contact creation error:", createErr.message);
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to create contact" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Update applied_indices
  const newIndices = [...new Set([...appliedIndices, suggestion_index as number])];
  const allApplied = newIndices.length >= suggestions.length;
  const updatePayload: Record<string, unknown> = { applied_indices: newIndices };
  if (allApplied) {
    updatePayload.status = "applied";
  }

  await adminClient
    .from("contact_suggestions")
    .update(updatePayload)
    .eq("id", row.id);

  return new Response(
    JSON.stringify({ ok: true, created: true, contact_id: newContact.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

Deno.serve(handleRequest);
