/**
 * formation-prompts-build — Generates gentle, role-aware formation prompts.
 *
 * WHAT: Pulls activity signals and creates ≤2 prompts per user per day.
 * WHERE: Called weekly or on-demand by operator.
 * WHY: Helps users stay present without overwhelm.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLE_PROMPTS: Record<string, { type: string; content: string }[]> = {
  visitor: [
    { type: "encouragement", content: "Would you like to record a thought from today?" },
    { type: "reflection", content: "Your visits matter. When you speak a note or mark a visit, it becomes part of the shared memory." },
  ],
  companion: [
    { type: "next_step", content: "A gentle follow-up could strengthen this relationship." },
    { type: "encouragement", content: "Your presence in the community is quietly making a difference." },
  ],
  shepherd: [
    { type: "reflection", content: "Your reflections are helping the story become clearer." },
    { type: "gentle_checkin", content: "Take a moment to notice what has shifted this week." },
  ],
  steward: [
    { type: "gentle_checkin", content: "Your team is moving steadily. A small check-in may help them continue." },
    { type: "encouragement", content: "The rhythms your team is building are forming something lasting." },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id required");

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    // Get tenant users with roles
    const { data: tenantUsers } = await svc
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenant_id);

    if (!tenantUsers?.length) {
      return new Response(JSON.stringify({ ok: true, prompts_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = tenantUsers.map((tu: any) => tu.user_id);

    // Get roles for these users
    const { data: userRoles } = await svc
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap = new Map<string, string>();
    for (const ur of userRoles || []) {
      // Map app roles to formation roles
      const formRole =
        ur.role === "admin" ? "steward" :
        ur.role === "leadership" ? "steward" :
        ur.role === "regional_lead" ? "shepherd" :
        ur.role === "warehouse_manager" ? "visitor" :
        "companion";
      roleMap.set(ur.user_id, formRole);
    }

    // Check existing prompts today to enforce ≤2 per user per day
    const { data: existingToday } = await svc
      .from("formation_prompts")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .gte("created_at", todayStart.toISOString());

    const todayCounts = new Map<string, number>();
    for (const ep of existingToday || []) {
      if (ep.user_id) {
        todayCounts.set(ep.user_id, (todayCounts.get(ep.user_id) || 0) + 1);
      }
    }

    // Check for activity signals to choose contextual prompts
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentActivities } = await svc
      .from("activities")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .gte("activity_date_time", weekAgo)
      .limit(1);

    const hasRecentActivity = (recentActivities?.length || 0) > 0;

    const prompts: any[] = [];

    for (const userId of userIds) {
      const existing = todayCounts.get(userId) || 0;
      if (existing >= 2) continue;

      const role = roleMap.get(userId) || "companion";
      const templates = ROLE_PROMPTS[role] || ROLE_PROMPTS.companion;

      // Pick one prompt (contextual selection)
      const template = hasRecentActivity ? templates[0] : templates[1] || templates[0];
      if (!template) continue;

      prompts.push({
        tenant_id,
        user_id: userId,
        role,
        prompt_type: template.type,
        source: "narrative_engine",
        content: template.content,
        context: { has_recent_activity: hasRecentActivity },
        expires_at: expiresAt,
      });
    }

    if (prompts.length > 0) {
      const { error } = await svc.from("formation_prompts").insert(prompts);
      if (error) throw error;
    }

    // Health telemetry
    await svc.from("system_health_events").insert({
      schedule_key: "formation_prompts_build",
      status: "ok",
      stats: { prompts_created: prompts.length, users_scanned: userIds.length },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, prompts_created: prompts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
