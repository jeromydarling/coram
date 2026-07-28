/**
 * track-click — 302-redirects a tracked link, logging a click for Gardener campaigns.
 * WHAT: Validates sid + base64url-encoded u, records click_count/first_clicked_at,
 *       inserts a gardener_tracked_events row, then 302s to the decoded URL.
 * WHERE: Emitted into email HTML by gmail-campaign-send when Gardener tracking is on.
 * WHY: Gives operators a best-effort signal of link engagement.
 * verify_jwt = false (public redirector).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { base64UrlDecode } from "../_shared/federationTracking.ts";
import { captureEdgeException } from "../_shared/sentryCapture.ts";

const CORS = { "Access-Control-Allow-Origin": "*" };

function textResp(body: string, status: number) {
  return new Response(body, { status, headers: { ...CORS, "Content-Type": "text/plain" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const sid = url.searchParams.get("sid");
    const u = url.searchParams.get("u");
    if (!sid || !u) return textResp("Missing parameters", 400);
    if (!/^[0-9a-f-]{36}$/i.test(sid)) return textResp("Invalid sid", 400);

    let decoded: string;
    try {
      decoded = base64UrlDecode(u);
    } catch {
      return textResp("Invalid url encoding", 400);
    }

    let parsed: URL;
    try {
      parsed = new URL(decoded);
    } catch {
      return textResp("Invalid URL", 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return textResp("Unsupported scheme", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: send } = await supabase
      .from("gardener_tracked_sends")
      .select("id, first_clicked_at, click_count")
      .eq("id", sid)
      .maybeSingle();

    if (send) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("gardener_tracked_sends")
        .update({
          first_clicked_at: send.first_clicked_at ?? nowIso,
          click_count: (send.click_count ?? 0) + 1,
        })
        .eq("id", sid);

      await supabase.from("gardener_tracked_events").insert({
        send_id: sid,
        event_type: "click",
        url: parsed.toString(),
        user_agent: req.headers.get("user-agent") ?? null,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      });
    }

    return new Response(null, {
      status: 302,
      headers: { ...CORS, Location: parsed.toString(), "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("track-click error:", e);
    await captureEdgeException(e, "track-click");
    return textResp("Server error", 500);
  }
});
