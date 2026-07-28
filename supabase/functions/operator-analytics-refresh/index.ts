import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getSentryErrorCount } from "../_shared/sentryCounts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().slice(0, 10);
    const rollups: Array<{ day: string; metric_key: string; metric_value: number; metadata: Record<string, unknown> }> = [];

    // Active tenants
    const { count: tenantCount } = await supabase
      .from("tenants")
      .select("*", { count: "exact", head: true });
    rollups.push({ day: today, metric_key: "active_tenants", metric_value: tenantCount ?? 0, metadata: {} });

    // QA pass/fail from qa_test_run_steps
    const { data: qaResults } = await supabase
      .from("qa_test_run_steps")
      .select("status")
      .gte("started_at", new Date(Date.now() - 86400000).toISOString());
    const qaTotal = qaResults?.length ?? 0;
    const qaPassed = qaResults?.filter((r: any) => r.status === "passed").length ?? 0;
    rollups.push({ day: today, metric_key: "qa_total", metric_value: qaTotal, metadata: {} });
    rollups.push({ day: today, metric_key: "qa_passed", metric_value: qaPassed, metadata: {} });

    // Error events — now sourced from Sentry (system_error_events retired)
    const errorCount = await getSentryErrorCount({ sinceHoursAgo: 24 });
    rollups.push({ day: today, metric_key: "error_events", metric_value: errorCount, metadata: {} });

    // Automation errors
    const { count: autoErrors } = await supabase
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .eq("status", "error")
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());
    rollups.push({ day: today, metric_key: "automation_errors", metric_value: autoErrors ?? 0, metadata: {} });

    // Friction signals
    const { count: frictionCount } = await supabase
      .from("friction_events" as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());
    rollups.push({ day: today, metric_key: "friction_signals", metric_value: frictionCount ?? 0, metadata: {} });

    // Funnel metrics from app_event_stream (non-error only)
    const funnelSteps = [
      { key: 'funnel_visits', event: 'page_view' },
      { key: 'funnel_pricing', event: 'pricing_view' },
      { key: 'funnel_checkout', event: 'checkout_started' },
      { key: 'funnel_onboarding', event: 'onboarding_started' },
      { key: 'funnel_activated', event: 'tenant_activated' },
    ];

    for (const step of funnelSteps) {
      const { count: stepCount } = await supabase
        .from("app_event_stream")
        .select("*", { count: "exact", head: true })
        .eq("event_name", step.event)
        .eq("is_error", false)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());
      rollups.push({ day: today, metric_key: step.key, metric_value: stepCount ?? 0, metadata: {} });
    }

    // Module adoption — count distinct tenants with recent activity per module
    const moduleEvents: Record<string, string> = {
      adoption_signum: 'signum_',
      adoption_civitas: 'civitas_',
      adoption_testimonium: 'testimonium_',
      adoption_impulsus: 'impulsus_',
      adoption_communio: 'communio_',
      adoption_relatio: 'relatio_',
      adoption_voluntarium: 'voluntarium_',
      adoption_provisio: 'provisio_',
    };

    for (const [metricKey, eventPrefix] of Object.entries(moduleEvents)) {
      const { data: moduleData } = await supabase
        .from("app_event_stream")
        .select("tenant_id")
        .eq("is_error", false)
        .like("event_name", `${eventPrefix}%`)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .limit(500);
      const uniqueTenants = new Set((moduleData || []).map((r: any) => r.tenant_id).filter(Boolean));
      rollups.push({ day: today, metric_key: metricKey, metric_value: uniqueTenants.size, metadata: {} });
    }

    // Upsert rollups
    for (const r of rollups) {
      await supabase
        .from("operator_analytics_rollups")
        .upsert(r, { onConflict: "day,metric_key" });
    }

    return new Response(
      JSON.stringify({ ok: true, metrics_written: rollups.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
