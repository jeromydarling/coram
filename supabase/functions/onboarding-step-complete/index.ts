/**
 * onboarding-step-complete — Marks a step as complete/skipped.
 *
 * WHAT: Updates onboarding_progress and checks if all required steps are done.
 * WHERE: Called from OnboardingGuide when user completes an action.
 * WHY: Tracks tenant onboarding progress and triggers completion.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { step_key, tenant_id, action } = await req.json();
    if (!step_key || !tenant_id) {
      return new Response(JSON.stringify({ error: "step_key and tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify tenant membership
    const { data: membership } = await admin
      .from("tenant_users")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newStatus = action === "skip" ? "skipped" : "complete";

    // Update progress row
    const { error: updateErr } = await admin
      .from("onboarding_progress")
      .update({
        status: newStatus,
        completed_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id)
      .eq("step_key", step_key);

    if (updateErr) throw updateErr;

    // Check if all required steps are complete
    const { data: session } = await admin
      .from("onboarding_sessions")
      .select("archetype")
      .eq("tenant_id", tenant_id)
      .single();

    if (session) {
      // Get required steps
      const { data: requiredSteps } = await admin
        .from("onboarding_steps")
        .select("key")
        .eq("archetype", session.archetype)
        .eq("optional", false);

      const requiredKeys = (requiredSteps ?? []).map((s: any) => s.key);

      // Get completed/skipped progress
      const { data: progress } = await admin
        .from("onboarding_progress")
        .select("step_key, status")
        .eq("tenant_id", tenant_id)
        .in("status", ["complete", "skipped"]);

      const doneKeys = new Set((progress ?? []).map((p: any) => p.step_key));
      const allDone = requiredKeys.every((k: string) => doneKeys.has(k));

      if (allDone) {
        await admin
          .from("onboarding_sessions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            current_step: null,
          })
          .eq("tenant_id", tenant_id);

        // Log value moment
        await admin.from("operator_value_moments").insert({
          tenant_id,
          moment_type: "onboarding_progress",
          summary: "Onboarding completed — all required steps finished.",
          pointers: {},
        }).catch(() => {});
      } else {
        // Advance current_step to next incomplete required step
        const { data: allSteps } = await admin
          .from("onboarding_steps")
          .select("key, order_index")
          .eq("archetype", session.archetype)
          .order("order_index");

        const nextStep = (allSteps ?? []).find((s: any) => !doneKeys.has(s.key));
        if (nextStep) {
          await admin
            .from("onboarding_sessions")
            .update({ current_step: nextStep.key })
            .eq("tenant_id", tenant_id);
        }
      }
    }

    // Log health moment
    const momentSummaries: Record<string, string> = {
      connect_email: "I connected my email and began building relationship memory.",
      connect_calendar: "I connected my calendar to stay aware of meetings.",
      create_first_reflection: "I wrote my first reflection — relationship memory begins.",
      add_event: "I added my first local event.",
      enable_signum: "I enabled local signals — community awareness is flowing.",
      import_contacts: "I imported my contacts into CROS.",
      join_communio: "I joined the shared network.",
      connect_hubspot: "I connected HubSpot to bridge my CRM.",
    };

    const summary = momentSummaries[step_key] ?? `Completed step: ${step_key}`;
    await admin.from("operator_value_moments").insert({
      tenant_id,
      moment_type: "onboarding_progress",
      summary,
      pointers: { step_key },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ ok: true, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
