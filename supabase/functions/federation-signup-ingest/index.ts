/**
 * federation-signup-ingest — Receives signup / customer events from federation apps
 * (initially Propria) and attributes them to a Gardener-tracked send.
 *
 * WHAT: HMAC-authenticated POST endpoint. Matches by cros_sid first, then by
 *       email_hash within a 60-day window. Unmatched events go to the orphan table.
 * WHERE: Propria calls this on successful signup and again on paid conversion.
 * WHY: Closes the loop between an outbound email and downstream federation conversion.
 * verify_jwt = false (signed with per-app HMAC secret).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { emailHash } from "../_shared/federationTracking.ts";
import { captureEdgeException } from "../_shared/sentryCapture.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-federation-app, x-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Constant-time string compare
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function computeHmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Env var name for a federation app's shared HMAC secret
function secretEnvVarFor(appSlug: string): string {
  return `${appSlug.toUpperCase().replace(/-/g, "_")}_FEDERATION_INGEST_SECRET`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const appSlug = (req.headers.get("x-federation-app") || "").toLowerCase().trim();
    const signature = req.headers.get("x-signature") || "";
    if (!appSlug) return json({ error: "Missing X-Federation-App" }, 400);
    if (!signature) return json({ error: "Missing X-Signature" }, 401);

    const secret = Deno.env.get(secretEnvVarFor(appSlug));
    if (!secret) return json({ error: "Unknown federation app or secret not configured" }, 401);

    const rawBody = await req.text();
    const expected = await computeHmac(secret, rawBody);
    if (!timingSafeEqual(expected, signature.toLowerCase())) {
      return json({ error: "Invalid signature" }, 401);
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const eventType = payload.event_type;
    if (eventType !== "signup" && eventType !== "customer") {
      return json({ error: "event_type must be 'signup' or 'customer'" }, 400);
    }
    const externalUserId = String(payload.external_user_id || "").trim();
    if (!externalUserId) return json({ error: "external_user_id is required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confirm federation app is real
    const { data: fedApp } = await supabase
      .from("federation_apps")
      .select("slug")
      .eq("slug", appSlug)
      .maybeSingle();
    if (!fedApp) return json({ error: "Unknown federation app" }, 404);

    const crosSid: string | null = payload.cros_sid || null;
    const providedHash: string | null = payload.email_hash || null;
    const rawEmail: string | null = payload.email || null;
    const computedHash = rawEmail ? await emailHash(rawEmail) : null;
    const finalHash = providedHash || computedHash;

    // Idempotency: existing orphan or event for (app, external_user, event_type)
    const { data: existingOrphan } = await supabase
      .from("gardener_federation_signup_orphans")
      .select("id")
      .eq("federation_app_slug", appSlug)
      .eq("external_user_id", externalUserId)
      .eq("event_type", eventType)
      .maybeSingle();

    // 1) Attempt cros_sid attribution
    let sendId: string | null = null;
    if (crosSid && /^[0-9a-f-]{36}$/i.test(crosSid)) {
      const { data: tsend } = await supabase
        .from("gardener_tracked_sends")
        .select("id, tracked_campaign_id, first_signup_at, first_customer_at, gardener_tracked_campaigns!inner(federation_app_slug)")
        .eq("id", crosSid)
        .maybeSingle();
      // deno-lint-ignore no-explicit-any
      const gtc: any = (tsend as any)?.gardener_tracked_campaigns;
      if (tsend && gtc?.federation_app_slug === appSlug) sendId = tsend.id;
    }

    // 2) Fallback: email_hash within 60 days
    if (!sendId && finalHash) {
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data: match } = await supabase
        .from("gardener_tracked_sends")
        .select("id, sent_at, gardener_tracked_campaigns!inner(federation_app_slug)")
        .eq("recipient_email_hash", finalHash)
        .gte("sent_at", cutoff)
        .order("sent_at", { ascending: false })
        .limit(10);
      // deno-lint-ignore no-explicit-any
      const matchedRow = (match || []).find((r: any) => r.gardener_tracked_campaigns?.federation_app_slug === appSlug);
      if (matchedRow) sendId = matchedRow.id;
    }

    const occurredAt = payload.occurred_at || new Date().toISOString();

    if (sendId) {
      const patch: Record<string, unknown> = {};
      if (eventType === "signup") patch.first_signup_at = occurredAt;
      if (eventType === "customer") {
        patch.first_customer_at = occurredAt;
        if (payload.plan) patch.customer_plan = String(payload.plan);
        if (typeof payload.amount_cents === "number") patch.customer_amount_cents = payload.amount_cents;
      }
      // Only set first_* if not already set
      const { data: current } = await supabase
        .from("gardener_tracked_sends")
        .select("first_signup_at, first_customer_at")
        .eq("id", sendId)
        .maybeSingle();
      const upd: Record<string, unknown> = {};
      if (eventType === "signup" && !current?.first_signup_at) upd.first_signup_at = occurredAt;
      if (eventType === "customer") {
        if (!current?.first_customer_at) upd.first_customer_at = occurredAt;
        if (patch.customer_plan) upd.customer_plan = patch.customer_plan;
        if (patch.customer_amount_cents != null) upd.customer_amount_cents = patch.customer_amount_cents;
      }
      if (Object.keys(upd).length > 0) {
        await supabase.from("gardener_tracked_sends").update(upd).eq("id", sendId);
      }

      // Idempotent event insert
      const { data: existingEvt } = await supabase
        .from("gardener_tracked_events")
        .select("id")
        .eq("send_id", sendId)
        .eq("event_type", eventType)
        .limit(1)
        .maybeSingle();
      if (!existingEvt) {
        await supabase.from("gardener_tracked_events").insert({
          send_id: sendId,
          event_type: eventType,
          federation_app_slug: appSlug,
          metadata: {
            external_user_id: externalUserId,
            plan: payload.plan ?? null,
            amount_cents: payload.amount_cents ?? null,
          },
          occurred_at: occurredAt,
        });
      }

      // Clean up any previously-recorded orphan for this app/user/event
      if (existingOrphan) {
        await supabase
          .from("gardener_federation_signup_orphans")
          .delete()
          .eq("id", existingOrphan.id);
      }

      return json({ ok: true, matched: true, send_id: sendId, event_type: eventType });
    }

    // 3) Orphan (idempotent upsert)
    if (existingOrphan) {
      return json({ ok: true, matched: false, orphan: true, orphan_id: existingOrphan.id });
    }
    const { data: orphan } = await supabase
      .from("gardener_federation_signup_orphans")
      .insert({
        federation_app_slug: appSlug,
        email: rawEmail,
        email_hash: finalHash,
        external_user_id: externalUserId,
        event_type: eventType,
        metadata: {
          plan: payload.plan ?? null,
          amount_cents: payload.amount_cents ?? null,
          cros_sid: crosSid,
          occurred_at: occurredAt,
        },
      })
      .select("id")
      .maybeSingle();

    return json({ ok: true, matched: false, orphan: true, orphan_id: orphan?.id });
  } catch (e) {
    console.error("federation-signup-ingest error:", e);
    await captureEdgeException(e, "federation-signup-ingest");
    return json({ error: "Server error" }, 500);
  }
});
