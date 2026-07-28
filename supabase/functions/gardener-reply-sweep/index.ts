/**
 * gardener-reply-sweep — Periodically checks Gmail threads for replies to Gardener-tracked emails.
 *
 * WHAT: For each unresolved gardener_tracked_sends row with a gmail_thread_id, fetch the thread
 *       metadata via the Gardener's stored Gmail token and mark replied_at + snippet when a
 *       message from the recipient appeared after sent_at.
 * WHERE: Scheduled via pg_cron. `?age=fresh` runs every 15 min (sent < 7d).
 *        `?age=aged` runs daily 03:00 UTC (sent 7-30d).
 * WHY: Reply is a stronger signal than an open. Closes the CROS Federation feedback loop.
 * Time-bounded to ~4 minutes to fit a cron slot.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CORS = { "Access-Control-Allow-Origin": "*" };
const MAX_MS = 4 * 60 * 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function refreshGmailToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.access_token || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const started = Date.now();
  const url = new URL(req.url);
  const age = (url.searchParams.get("age") || "fresh").toLowerCase();
  const isFresh = age === "fresh";

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    const cutoffLo = new Date(now - (isFresh ? 7 : 30) * 24 * 3600 * 1000).toISOString();
    const cutoffHi = isFresh
      ? new Date(now).toISOString()
      : new Date(now - 7 * 24 * 3600 * 1000).toISOString();

    // Pull pending rows joined with their tracked campaign to get the gardener_user_id
    const { data: pending, error } = await admin
      .from("gardener_tracked_sends")
      .select("id, gmail_thread_id, sent_at, recipient_email, tracked_campaign_id, gardener_tracked_campaigns!inner(gardener_user_id)")
      .is("replied_at", null)
      .not("gmail_thread_id", "is", null)
      .gte("sent_at", cutoffLo)
      .lte("sent_at", cutoffHi)
      .order("sent_at", { ascending: true })
      .limit(500);

    if (error) return json({ ok: false, error: error.message }, 500);
    if (!pending || pending.length === 0) return json({ ok: true, processed: 0, marked: 0 });

    // Group by gardener_user_id to reuse a single access token per user
    const byGardener = new Map<string, typeof pending>();
    for (const row of pending) {
      // deno-lint-ignore no-explicit-any
      const gid = (row as any).gardener_tracked_campaigns?.gardener_user_id as string;
      if (!gid) continue;
      const arr = byGardener.get(gid) || [];
      arr.push(row);
      byGardener.set(gid, arr as any);
    }

    let processed = 0;
    let marked = 0;
    const warnings: string[] = [];

    for (const [gardenerId, rows] of byGardener.entries()) {
      if (Date.now() - started > MAX_MS) { warnings.push("time-bound reached"); break; }

      const { data: profile } = await admin
        .from("profiles")
        .select("google_refresh_token, gmail_email_address")
        .eq("user_id", gardenerId)
        .maybeSingle();
      if (!profile?.google_refresh_token) { warnings.push(`no gmail for ${gardenerId}`); continue; }

      const accessToken = await refreshGmailToken(profile.google_refresh_token);
      if (!accessToken) { warnings.push(`token refresh failed for ${gardenerId}`); continue; }

      for (const row of rows) {
        if (Date.now() - started > MAX_MS) break;
        processed++;
        try {
          const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(row.gmail_thread_id!)}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!res.ok) {
            await res.text();
            await admin.from("gardener_tracked_sends").update({ last_swept_at: new Date().toISOString() }).eq("id", row.id);
            continue;
          }
          const thread = await res.json();
          const messages = (thread.messages || []) as Array<any>;
          const sentAtMs = row.sent_at ? new Date(row.sent_at).getTime() : 0;

          let replied = false;
          let snippet: string | null = null;
          const recipient = (row.recipient_email || "").toLowerCase();

          for (const m of messages) {
            const internalMs = Number(m.internalDate || 0);
            if (internalMs <= sentAtMs) continue;
            const headers = (m.payload?.headers || []) as Array<{ name: string; value: string }>;
            const fromHdr = headers.find((h) => h.name?.toLowerCase() === "from")?.value?.toLowerCase() || "";
            if (fromHdr.includes(recipient)) {
              replied = true;
              snippet = (m.snippet || "").slice(0, 500);
              break;
            }
          }

          if (replied) {
            marked++;
            await admin.from("gardener_tracked_sends").update({
              replied_at: new Date().toISOString(),
              reply_snippet: snippet,
              reply_from_recipient: true,
              last_swept_at: new Date().toISOString(),
            }).eq("id", row.id);
            await admin.from("gardener_tracked_events").insert({
              send_id: row.id,
              event_type: "reply",
              metadata: { snippet },
            });
          } else {
            await admin.from("gardener_tracked_sends").update({ last_swept_at: new Date().toISOString() }).eq("id", row.id);
          }
        } catch (e) {
          warnings.push(`thread ${row.gmail_thread_id}: ${String(e).slice(0, 120)}`);
        }
      }
    }

    return json({ ok: true, age, processed, marked, warnings, duration_ms: Date.now() - started });
  } catch (e) {
    console.error("gardener-reply-sweep error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});
