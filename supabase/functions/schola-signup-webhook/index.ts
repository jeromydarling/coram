/**
 * schola-signup-webhook — Receives partner signup events from external apps
 * and creates operator_opportunities in the Gardener console.
 *
 * Auth: Bearer token must match PARTNER_WEBHOOK_SECRET (falls back to SCHOLA_WEBHOOK_SECRET).
 * Idempotent: deduplicates on schola_id stored in notes JSON.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // ── Auth (accept either secret name) ──
  const secret = Deno.env.get("PARTNER_WEBHOOK_SECRET") ?? Deno.env.get("SCHOLA_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[partner-webhook] PARTNER_WEBHOOK_SECRET not configured");
    return json({ ok: false, error: "Webhook not configured" }, 503);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== secret) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const schoolName = typeof body.school_name === "string" ? body.school_name.trim() : "";
  const scholaId = typeof body.schola_id === "string" ? body.schola_id.trim() : "";
  if (!schoolName) {
    return json({ ok: false, error: "Missing required field: school_name" }, 400);
  }

  // ── Supabase client (service role for insert) ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Idempotency: check for existing record with same schola_id ──
  if (scholaId) {
    const { data: existing } = await supabase
      .from("operator_opportunities")
      .select("id")
      .eq("source", "schola")
      .ilike("notes", `%"schola_id":"${scholaId}"%`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[schola-webhook] Duplicate skipped: schola_id=${scholaId}`);
      return json({ ok: true, duplicate: true, opportunity_id: existing[0].id });
    }
  }

  // ── Build opportunity record ──
  // Gardener admin user_id as created_by (system-created records)
  const GARDENER_ADMIN_ID = "ba1d4774-11d5-4a62-9dd6-c15b5889d522";

  const contactName = typeof body.contact_name === "string" ? body.contact_name.trim() : null;
  const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim() : null;
  const website = typeof body.website === "string" ? body.website.trim() : null;
  const city = typeof body.city === "string" ? body.city.trim() : null;
  const state = typeof body.state === "string" ? body.state.trim() : null;
  const zip = typeof body.zip === "string" ? body.zip.trim() : null;
  const archetype = typeof body.archetype === "string" ? body.archetype.trim() : null;

  const notesObj: Record<string, unknown> = {
    schola_id: scholaId || undefined,
    platform: "schola",
    contact_name: contactName || undefined,
    contact_email: contactEmail || undefined,
    archetype: archetype || undefined,
    signup_at: new Date().toISOString(),
  };

  const description = contactName
    ? `School signup via Schola. Primary contact: ${contactName}${contactEmail ? ` (${contactEmail})` : ""}`
    : "School signup via Schola.";

  const { data: opp, error: insertError } = await supabase
    .from("operator_opportunities")
    .insert({
      organization: schoolName,
      website: website || null,
      website_url: website || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      source: "schola",
      stage: "Researching",
      status: "active",
      description,
      notes: JSON.stringify(notesObj),
      created_by: GARDENER_ADMIN_ID,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[schola-webhook] Insert failed:", insertError);
    return json({ ok: false, error: insertError.message }, 500);
  }

  console.log(`[schola-webhook] Created opportunity ${opp.id} for "${schoolName}"`);
  return json({ ok: true, opportunity_id: opp.id });
});
