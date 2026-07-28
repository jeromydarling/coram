import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { emitUsageEvent } from "../_shared/usageEvents.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  const correlationId = crypto.randomUUID().slice(0, 8);

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Missing auth token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonError(401, "UNAUTHORIZED", "Invalid token");
  }

  const userId = claimsData.claims.sub as string;

  // ── Parse body ──
  let body: { action_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  if (!body.action_id || typeof body.action_id !== "string") {
    return jsonError(400, "MISSING_FIELD", "action_id is required");
  }

  const actionId = body.action_id;
  console.log(`[${correlationId}] execute-org-action: ${actionId}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── Load action ──
    const { data: action, error: actionErr } = await supabase
      .from("org_recommended_actions")
      .select("*")
      .eq("id", actionId)
      .maybeSingle();

    if (actionErr) throw new Error(`action fetch: ${actionErr.message}`);
    if (!action) return jsonError(404, "NOT_FOUND", "Action not found");

    // ── Idempotency: already completed/dismissed ──
    if (action.status !== "open") {
      return jsonOk({
        ok: true,
        already_executed: true,
        status: action.status,
      });
    }

    // ── Load insight + org ──
    const { data: insight } = await supabase
      .from("org_insights")
      .select("id, org_id, insight_type, title")
      .eq("id", action.insight_id)
      .maybeSingle();

    if (!insight) return jsonError(404, "NOT_FOUND", "Parent insight not found");

    const orgId = action.org_id;
    const actionType = action.action_type;
    const ctaContext = (action.cta_context || {}) as Record<string, unknown>;

    let result: Record<string, unknown> = {};

    // ── Switch on action_type ──
    switch (actionType) {
      case "create_outreach_draft":
      case "create_draft_campaign": {
        // Check if already created (idempotency via cta_context.result_id)
        if (ctaContext.result_id) {
          result = { navigate_to: `/campaigns`, campaign_id: ctaContext.result_id };
          break;
        }

        // Load org for campaign name
        const { data: org } = await supabase
          .from("opportunities")
          .select("id, organization")
          .eq("id", orgId)
          .maybeSingle();

        const orgName = org?.organization || "Organization";

        // Load contacts for audience (max 5)
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, name, email")
          .eq("opportunity_id", orgId)
          .not("email", "is", null)
          .limit(5);

        // Create draft campaign
        const { data: campaign, error: campErr } = await supabase
          .from("email_campaigns")
          .insert({
            name: `Outreach: ${orgName} — ${insight.title}`,
            subject: `Partnership Opportunity — ${orgName}`,
            status: "draft",
            created_by: userId,
            audience_count: (contacts || []).length,
            sent_count: 0,
            failed_count: 0,
          })
          .select("id")
          .single();

        if (campErr) throw new Error(`campaign create: ${campErr.message}`);

        // Add audience if contacts exist
        if (contacts && contacts.length > 0 && campaign) {
          const audienceRows = contacts
            .filter((c: { email: string | null }) => c.email)
            .map((c: { id: string; name: string; email: string }) => ({
              campaign_id: campaign.id,
              contact_id: c.id,
              email: c.email,
              name: c.name,
              source: "insight_action",
              status: "pending",
            }));

          if (audienceRows.length > 0) {
            await supabase.from("email_campaign_audience").insert(audienceRows);
          }
        }

        // Store result_id for idempotency
        await supabase
          .from("org_recommended_actions")
          .update({
            cta_context: { ...ctaContext, result_id: campaign.id },
          })
          .eq("id", actionId);

        result = { navigate_to: `/campaigns`, campaign_id: campaign.id };
        break;
      }

      case "create_task": {
        // Check idempotency
        if (ctaContext.result_id) {
          result = { task_id: ctaContext.result_id };
          break;
        }

        const { data: task, error: taskErr } = await supabase
          .from("org_tasks")
          .insert({
            org_id: orgId,
            title: action.title,
            description: action.description,
            created_by: userId,
            source: { action_id: actionId, insight_id: action.insight_id },
          })
          .select("id")
          .single();

        if (taskErr) throw new Error(`task create: ${taskErr.message}`);

        // Store result_id
        await supabase
          .from("org_recommended_actions")
          .update({
            cta_context: { ...ctaContext, result_id: task.id },
          })
          .eq("id", actionId);

        result = { task_id: task.id };
        break;
      }

      case "review_recent_changes":
      case "open_org_profile":
      case "verify_operations":
      case "find_local_partners":
      case "tailor_pitch": {
        // Navigation-only actions: return route to navigate to
        const section = actionType === "verify_operations" ? "watchlist" :
          actionType === "review_recent_changes" ? "watchlist" :
          actionType === "find_local_partners" ? "contacts" :
          actionType === "tailor_pitch" ? "insights" : "overview";

        result = { navigate_to: `/organizations/${orgId}`, highlight: section };
        break;
      }

      case "adjust_expectations": {
        result = { navigate_to: `/pipeline`, org_id: orgId };
        break;
      }

      default: {
        // Unknown action type — just mark completed, no side effect
        result = { note: `Unknown action_type: ${actionType}` };
        break;
      }
    }

    // ── Mark action completed ──
    await supabase
      .from("org_recommended_actions")
      .update({ status: "completed" })
      .eq("id", actionId);

    // ── Record feedback ──
    await supabase.from("org_action_feedback").insert({
      org_id: orgId,
      action_type: actionType,
      outcome: "completed",
    });

    // ── Usage metering ──
    await emitUsageEvent(supabase, {
      workflow_key: "org_insights",
      run_id: correlationId,
      event_type: "org_action_executed",
      quantity: 1,
      unit: "count",
    });

    console.log(`[${correlationId}] action ${actionId} executed: ${actionType}`);

    return jsonOk({ ok: true, action_type: actionType, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${correlationId}] error: ${message}`);
    return jsonError(500, "PROCESSING_ERROR", message);
  }
});
