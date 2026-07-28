/**
 * publish-essay-to-satellite — Push an approved library_essay to its target satellite via HMAC ingest.
 *
 * WHAT: Reads an essay from thecros.library_essays and POSTs a signed payload to the satellite's
 *       /ingest-essay edge function. The satellite verifies the HMAC signature and writes via its
 *       own service-role key (which never leaves that satellite).
 * WHERE: Called from the Content Studio "Publish to {satellite}" action, or by cron for any essay
 *        where status='published' and target_app != 'thecros' and synced_to_satellite_at IS NULL.
 * WHY:  Better security than cross-DB service-role calls — each satellite owns its master key.
 *       Trivial secret rotation, no key sprawl on the hub, uniform pattern across federation.
 *
 * Auth: service-role on the hub. HMAC shared secret to each satellite.
 *
 * Inputs (POST JSON):
 *   { essay_id: string }
 *
 * Outputs:
 *   { ok: true, target_app, satellite_essay_id, synced_to_satellite_at, canonical_url }
 *   or
 *   { ok: false, error: string, message: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ ok: false, error: code, message }, status);
}

/**
 * Compute HMAC-SHA256 of a payload string using a shared secret.
 * Returns hex-encoded signature.
 */
async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "POST only");
  }

  // Parse payload
  let payload: { essay_id?: string };
  try {
    payload = await req.json();
  } catch {
    return errorResponse(400, "bad_json", "Invalid JSON body");
  }
  const essayId = payload.essay_id;
  if (!essayId || typeof essayId !== "string") {
    return errorResponse(400, "missing_essay_id", "essay_id is required");
  }

  // Hub Supabase client (service role)
  const hubUrl = Deno.env.get("SUPABASE_URL");
  const hubServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!hubUrl || !hubServiceKey) {
    return errorResponse(500, "hub_not_configured", "Hub Supabase env not set");
  }
  const hub = createClient(hubUrl, hubServiceKey);

  // 1) Load the essay
  const { data: essay, error: essayErr } = await hub
    .from("library_essays")
    .select(
      "id, target_app, status, slug, title, excerpt, content_markdown, voice_profile, tags, citations, seo_title, seo_description, canonical_url, schema_json, meta_robots, published_at",
    )
    .eq("id", essayId)
    .single();

  if (essayErr || !essay) {
    return errorResponse(404, "essay_not_found", essayErr?.message ?? "Essay not found");
  }

  if (essay.status !== "published") {
    return errorResponse(400, "not_published", `Essay status is '${essay.status}', expected 'published'`);
  }

  if (!essay.target_app || essay.target_app === "thecros") {
    return errorResponse(400, "no_satellite_target", `Essay target_app is '${essay.target_app}', not a satellite`);
  }

  if (!essay.content_markdown || !essay.title || !essay.slug) {
    return errorResponse(400, "essay_incomplete", "Essay is missing required content fields");
  }

  // 2) Load satellite registration from federated_apps
  const { data: appRow, error: appErr } = await hub
    .from("federated_apps")
    .select("source_app, display_name, public_base_url, ingest_url, ingest_secret_name, is_active")
    .eq("source_app", essay.target_app)
    .single();

  if (appErr || !appRow) {
    return errorResponse(404, "satellite_not_registered", `No federated_apps row for '${essay.target_app}'`);
  }
  if (!appRow.is_active) {
    return errorResponse(400, "satellite_inactive", `Satellite '${essay.target_app}' is not active`);
  }
  if (!appRow.ingest_url || !appRow.ingest_secret_name) {
    return errorResponse(
      500,
      "satellite_not_configured",
      `Satellite '${essay.target_app}' is missing ingest_url or ingest_secret_name`,
    );
  }

  // 3) Load shared HMAC secret from env
  const sharedSecret = Deno.env.get(appRow.ingest_secret_name);
  if (!sharedSecret) {
    const msg = `Missing ingest secret env: ${appRow.ingest_secret_name}`;
    await hub.from("library_essays").update({ sync_error: msg }).eq("id", essayId);
    return errorResponse(500, "secret_missing", msg);
  }

  // 4) Build canonical_url if not already set
  const canonicalUrl =
    essay.canonical_url ??
    (appRow.public_base_url ? `${appRow.public_base_url.replace(/\/$/, "")}/library/${essay.slug}` : null);

  // 5) Build signed payload
  //    Body shape mirrors the upsert_published_essay RPC params (without the p_ prefix).
  //    Timestamp included to prevent replay; satellite enforces ±5 minute window.
  const ingestBody = {
    timestamp: new Date().toISOString(),
    essay: {
      hub_essay_id: essay.id,
      slug: essay.slug,
      title: essay.title,
      excerpt: essay.excerpt,
      content_markdown: essay.content_markdown,
      hero_image_url: null, // hero images TBD; pass null for now
      voice_profile: essay.voice_profile,
      tags: essay.tags ?? [],
      citations: essay.citations ?? [],
      seo_title: essay.seo_title ?? essay.title,
      seo_description: essay.seo_description ?? essay.excerpt ?? "",
      canonical_url: canonicalUrl,
      schema_json: essay.schema_json,
      meta_robots: essay.meta_robots ?? "index,follow",
      published_at: essay.published_at,
      unpublished_at: null,
    },
  };

  const bodyJson = JSON.stringify(ingestBody);
  const signature = await hmacSign(bodyJson, sharedSecret);

  // 6) POST to satellite's ingest-essay edge function
  let satResponse: Response;
  try {
    satResponse = await fetch(appRow.ingest_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CROS-Signature": signature,
        "X-CROS-Source": "thecros",
      },
      body: bodyJson,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await hub.from("library_essays").update({ sync_error: `network: ${msg}` }).eq("id", essayId);
    return errorResponse(502, "satellite_unreachable", msg);
  }

  let satResult: { ok?: boolean; id?: string; error?: string; message?: string } = {};
  try {
    satResult = await satResponse.json();
  } catch {
    /* satellite returned non-JSON */
  }

  if (!satResponse.ok || !satResult.ok) {
    const msg = satResult.message || satResult.error || `HTTP ${satResponse.status}`;
    await hub.from("library_essays").update({ sync_error: msg }).eq("id", essayId);
    return errorResponse(502, "satellite_rejected", msg);
  }

  // 7) Mark synced on hub
  const syncedAt = new Date().toISOString();
  const { error: updErr } = await hub
    .from("library_essays")
    .update({
      synced_to_satellite_at: syncedAt,
      sync_error: null,
    })
    .eq("id", essayId);

  if (updErr) {
    // eslint-disable-next-line no-console
    console.warn("[publish-essay-to-satellite] hub update failed after satellite write:", updErr.message);
  }

  return jsonResponse({
    ok: true,
    target_app: essay.target_app,
    satellite_essay_id: satResult.id ?? null,
    synced_to_satellite_at: syncedAt,
    canonical_url: canonicalUrl,
  });
});
