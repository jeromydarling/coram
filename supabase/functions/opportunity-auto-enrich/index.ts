import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, error: code, message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AutoEnrichBody {
  opportunity_id: string;
  source_url?: string;
  idempotency_key?: string;
}

export function validateBody(body: unknown): { valid: true; data: AutoEnrichBody } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") return { valid: false, errors: ["Body must be a JSON object"] };

  const b = body as Record<string, unknown>;

  if (typeof b.opportunity_id !== "string" || !UUID_RE.test(b.opportunity_id)) {
    errors.push("opportunity_id: required valid UUID");
  }

  if (b.source_url !== undefined && b.source_url !== null) {
    if (typeof b.source_url !== "string") {
      errors.push("source_url: must be a string if provided");
    } else if (b.source_url.trim() && !/^https?:\/\/.+/i.test(b.source_url.trim())) {
      errors.push("source_url: must be a valid http(s) URL");
    }
  }

  if (b.idempotency_key !== undefined && b.idempotency_key !== null) {
    if (typeof b.idempotency_key !== "string") {
      errors.push("idempotency_key: must be a string if provided");
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: b as unknown as AutoEnrichBody };
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("METHOD_NOT_ALLOWED", "Only POST is accepted", 405);
  }

  // ── Auth: user JWT or service-role key ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonError("CONFIG_ERROR", "Server misconfigured", 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonError("UNAUTHORIZED", "Missing Authorization header", 401);
  }

  const token = authHeader.replace("Bearer ", "").trim();

  // ── Resolve userId: try JWT claims first, fall back to service-role admin lookup ──
  let userId: string | null = null;
  let isServiceRole = false;

  const supabaseForClaims = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: claimsData, error: claimsError } = await supabaseForClaims.auth.getClaims(token);

  if (!claimsError && claimsData?.claims?.sub) {
    userId = claimsData.claims.sub as string;
  } else if (token === serviceRoleKey) {
    // Service-role caller (e.g., profunda-ai) — resolve an admin user
    isServiceRole = true;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    userId = adminRole?.user_id ?? null;
  }

  if (!userId) {
    return jsonError("UNAUTHORIZED", "Invalid or expired token", 401);
  }

  // ── Parse + validate body ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be valid JSON", 400);
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return jsonError("INVALID_PAYLOAD", validation.errors.join("; "), 400);
  }

  const { opportunity_id, source_url, idempotency_key } = validation.data;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    // ── Idempotency check ──
    if (idempotency_key) {
      const { data: existingRun } = await supabaseAdmin
        .from("automation_runs")
        .select("run_id, status")
        .eq("payload_fingerprint", idempotency_key)
        .eq("workflow_key", "opportunity_enrich_chain")
        .maybeSingle();

      if (existingRun) {
        return jsonResponse({
          ok: true,
          duplicate: true,
          run_id: existingRun.run_id,
          status: existingRun.status,
        });
      }
    }

    // ── Verify opportunity exists and user has access ──
    const { data: opp, error: oppErr } = await supabaseAdmin
      .from("opportunities")
      .select("id, organization, website_url, metro_id, org_knowledge_status, org_enrichment_status")
      .eq("id", opportunity_id)
      .maybeSingle();

    if (oppErr || !opp) {
      return jsonError("NOT_FOUND", "Opportunity not found", 404);
    }

    // Determine the URL to use
    const effectiveUrl = source_url?.trim() || opp.website_url || null;

    // ── Clean up stuck partner_enrich runs from previous attempts ──
    // If partner_enrich is still "running" or "dispatched" from a previous run, auto-fail it
    const { data: stuckRuns } = await supabaseAdmin
      .from("automation_runs")
      .select("run_id")
      .eq("org_id", opportunity_id)
      .eq("workflow_key", "partner_enrich")
      .in("status", ["running", "dispatched", "processing"])
      .lt("created_at", new Date(Date.now() - 90_000).toISOString()); // older than 90s

    if (stuckRuns && stuckRuns.length > 0) {
      const stuckIds = stuckRuns.map(r => r.run_id);
      console.log(`[auto-enrich] Auto-failing ${stuckIds.length} stuck partner_enrich runs: ${stuckIds.join(", ")}`);
      await supabaseAdmin
        .from("automation_runs")
        .update({
          status: "failed_timeout",
          error_message: "Auto-failed: no callback received within 90 seconds",
          processed_at: new Date().toISOString(),
        })
        .eq("org_id", opportunity_id)
        .eq("workflow_key", "partner_enrich")
        .in("status", ["running", "dispatched", "processing"])
        .lt("created_at", new Date(Date.now() - 90_000).toISOString());
    }

    // ── Mint run_id ──
    const runId = crypto.randomUUID();

    // ── Update opportunity statuses to queued ──
    const statusUpdate: Record<string, unknown> = {
      org_knowledge_status: "queued",
      org_enrichment_status: "queued",
      enrichment_run_id: runId,
    };

    // Update source_url if provided and different
    if (source_url?.trim() && source_url.trim() !== opp.website_url) {
      statusUpdate.website_url = source_url.trim();
    }

    // Only set neighborhood_status to queued if we have a URL
    if (effectiveUrl) {
      statusUpdate.neighborhood_status = "queued";
    }

    await supabaseAdmin
      .from("opportunities")
      .update(statusUpdate)
      .eq("id", opportunity_id);

    // ── Record automation run ──
    const { error: insertErr } = await supabaseAdmin.from("automation_runs").insert({
      run_id: runId,
      workflow_key: "opportunity_enrich_chain",
      status: "queued",
      triggered_by: userId,
      org_id: opportunity_id,
      org_name: opp.organization,
      metro_id: opp.metro_id || null,
      payload_fingerprint: idempotency_key || null,
      scope_json: {
        opportunity_id,
        source_url: effectiveUrl,
        org_name: opp.organization,
        steps: ["org_knowledge", "neighborhood", "partner_enrich"],
      },
    });

    if (insertErr) {
      return jsonError("INSERT_FAILED", `Could not create automation run: ${insertErr.message}`, 500);
    }

    // ── Step 1: Org Knowledge Bootstrap (best-effort, non-blocking) ──
    // Call org-knowledge-refresh internally if we have a URL
    if (effectiveUrl) {
      try {
        await supabaseAdmin
          .from("opportunities")
          .update({ org_knowledge_status: "processing" })
          .eq("id", opportunity_id);

        const refreshResp = await fetch(`${supabaseUrl}/functions/v1/org-knowledge-refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            org_id: opportunity_id,
            source_url: effectiveUrl,
          }),
          signal: AbortSignal.timeout(55000), // 55s timeout
        });

        if (refreshResp.ok) {
          await supabaseAdmin
            .from("opportunities")
            .update({ org_knowledge_status: "completed" })
            .eq("id", opportunity_id);
        } else {
          const errText = await refreshResp.text();
          console.error("Org knowledge refresh failed:", errText);
          await supabaseAdmin
            .from("opportunities")
            .update({ org_knowledge_status: "failed" })
            .eq("id", opportunity_id);
        }
      } catch (err) {
        console.error("Org knowledge refresh error:", err);
        await supabaseAdmin
          .from("opportunities")
          .update({ org_knowledge_status: "failed" })
          .eq("id", opportunity_id);
      }

      // ── Step 1.5: Backfill from org knowledge into opportunity fields ──
      try {
        await fetch(`${supabaseUrl}/functions/v1/enrich-from-knowledge`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ org_id: opportunity_id }),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        // best-effort
      }

      // ── Step 2: Neighborhood Insights (best-effort, with data-readiness polling) ──
      try {
        await supabaseAdmin
          .from("opportunities")
          .update({ neighborhood_status: "processing" })
          .eq("id", opportunity_id);

        // Poll for HQ address data readiness (enrich-from-knowledge may still be writing)
        const MAX_POLLS = 4;
        const POLL_INTERVAL_MS = 1500;
        let addressReady = false;

        for (let attempt = 1; attempt <= MAX_POLLS; attempt++) {
          console.log(`[auto-enrich] Neighborhood address poll ${attempt}/${MAX_POLLS} for org ${opportunity_id}`);

          const { data: knowledgeRow } = await supabaseAdmin
            .from("org_knowledge_snapshots")
            .select("structured_json")
            .eq("org_id", opportunity_id)
            .eq("active", true)
            .eq("is_authoritative", true)
            .maybeSingle();

          const hq = (knowledgeRow?.structured_json as Record<string, unknown>)?.headquarters as Record<string, unknown> | undefined;
          if (hq && (hq.city || hq.state || hq.zip || hq.address_line1)) {
            console.log(`[auto-enrich] HQ address found on poll ${attempt}`);
            addressReady = true;
            break;
          }

          // Also check the opportunity row itself for address fields
          const { data: oppRow } = await supabaseAdmin
            .from("opportunities")
            .select("city, state")
            .eq("id", opportunity_id)
            .maybeSingle();

          if (oppRow && (oppRow.city || oppRow.state)) {
            console.log(`[auto-enrich] Opportunity address found on poll ${attempt}`);
            addressReady = true;
            break;
          }

          if (attempt < MAX_POLLS) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          }
        }

        if (!addressReady) {
          console.log(`[auto-enrich] No address found after ${MAX_POLLS} polls — skipping neighborhood insights`);
          await supabaseAdmin
            .from("opportunities")
            .update({ neighborhood_status: "skipped" })
            .eq("id", opportunity_id);
        } else {
          const neighborhoodResp = await fetch(`${supabaseUrl}/functions/v1/neighborhood-insights`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({ org_id: opportunity_id }),
            signal: AbortSignal.timeout(55000),
          });

          if (neighborhoodResp.ok) {
            await supabaseAdmin
              .from("opportunities")
              .update({ neighborhood_status: "completed" })
              .eq("id", opportunity_id);
          } else {
            await neighborhoodResp.text();
            await supabaseAdmin
              .from("opportunities")
              .update({ neighborhood_status: "failed" })
              .eq("id", opportunity_id);
          }
        }
      } catch {
        await supabaseAdmin
          .from("opportunities")
          .update({ neighborhood_status: "failed" })
          .eq("id", opportunity_id);
      }
    }

    // ── Step 3: Dispatch partner_enrich via n8n-dispatch ──
    try {
      await supabaseAdmin
        .from("opportunities")
        .update({ org_enrichment_status: "processing" })
        .eq("id", opportunity_id);

      const dispatchResp = await fetch(`${supabaseUrl}/functions/v1/n8n-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader, // forward user JWT for RBAC
        },
        body: JSON.stringify({
          workflow_key: "partner_enrich",
          org_id: opportunity_id,
          org_name: opp.organization,
          website_url: effectiveUrl,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (dispatchResp.ok) {
        const dispatchResult = await dispatchResp.json();
        // Update the enrichment_run_id with the actual n8n run_id if different
        if (dispatchResult?.run_id) {
          await supabaseAdmin
            .from("opportunities")
            .update({
              org_enrichment_status: "processing",
              enrichment_run_id: dispatchResult.run_id,
            })
            .eq("id", opportunity_id);
        }
      } else {
        const errText = await dispatchResp.text();
        console.error("Partner enrich dispatch failed:", errText);
        await supabaseAdmin
          .from("opportunities")
          .update({ org_enrichment_status: "failed" })
          .eq("id", opportunity_id);
      }
    } catch (err) {
      console.error("Partner enrich dispatch error:", err);
      await supabaseAdmin
        .from("opportunities")
        .update({ org_enrichment_status: "failed" })
        .eq("id", opportunity_id);
    }

    // ── Mark automation run as completed ──
    await supabaseAdmin
      .from("automation_runs")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("run_id", runId);

    // ── Step 4: Dispatch Prospect Pack generation (best-effort) ──
    console.log(`[auto-enrich][step4] Starting prospect pack dispatch for ${opportunity_id}`);
    try {
      const { data: orgKnowledge, error: okErr } = await supabaseAdmin
        .from("org_knowledge_snapshots")
        .select("raw_excerpt, structured_json")
        .eq("org_id", opportunity_id)
        .eq("is_authoritative", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log(`[auto-enrich][step4] org_knowledge query: found=${!!orgKnowledge}, error=${okErr?.message || 'none'}, has_excerpt=${!!orgKnowledge?.raw_excerpt}, has_json=${!!orgKnowledge?.structured_json}`);

      const orgKnowledgeText = orgKnowledge?.raw_excerpt
        || (orgKnowledge?.structured_json ? JSON.stringify(orgKnowledge.structured_json) : null);

      if (!orgKnowledgeText) {
        console.log(`[auto-enrich][step4] SKIP: no org knowledge text for ${opportunity_id}`);
      } else {
        const packRunId = crypto.randomUUID();
        console.log(`[auto-enrich][step4] org knowledge found (${orgKnowledgeText.length} chars), packRunId=${packRunId}`);

        // Insert automation_runs entry so the timeline UI can track status
        await supabaseAdmin.from("automation_runs").insert({
          run_id: packRunId,
          workflow_key: "prospect_pack",
          status: "dispatched",
          org_id: opportunity_id,
          org_name: opp.organization,
          metro_id: opp.metro_id,
          requested_by: userId,
        });

        const { data: neighborhoodData } = await supabaseAdmin
          .from("org_neighborhood_insights")
          .select("insights_json")
          .eq("org_id", opportunity_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log(`[auto-enrich][step4] neighborhood data: found=${!!neighborhoodData}`);

        const n8nBaseUrl = (Deno.env.get("N8N_WEBHOOK_BASE_URL") || "").replace(/\/+$/, "");
        const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") || Deno.env.get("N8N_SHARED_SECRET");

        console.log(`[auto-enrich][step4] n8nBaseUrl=${n8nBaseUrl ? 'SET' : 'MISSING'}, secret=${enrichmentSecret ? 'SET' : 'MISSING'}`);

        if (n8nBaseUrl && enrichmentSecret) {
          const targetUrl = `${n8nBaseUrl}/webhook/prospect-pack-generate`;
          const payload = {
            run_id: packRunId,
            entity_id: opportunity_id,
            entity_type: "opportunity",
            org_name: opp.organization,
            website_url: effectiveUrl,
            org_knowledge: orgKnowledgeText,
            neighborhood_insights: neighborhoodData?.insights_json
              ? JSON.stringify(neighborhoodData.insights_json)
              : "",
            callback_url: `${supabaseUrl}/functions/v1/prospect-pack-callback`,
            callback_secret: enrichmentSecret,
          };
          console.log(`[auto-enrich][step4] POSTing to ${targetUrl}, payload keys: ${Object.keys(payload).join(',')}`);

          const ppResp = await fetch(targetUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000),
          });

          console.log(`[auto-enrich][step4] n8n response: status=${ppResp.status}, ok=${ppResp.ok}`);
          if (!ppResp.ok) {
            const errBody = await ppResp.text();
            console.error(`[auto-enrich][step4] n8n error body: ${errBody.substring(0, 500)}`);
          }
        } else {
          console.warn(`[auto-enrich][step4] SKIP: missing N8N_WEBHOOK_BASE_URL or secret`);
        }
      }
    } catch (err) {
      console.error(`[auto-enrich][step4] Prospect pack dispatch error:`, err);
    }

    // ── Step 5: Dispatch Contact Enrichment (best-effort, non-blocking) ──
    console.log(`[auto-enrich][step5] Starting contact enrichment for ${opportunity_id}`);
    try {
      if (effectiveUrl) {
        const contactRunId = crypto.randomUUID();
        const contactEnrichUrl = `${supabaseUrl}/functions/v1/contact-enrich`;
        const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") || "";

        const ceResp = await fetch(contactEnrichUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": enrichmentSecret,
          },
          body: JSON.stringify({
            opportunity_id,
            website_url: effectiveUrl,
            run_id: contactRunId,
          }),
          signal: AbortSignal.timeout(120000), // 2 min - scraping takes time
        });

        console.log(`[auto-enrich][step5] contact-enrich response: status=${ceResp.status}`);
        if (!ceResp.ok) {
          const errBody = await ceResp.text();
          console.error(`[auto-enrich][step5] contact-enrich error: ${errBody.substring(0, 500)}`);
        }
      } else {
        console.log(`[auto-enrich][step5] SKIP: no URL for contact enrichment`);
      }
    } catch (err) {
      console.error(`[auto-enrich][step5] Contact enrich error (non-fatal):`, err);
    }

    // ── Update last_enriched_at ──
    await supabaseAdmin
      .from("opportunities")
      .update({ last_enriched_at: new Date().toISOString() })
      .eq("id", opportunity_id);

    // Determine prospect pack status for response
    const { data: finalOrgKnowledge } = await supabaseAdmin
      .from("org_knowledge_snapshots")
      .select("id")
      .eq("org_id", opportunity_id)
      .eq("is_authoritative", true)
      .limit(1)
      .maybeSingle();

    const prospectPackStatus = !effectiveUrl
      ? "skipped_no_url"
      : !finalOrgKnowledge
        ? "skipped_no_org_knowledge"
        : "triggered";

    return jsonResponse({
      ok: true,
      run_id: runId,
      opportunity_id,
      steps: {
        org_knowledge: effectiveUrl ? "triggered" : "skipped_no_url",
        neighborhood: effectiveUrl ? "triggered" : "skipped_no_url",
        partner_enrich: "triggered",
        contact_enrich: effectiveUrl ? "triggered" : "skipped_no_url",
        prospect_pack: prospectPackStatus,
      },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonError("INTERNAL_ERROR", "Internal error", 503);
  }
}

Deno.serve(handleRequest);
