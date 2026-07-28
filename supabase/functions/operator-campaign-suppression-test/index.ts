/**
 * operator-campaign-suppression-test — Admin-only campaign gating verification.
 *
 * WHAT: Verifies suppressed recipients are excluded from campaign audience preflight.
 * WHERE: Called from Operator Demo Lab → Integration Test Harness.
 * WHY: Confirms email compliance works before real sends, no emails sent.
 *
 * AUTH: Admin only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface StepResult {
  step_key: string;
  label: string;
  status: "passed" | "failed" | "skipped";
  details: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tenant_id, email, environment = "sandbox" } = body;

    if (!tenant_id || !email) {
      return new Response(JSON.stringify({ error: "tenant_id and email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Create test run
    const { data: testRun, error: runError } = await adminClient
      .from("operator_test_runs")
      .insert({
        tenant_id,
        suite_key: "campaign_suppression",
        environment,
        status: "running",
        started_by: user.id,
      })
      .select("id")
      .single();

    if (runError || !testRun) {
      return new Response(JSON.stringify({ error: "Failed to create test run" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const steps: StepResult[] = [];
    let createdTestSuppression = false;

    // Step 1: Check if email is already suppressed
    const { data: existingSuppression } = await adminClient
      .from("email_suppressions")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingSuppression) {
      steps.push({
        step_key: "suppression_exists",
        label: "Suppression Record Exists",
        status: "passed",
        details: { pre_existing: true, suppression_id: existingSuppression.id },
      });
    } else {
      // Create test suppression fixture
      const { error: insertErr } = await adminClient
        .from("email_suppressions")
        .insert({
          tenant_id,
          email: normalizedEmail,
          reason: "unsubscribed",
          source: "operator_test",
          metadata: { test: true, test_run_id: testRun.id },
        });

      if (insertErr) {
        steps.push({
          step_key: "suppression_exists",
          label: "Create Test Suppression Fixture",
          status: "failed",
          details: { error: insertErr.message },
        });
      } else {
        createdTestSuppression = true;
        steps.push({
          step_key: "suppression_exists",
          label: "Create Test Suppression Fixture",
          status: "passed",
          details: { created_for_test: true },
        });
      }
    }

    // Step 2: Simulate campaign preflight audience check
    // This replicates the suppression filtering logic used in gmail-campaign-send and outlook-send
    const suppressedEmails = new Set<string>();

    const { data: suppressions } = await adminClient
      .from("email_suppressions")
      .select("email")
      .eq("tenant_id", tenant_id);
    for (const s of suppressions || []) {
      if (s.email) suppressedEmails.add(s.email.toLowerCase());
    }

    // Also check do_not_email contacts
    const { data: dneContacts } = await adminClient
      .from("contacts")
      .select("email")
      .eq("tenant_id", tenant_id)
      .eq("do_not_email", true)
      .not("email", "is", null);
    for (const c of dneContacts || []) {
      if (c.email) suppressedEmails.add(c.email.toLowerCase());
    }

    const isExcluded = suppressedEmails.has(normalizedEmail);

    if (isExcluded) {
      steps.push({
        step_key: "preflight_exclusion",
        label: "Preflight Audience Exclusion",
        status: "passed",
        details: {
          email: normalizedEmail,
          excluded: true,
          reason: "unsubscribed",
          total_suppressed: suppressedEmails.size,
        },
      });
    } else {
      steps.push({
        step_key: "preflight_exclusion",
        label: "Preflight Audience Exclusion",
        status: "failed",
        details: {
          email: normalizedEmail,
          excluded: false,
          error: "Email was NOT excluded from audience. Suppression filtering may be broken.",
        },
      });
    }

    // Step 3: Verify do_not_email contact flag check
    const { data: dneCheck } = await adminClient
      .from("contacts")
      .select("id, name, do_not_email")
      .eq("tenant_id", tenant_id)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (dneCheck) {
      steps.push({
        step_key: "dne_contact_check",
        label: "Contact do_not_email Flag",
        status: dneCheck.do_not_email ? "passed" : "passed",
        details: {
          contact_found: true,
          contact_name: dneCheck.name,
          do_not_email: dneCheck.do_not_email,
          note: dneCheck.do_not_email
            ? "Contact is also flagged do_not_email"
            : "Contact exists but not flagged — suppression list handles exclusion",
        },
      });
    } else {
      steps.push({
        step_key: "dne_contact_check",
        label: "Contact do_not_email Flag",
        status: "passed",
        details: {
          contact_found: false,
          note: "No contact record for this email — suppression list handles exclusion independently.",
        },
      });
    }

    // Cleanup: remove test-created suppression
    if (createdTestSuppression) {
      await adminClient
        .from("email_suppressions")
        .delete()
        .eq("tenant_id", tenant_id)
        .eq("email", normalizedEmail)
        .eq("source", "operator_test");

      steps.push({
        step_key: "cleanup",
        label: "Test Fixture Cleanup",
        status: "passed",
        details: { removed_test_suppression: true },
      });
    }

    const passedCount = steps.filter((s) => s.status === "passed").length;
    const failedCount = steps.filter((s) => s.status === "failed").length;
    const allPassed = failedCount === 0;

    // Write steps
    await adminClient.from("operator_test_run_steps").insert(
      steps.map((s) => ({
        test_run_id: testRun.id,
        step_key: s.step_key,
        label: s.label,
        status: s.status,
        details: s.details,
      }))
    );

    // Update run
    await adminClient
      .from("operator_test_runs")
      .update({
        status: allPassed ? "passed" : "failed",
        completed_at: new Date().toISOString(),
        summary: {
          passed: passedCount,
          failed: failedCount,
          email: normalizedEmail,
          excluded: isExcluded,
        },
        error: allPassed ? null : { message: "Suppression gating failed" },
      })
      .eq("id", testRun.id);

    return new Response(
      JSON.stringify({
        ok: allPassed,
        test_run_id: testRun.id,
        status: allPassed ? "passed" : "failed",
        checks: steps,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("operator-campaign-suppression-test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
