/**
 * notifications-generate-digest — Calm Digest Generation Engine.
 *
 * WHAT: Generates role-aware narrative digest content for users.
 * WHERE: Called by cron (daily/weekly/monthly) or manually.
 * WHY: Every role deserves rhythmic, pastoral updates — never urgency.
 *
 * Structure per digest:
 *   1) NOTICING — "What unfolded around you…"
 *   2) REFLECTION — NRI narrative summary
 *   3) OPERATIONAL INSIGHT — Role-aware content
 *   4) GENTLE INVITATION — Optional next steps
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DigestPref {
  user_id: string;
  tenant_id: string | null;
  frequency: string;
  include_visits: boolean;
  include_projects: boolean;
  include_narratives: boolean;
  include_network: boolean;
  include_system: boolean;
  include_essays: boolean;
  include_living_pulse: boolean;
}

interface DigestSection {
  heading: string;
  body: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const body = await req.json().catch(() => ({}));
    const targetFrequency = body.frequency || "weekly";

    // 1) Fetch users with matching digest frequency
    const { data: prefs, error: prefsErr } = await supabase
      .from("user_digest_preferences")
      .select("*")
      .eq("frequency", targetFrequency);

    if (prefsErr) throw prefsErr;

    if (!prefs?.length) {
      return new Response(
        JSON.stringify({ ok: true, count: 0, message: "No users subscribed to this frequency" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const digests: Array<{ user_id: string; sections: DigestSection[] }> = [];

    for (const pref of prefs as DigestPref[]) {
      const sections: DigestSection[] = [];
      const tenantFilter = pref.tenant_id;
      const lookbackDays = targetFrequency === "daily" ? 1 : targetFrequency === "weekly" ? 7 : 30;
      const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

      // ── NOTICING ──
      const noticingParts: string[] = [];

      if (pref.include_visits && tenantFilter) {
        const { count } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantFilter)
          .eq("activity_type", "Visit")
          .gte("activity_date_time", since);
        if (count && count > 0) {
          noticingParts.push(`${count} visit${count > 1 ? "s" : ""} recorded`);
        }
      }

      if (pref.include_projects && tenantFilter) {
        const { count } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantFilter)
          .eq("activity_type", "Project")
          .gte("activity_date_time", since);
        if (count && count > 0) {
          noticingParts.push(`${count} project${count > 1 ? "s" : ""} in motion`);
        }
      }

      if (pref.include_narratives && tenantFilter) {
        const { count } = await supabase
          .from("living_system_signals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantFilter)
          .gte("created_at", since);
        if (count && count > 0) {
          noticingParts.push(`${count} narrative signal${count > 1 ? "s" : ""} emerged`);
        }
      }

      if (pref.include_network && tenantFilter) {
        const { count } = await supabase
          .from("testimonium_events")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantFilter)
          .gte("created_at", since);
        if (count && count > 0) {
          noticingParts.push(`${count} moment${count > 1 ? "s" : ""} of presence witnessed`);
        }
      }

      if (noticingParts.length > 0) {
        sections.push({
          heading: "Noticing",
          body: `What unfolded around you: ${noticingParts.join(", ")}.`,
        });
      } else {
        sections.push({
          heading: "Noticing",
          body: "A season of quietness. Sometimes the garden rests before new growth.",
        });
      }

      // ── REFLECTION ──
      // NRI-generated narrative summary placeholder (actual AI call via n8n)
      const reflectionBody = noticingParts.length > 0
        ? `Across ${lookbackDays === 1 ? "today" : `the past ${lookbackDays} days`}, your community showed signs of movement. ${noticingParts[0]} — a gentle reminder that presence matters.`
        : `In seasons of quiet, the seeds planted earlier continue to grow beneath the surface.`;

      sections.push({
        heading: "Reflection",
        body: reflectionBody,
      });

      // ── OPERATIONAL INSIGHT (role-aware) ──
      // Fetch user's ministry role
      const { data: profile } = await supabase
        .from("profiles")
        .select("ministry_role")
        .eq("user_id", pref.user_id)
        .maybeSingle();

      const role = (profile as any)?.ministry_role || "companion";
      let insightBody = "";

      if (role === "visitor") {
        insightBody = noticingParts.length > 0
          ? "Your visits are making a difference. Each encounter carries meaning."
          : "Even when the schedule is quiet, your willingness to show up matters.";
      } else if (role === "companion") {
        insightBody = "The people you accompany are part of a larger story unfolding across your community.";
      } else if (role === "shepherd") {
        insightBody = "As a shepherd, you hold the threads that connect individual care to communal movement.";
      } else {
        insightBody = "Your stewardship helps the community navigate its next chapter with intention.";
      }

      sections.push({ heading: "Insight", body: insightBody });

      // ── GENTLE INVITATION ──
      sections.push({
        heading: "Invitation",
        body: "When you're ready, your community is waiting. No rush — presence is its own gift.",
      });

      // ── ESSAYS (optional) ──
      if (pref.include_essays) {
        const { count } = await supabase
          .from("library_essays")
          .select("id", { count: "exact", head: true })
          .eq("status", "ready_for_review");
        if (count && count > 0) {
          sections.push({
            heading: "Living Library",
            body: `${count} essay${count > 1 ? "s" : ""} ready for review — stories waiting to be shared.`,
          });
        }
      }

      digests.push({ user_id: pref.user_id, sections });
    }

    // Store generated digests for pickup by email system (n8n)
    for (const digest of digests) {
      await supabase.from("automation_runs").insert({
        run_id: crypto.randomUUID(),
        workflow_key: "digest_generation",
        status: "processed",
        payload: { user_id: digest.user_id, frequency: targetFrequency, sections: digest.sections },
        dedupe_key: `digest:${digest.user_id}:${targetFrequency}:${new Date().toISOString().split("T")[0]}`,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, count: digests.length, frequency: targetFrequency }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notifications-generate-digest] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
