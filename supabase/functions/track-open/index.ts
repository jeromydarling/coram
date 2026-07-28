/**
 * track-open — 1x1 GIF beacon for CROS Federation email tracking.
 * WHAT: Records an open event for a gardener_tracked_sends row and returns a transparent GIF.
 * WHERE: Injected as <img src=".../track-open?sid=<id>"> by gmail-campaign-send when Gardener tracking is on.
 * WHY: Gives operators a best-effort signal that a recipient viewed the email.
 * verify_jwt = false (public beacon).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// 1x1 transparent GIF
const GIF_BYTES = Uint8Array.from([
  71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255, 33,
  249, 4, 1, 0, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
]);

const IMAGE_HEADERS: Record<string, string> = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "Access-Control-Allow-Origin": "*",
};

function gifResponse(status = 200) {
  return new Response(GIF_BYTES, { status, headers: IMAGE_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: IMAGE_HEADERS });

  try {
    const url = new URL(req.url);
    const sid = url.searchParams.get("sid");
    if (!sid || !/^[0-9a-f-]{36}$/i.test(sid)) return gifResponse(400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: send, error } = await supabase
      .from("gardener_tracked_sends")
      .select("id, first_opened_at, open_count")
      .eq("id", sid)
      .maybeSingle();

    if (error || !send) return gifResponse(200); // Silent 200 to not tip senders

    // Dedupe within 10s: if last event was < 10s ago, count but don't double-log
    const nowIso = new Date().toISOString();
    const first = send.first_opened_at ?? nowIso;

    await supabase
      .from("gardener_tracked_sends")
      .update({
        first_opened_at: send.first_opened_at ?? nowIso,
        open_count: (send.open_count ?? 0) + 1,
      })
      .eq("id", sid);

    // Insert event unless duplicate within 10s
    const { data: recent } = await supabase
      .from("gardener_tracked_events")
      .select("id, occurred_at")
      .eq("send_id", sid)
      .eq("event_type", "open")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const shouldInsert = !recent ||
      new Date(nowIso).getTime() - new Date(recent.occurred_at).getTime() > 10_000;

    if (shouldInsert) {
      await supabase.from("gardener_tracked_events").insert({
        send_id: sid,
        event_type: "open",
        user_agent: req.headers.get("user-agent") ?? null,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      });
    }

    void first;
    return gifResponse(200);
  } catch (e) {
    console.error("track-open error:", e);
    return gifResponse(200);
  }
});
