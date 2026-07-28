/**
 * activation-manage — Unified edge function for Guided Activation™ lifecycle.
 *
 * Actions:
 *   request_scheduling — tenant user submits preferred times
 *   schedule           — operator sets scheduled_at + meet_link
 *   complete           — operator marks one session done
 *   cancel             — operator cancels session
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, msg: string) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "Missing auth token");
  }
  const token = authHeader.slice(7).trim();
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonError(401, "Invalid token");
  }
  const userId = claimsData.claims.sub as string;

  const svc = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { action, activation_session_id } = body;

    if (!activation_session_id || !action) {
      return jsonError(400, "activation_session_id and action required");
    }

    // Fetch session
    const { data: session, error: fetchErr } = await svc
      .from("activation_sessions")
      .select("*")
      .eq("id", activation_session_id)
      .single();

    if (fetchErr || !session) {
      return jsonError(404, "Activation session not found");
    }

    // Check if user is admin/leadership
    const { data: roles } = await svc
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "leadership");

    // Check tenant membership
    const { data: membership } = await svc
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("tenant_id", session.tenant_id)
      .maybeSingle();
    const isTenantMember = !!membership;

    // ── request_scheduling (tenant user) ─────────────────
    if (action === "request_scheduling") {
      if (!isTenantMember && !isAdmin) {
        return jsonError(403, "Not authorized");
      }
      const requested_times = String(body.requested_times ?? "").slice(0, 1000);
      const customer_notes = String(body.customer_notes ?? "").slice(0, 2000);

      await svc
        .from("activation_sessions")
        .update({ requested_times, customer_notes })
        .eq("id", activation_session_id);

      return jsonOk({ ok: true });
    }

    // ── schedule (operator/admin) ────────────────────────
    if (action === "schedule") {
      if (!isAdmin) return jsonError(403, "Only admins can schedule");

      const scheduled_at = body.scheduled_at;
      if (!scheduled_at || new Date(scheduled_at) <= new Date()) {
        return jsonError(400, "scheduled_at must be in the future");
      }
      const meet_link = body.meet_link ?? null;
      const duration_minutes = body.duration_minutes ?? 90;

      // Build optional Google Calendar template URL
      const startDate = new Date(scheduled_at);
      const endDate = new Date(startDate.getTime() + duration_minutes * 60000);
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Guided Activation\u2122")}&dates=${fmt(startDate)}/${fmt(endDate)}&details=${encodeURIComponent("CROS Guided Activation session")}`;

      await svc
        .from("activation_sessions")
        .update({
          status: "scheduled",
          scheduled_at,
          meet_link,
          duration_minutes,
          calendar_event_url: calUrl,
        })
        .eq("id", activation_session_id);

      return jsonOk({ ok: true, calendar_event_url: calUrl });
    }

    // ── complete (operator/admin) ────────────────────────
    if (action === "complete") {
      if (!isAdmin) return jsonError(403, "Only admins can complete sessions");

      const remaining = Math.max(0, (session.sessions_remaining as number) - 1);
      const newStatus = remaining === 0 ? "completed" : "pending";
      const operator_notes = body.operator_notes ?? session.operator_notes;

      await svc
        .from("activation_sessions")
        .update({
          sessions_remaining: remaining,
          status: newStatus,
          operator_notes,
          scheduled_at: remaining > 0 ? null : session.scheduled_at,
          meet_link: remaining > 0 ? null : session.meet_link,
        })
        .eq("id", activation_session_id);

      return jsonOk({ ok: true, sessions_remaining: remaining, status: newStatus });
    }

    // ── cancel (operator/admin) ──────────────────────────
    if (action === "cancel") {
      if (!isAdmin) return jsonError(403, "Only admins can cancel sessions");

      const reason = body.reason ?? "";
      const notes = session.operator_notes
        ? `${session.operator_notes}\n[Canceled] ${reason}`
        : `[Canceled] ${reason}`;

      await svc
        .from("activation_sessions")
        .update({ status: "canceled", operator_notes: notes })
        .eq("id", activation_session_id);

      return jsonOk({ ok: true });
    }

    return jsonError(400, `Unknown action: ${action}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[activation-manage] Error:", msg);
    return jsonError(500, msg);
  }
});
