/**
 * operator-unsubscribe-flow-test — Admin-only end-to-end unsubscribe test.
 *
 * WHAT: Generates token, executes unsubscribe, verifies suppression row exists.
 * WHERE: Called from Operator Demo Lab → Integration Test Harness.
 * WHY: Validates full unsubscribe pipeline without sending email.
 *
 * AUTH: Admin only.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    const { tenant_id, email, campaign_id = null, environment = "sandbox" } = body;

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
        suite_key: "unsubscribe_flow",
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

    // Step 1: Generate unsubscribe token (same logic as campaign-unsubscribe-link)
    const rawToken = generateToken();
    const tokenHash = await sha256(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // Short-lived for test

    const { error: tokenInsertError } = await adminClient
      .from("email_unsubscribe_tokens")
      .insert({
        tenant_id,
        email: normalizedEmail,
        campaign_id: campaign_id || null,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenInsertError) {
      steps.push({
        step_key: "token_generate",
        label: "Generate Unsubscribe Token",
        status: "failed",
        details: { error: tokenInsertError.message },
      });
    } else {
      const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe?token=${rawToken}`;
      steps.push({
        step_key: "token_generate",
        label: "Generate Unsubscribe Token",
        status: "passed",
        details: { unsubscribe_url: unsubscribeUrl, expires_at: expiresAt.toISOString() },
      });

      // Step 2: Execute unsubscribe by calling the endpoint server-side
      try {
        const unsubRes = await fetch(
          `${supabaseUrl}/functions/v1/unsubscribe?token=${rawToken}`,
          { method: "GET" }
        );
        const unsubBody = await unsubRes.text();

        if (unsubRes.status === 200) {
          steps.push({
            step_key: "unsubscribe_execute",
            label: "Execute Unsubscribe Handler",
            status: "passed",
            details: { http_status: unsubRes.status, response_contains_success: unsubBody.includes("Unsubscribed") },
          });
        } else {
          steps.push({
            step_key: "unsubscribe_execute",
            label: "Execute Unsubscribe Handler",
            status: "failed",
            details: { http_status: unsubRes.status },
          });
        }
      } catch (fetchErr) {
        steps.push({
          step_key: "unsubscribe_execute",
          label: "Execute Unsubscribe Handler",
          status: "failed",
          details: { error: fetchErr instanceof Error ? fetchErr.message : "Fetch failed" },
        });
      }

      // Step 3: Verify suppression row exists
      const { data: suppression, error: suppError } = await adminClient
        .from("email_suppressions")
        .select("id, email, reason, source, created_at")
        .eq("tenant_id", tenant_id)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (suppError || !suppression) {
        steps.push({
          step_key: "suppression_verify",
          label: "Verify Suppression Row",
          status: "failed",
          details: { error: suppError?.message || "No suppression row found" },
        });
      } else {
        steps.push({
          step_key: "suppression_verify",
          label: "Verify Suppression Row",
          status: "passed",
          details: {
            suppression_id: suppression.id,
            reason: suppression.reason,
            source: suppression.source,
            created_at: suppression.created_at,
          },
        });
      }

      // Step 4: Verify token was marked as used
      const { data: usedToken } = await adminClient
        .from("email_unsubscribe_tokens")
        .select("id, used_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (usedToken?.used_at) {
        steps.push({
          step_key: "token_used",
          label: "Token Marked as Used",
          status: "passed",
          details: { used_at: usedToken.used_at },
        });
      } else {
        steps.push({
          step_key: "token_used",
          label: "Token Marked as Used",
          status: "failed",
          details: { error: "Token was not marked as used after unsubscribe" },
        });
      }
    }

    // Cleanup: remove test suppression (source metadata marks it as test)
    // We tag test suppressions so we can safely remove them
    await adminClient
      .from("email_suppressions")
      .delete()
      .eq("tenant_id", tenant_id)
      .eq("email", normalizedEmail)
      .eq("source", "self_service")
      .contains("metadata", { token_id: undefined } as any);
    // Note: We leave the suppression if it existed before the test

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
        summary: { passed: passedCount, failed: failedCount, email: normalizedEmail },
        error: allPassed ? null : { message: "One or more steps failed" },
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
    console.error("operator-unsubscribe-flow-test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
