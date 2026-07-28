/**
 * discovery-cron — Unified internal scheduler replacing 3 n8n cron workflows.
 *
 * WHAT: Single edge function that handles all scheduled jobs via { "job": "..." }.
 * WHERE: supabase/functions/discovery-cron/index.ts
 * WHY: Eliminates n8n dependency for pure scheduler workflows (momentum-nightly,
 *      cron-daily-intelligence-feed, phase25-cron-nba-moments-health).
 *
 * Jobs:
 *   "daily"        — notifications_daily_soon + discovery_schedule_daily
 *   "weekly"       — discovery_schedule_weekly + notifications_weekly_digest
 *   "momentum"     — momentum-recalculate (batch) + momentum-alerts-evaluate
 *   "intelligence"  — generate-daily-intelligence-feed + recalculate-prospect-priority
 *   "hourly"       — generate-next-best-actions + detect-priority-moments + monitor-automation-health
 *
 * Schedule via pg_cron:
 *   Daily   07:00 UTC → { "job": "daily" }
 *   Daily   03:00 UTC → { "job": "momentum" }
 *   Daily   07:30 UTC → { "job": "intelligence" }
 *   Hourly  :00       → { "job": "hourly" }
 *   Weekly  Mon 06:00 → { "job": "weekly" }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonOk(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function authenticateServiceRequest(req: Request): boolean {
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const scheduleSecret = Deno.env.get("N8N_SCHEDULE_SECRET");

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";

  if (authHeader.startsWith("Bearer ") && serviceRoleKey) {
    if (authHeader.slice(7).trim() === serviceRoleKey) return true;
  }

  let token = "";
  if (apiKeyHeader) token = apiKeyHeader.trim();
  else if (authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();

  if (!token) return false;

  if (enrichmentSecret && constantTimeCompare(token, enrichmentSecret)) return true;
  if (sharedSecret && constantTimeCompare(token, sharedSecret)) return true;
  if (scheduleSecret && constantTimeCompare(token, scheduleSecret)) return true;

  return false;
}

type StepResult = { step: string; ok: boolean; data?: Record<string, unknown>; error?: string };

async function callFunction(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Job Runners ───

async function runDaily(supabaseUrl: string, serviceKey: string): Promise<StepResult[]> {
  const results: StepResult[] = [];

  const notifResult = await callFunction(supabaseUrl, serviceKey, "notifications-generate", {
    mode: "daily_soon",
  });
  results.push({ step: "notifications_daily_soon", ...notifResult });

  const schedResult = await callFunction(supabaseUrl, serviceKey, "discovery-schedule", {
    mode: "daily",
  });
  results.push({ step: "discovery_schedule_daily", ...schedResult });

  return results;
}

async function runWeekly(supabaseUrl: string, serviceKey: string): Promise<StepResult[]> {
  const results: StepResult[] = [];

  const schedResult = await callFunction(supabaseUrl, serviceKey, "discovery-schedule", {
    mode: "weekly",
  });
  results.push({ step: "discovery_schedule_weekly", ...schedResult });

  const digestResult = await callFunction(supabaseUrl, serviceKey, "notifications-generate", {
    mode: "weekly_digest",
  });
  results.push({ step: "notifications_weekly_digest", ...digestResult });

  return results;
}

async function runMomentum(supabaseUrl: string, serviceKey: string): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // Step 1: Batch recompute momentum scores
  const recomputeResult = await callFunction(supabaseUrl, serviceKey, "momentum-recalculate", {
    mode: "batch",
  });
  results.push({ step: "momentum_recompute_batch", ...recomputeResult });

  // Step 2: Evaluate alerts based on new scores
  const alertsResult = await callFunction(supabaseUrl, serviceKey, "momentum-alerts-evaluate", {
    force: false,
  });
  results.push({ step: "momentum_alerts_evaluate", ...alertsResult });

  return results;
}

async function runIntelligence(supabaseUrl: string, serviceKey: string): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // Step 1: Generate daily intelligence feed
  const feedResult = await callFunction(supabaseUrl, serviceKey, "generate-daily-intelligence-feed", {});
  results.push({ step: "generate_intelligence_feed", ...feedResult });

  // Step 2: Recalculate prospect priority
  const priorityResult = await callFunction(supabaseUrl, serviceKey, "recalculate-prospect-priority", {});
  results.push({ step: "recalculate_prospect_priority", ...priorityResult });

  return results;
}

async function runHourly(supabaseUrl: string, serviceKey: string): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // Steps 1 & 2 run in parallel (mirroring the n8n fan-out)
  const [nbaResult, momentsResult] = await Promise.all([
    callFunction(supabaseUrl, serviceKey, "generate-next-best-actions", {}),
    callFunction(supabaseUrl, serviceKey, "detect-priority-moments", {}),
  ]);
  results.push({ step: "generate_next_best_actions", ...nbaResult });
  results.push({ step: "detect_priority_moments", ...momentsResult });

  // Step 3: Health monitor runs after NBA + moments complete
  const healthResult = await callFunction(supabaseUrl, serviceKey, "monitor-automation-health", {});
  results.push({ step: "monitor_automation_health", ...healthResult });

  return results;
}

// ─── Valid job types ───
const VALID_JOBS = ["daily", "weekly", "momentum", "intelligence", "hourly"] as const;
type JobType = typeof VALID_JOBS[number];

const JOB_RUNNERS: Record<JobType, (url: string, key: string) => Promise<StepResult[]>> = {
  daily: runDaily,
  weekly: runWeekly,
  momentum: runMomentum,
  intelligence: runIntelligence,
  hourly: runHourly,
};

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  if (!authenticateServiceRequest(req)) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or missing authentication");
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = { job: "daily" };
  }

  const jobRaw = String(body.job || "daily");
  const job = VALID_JOBS.includes(jobRaw as JobType) ? (jobRaw as JobType) : null;

  if (!job) {
    return jsonError(400, "INVALID_JOB", `Valid jobs: ${VALID_JOBS.join(", ")}. Got: "${jobRaw}"`);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const results = await JOB_RUNNERS[job](supabaseUrl, serviceKey);

  const successCount = results.filter(r => r.ok).length;
  console.log(`[discovery-cron] job=${job}: ${successCount}/${results.length} steps succeeded`);

  return jsonOk({
    ok: true,
    job,
    steps: results,
  });
});
