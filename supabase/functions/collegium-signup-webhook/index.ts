/**
 * collegium-signup-webhook — Receives partner signup events from Collegium
 * and creates operator_opportunities in the Gardener console.
 *
 * Auth: Bearer token must match COLLEGIUM_WEBHOOK_SECRET
 *       (falls back to PARTNER_WEBHOOK_SECRET for shared rotation).
 *
 * Payload shape (Collegium):
 *   {
 *     organization: string,           // firm / chambers / practice name
 *     contact_name: string,
 *     contact_email: string,
 *     role_chosen?: string,           // archetype/role they self-selected on Collegium
 *     collegium_lead_id?: string,     // opaque id from Collegium for idempotency
 *     referrer?: string,
 *     website?: string,
 *     city?: string,
 *     state?: string,
 *     zip?: string,
 *   }
 *
 * Backward compat: also accepts the Schola-shaped payload that the current
 * Collegium sender posts during the transition window, in which case it maps
 *   school_name → organization
 *   archetype   → role_chosen
 *   source: "collegium:*" is honored and tagged accordingly.
 *
 * Idempotent: deduplicates on collegium_lead_id stored in notes JSON.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Gardener admin user_id used by schola-signup-webhook — keep aligned.
const GARDENER_ADMIN_ID = "ba1d4774-11d5-4a62-9dd6-c15b5889d522";

// RFC-ish email regex (covers the realistic universe; pragmatic, not perfect).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // ── Auth (collegium-specific secret, with PARTNER_WEBHOOK_SECRET fallback) ──
  const secret =
    Deno.env.get("COLLEGIUM_WEBHOOK_SECRET") ??
    Deno.env.get("PARTNER_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[collegium-webhook] COLLEGIUM_WEBHOOK_SECRET not configured");
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

  // ── Normalize: accept Collegium-shaped OR transitional Schola-shaped payload ──
  const organization =
    (typeof body.organization === "string" && body.organization.trim()) ||
    (typeof body.school_name === "string" && body.school_name.trim()) ||
    "";
  const contactName =
    typeof body.contact_name === "string" ? body.contact_name.trim() : "";
  const contactEmail =
    typeof body.contact_email === "string" ? body.contact_email.trim() : "";
  const roleChosen =
    (typeof body.role_chosen === "string" && body.role_chosen.trim()) ||
    (typeof body.archetype === "string" && body.archetype.trim()) ||
    null;
  const collegiumLeadId =
    typeof body.collegium_lead_id === "string"
      ? body.collegium_lead_id.trim()
      : "";
  const referrer =
    typeof body.referrer === "string" ? body.referrer.trim() : null;
  const website =
    typeof body.website === "string" ? body.website.trim() : null;
  const city = typeof body.city === "string" ? body.city.trim() : null;
  const state = typeof body.state === "string" ? body.state.trim() : null;
  const zip = typeof body.zip === "string" ? body.zip.trim() : null;
  const sourceTag =
    typeof body.source === "string" && body.source.trim().startsWith("collegium")
      ? body.source.trim()
      : "collegium";

  // ── Validation ──
  if (!contactName) {
    return json({ ok: false, error: "Missing required field: contact_name" }, 400);
  }
  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    return json(
      { ok: false, error: "Missing or invalid required field: contact_email" },
      400
    );
  }
  if (!organization) {
    return json({ ok: false, error: "Missing required field: organization" }, 400);
  }

  // ── Supabase client (service role for insert) ──
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // ── Idempotency: dedupe on collegium_lead_id within source='collegium' ──
  if (collegiumLeadId) {
    const { data: existing } = await supabase
      .from("operator_opportunities")
      .select("id")
      .eq("source", "collegium")
      .ilike("notes", `%"collegium_lead_id":"${collegiumLeadId}"%`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(
        `[collegium-webhook] Duplicate skipped: collegium_lead_id=${collegiumLeadId}`
      );
      return json({
        ok: true,
        duplicate: true,
        opportunity_id: existing[0].id,
      });
    }
  }

  // ── Build notes JSON ──
  const notesObj: Record<string, unknown> = {
    collegium_lead_id: collegiumLeadId || undefined,
    platform: "collegium",
    contact_name: contactName,
    contact_email: contactEmail,
    role_chosen: roleChosen || undefined,
    referrer: referrer || undefined,
    source_tag: sourceTag,
    signup_at: new Date().toISOString(),
  };

  const description = `Collegium signup. Primary contact: ${contactName} (${contactEmail})${
    roleChosen ? ` — role: ${roleChosen}` : ""
  }`;

  // ── Insert opportunity ──
  const { data: opp, error: insertError } = await supabase
    .from("operator_opportunities")
    .insert({
      organization,
      website: website || null,
      website_url: website || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      source: "collegium",
      stage: "Researching",
      status: "active",
      description,
      notes: JSON.stringify(notesObj),
      created_by: GARDENER_ADMIN_ID,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[collegium-webhook] Insert failed:", insertError);
    return json({ ok: false, error: insertError.message }, 500);
  }

  console.log(
    `[collegium-webhook] Created opportunity ${opp.id} for "${organization}"`
  );
  return json({ ok: true, opportunity_id: opp.id });
});
