import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { normalizeDomain } from "../_shared/domainNormalize.ts";
import { evaluateEscalation } from "../_shared/escalation.ts";
import { emitUsageEvents, type UsageEvent } from "../_shared/usageEvents.ts";
import { triggerInsightGenerationIfDue } from "../_shared/autoInsightTrigger.ts";

// ── Response helpers ──

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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


// ── Auth helpers ──
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── Constants ──

const VALID_WORKFLOW_KEYS = [
  "partner_enrich",
  "opportunity_monitor",
  "recommendations_generate",
  "watchlist_ingest",
  "watchlist_diff",
  // Added for terminal-callback safety: these workflows callback to n8n-ingest
  "watchlist_deep_dive",
  "event_attendee_enrich",
] as const;
type WorkflowKey = (typeof VALID_WORKFLOW_KEYS)[number];

// ── Crypto helpers ──

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Payload normalization ──

export interface IngestEnvelope {
  workflow_key: string;
  run_id: string;
  payload: Record<string, unknown>;
  requested_by?: string | null;
  org_id?: string | null;
  org_name?: string | null;
  website_url?: string | null;
  opportunity_id?: string | null;
  metro_id?: string | null;
  inputs_hash?: string | null;
}

/**
 * Normalize raw ingest body into a canonical IngestEnvelope.
 * Accepts either `payload` or `result` as the data field.
 */
export function normalizeEnvelope(body: Record<string, unknown>): IngestEnvelope {
  const payload = (body.payload ?? body.result) as Record<string, unknown> | undefined;
  return {
    workflow_key: body.workflow_key as string,
    run_id: body.run_id as string,
    payload: payload ?? ({} as Record<string, unknown>),
    requested_by: (body.requested_by as string) || null,
    org_id: (body.org_id as string) || null,
    org_name: (body.org_name as string) || null,
    website_url: (body.website_url as string) || null,
    opportunity_id: (body.opportunity_id as string) || null,
    metro_id: (body.metro_id as string) || null,
    inputs_hash: (body.inputs_hash as string) || null,
  };
}

/**
 * Normalize opportunity_monitor signals from either shape:
 *   Format A: payload.result.signals[]  (original contract)
 *   Format B: payload.changes[] + payload.recommendations[]  (n8n workflow)
 * Returns a canonical signal array.
 */
export interface CanonicalSignal {
  signal_type: string;
  signal_value: string;
  source_url: string;
  confidence: number | null;
  detected_at: string;
}

export function normalizeOpportunitySignals(
  payload: Record<string, unknown>,
): CanonicalSignal[] {
  // Format A: payload.result.signals[]
  const result = payload?.result as Record<string, unknown> | undefined;
  const rawSignals = result?.signals;

  if (Array.isArray(rawSignals) && rawSignals.length > 0) {
    return (rawSignals as Record<string, unknown>[]).map((s) => ({
      signal_type: String(s.signal_type || "unknown"),
      signal_value: s.signal_value != null ? String(s.signal_value) : "",
      source_url: typeof s.source_url === "string" ? s.source_url : "",
      confidence: typeof s.confidence === "number" ? s.confidence : null,
      detected_at: typeof s.detected_at === "string" ? s.detected_at : new Date().toISOString(),
    }));
  }

  // Format B: payload.changes[] + payload.recommendations[]
  if (Array.isArray(payload?.changes)) {
    const changes = payload.changes as Record<string, unknown>[];
    const recommendations = Array.isArray(payload?.recommendations)
      ? (payload.recommendations as Record<string, unknown>[])
      : [];

    const signals: CanonicalSignal[] = [
      ...changes.map((c) => ({
        signal_type: String((c.fields_changed as string[])?.[0] || "change"),
        signal_value: String(c.summary || ""),
        source_url: "",
        confidence: 0.7 as number | null,
        detected_at: new Date().toISOString(),
      })),
      ...recommendations.map((r) => ({
        signal_type: String(r.type || "recommendation"),
        signal_value: String(r.message || ""),
        source_url: "",
        confidence: 0.6 as number | null,
        detected_at: new Date().toISOString(),
      })),
    ];

    return signals;
  }

  return [];
}

// ── Request handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "Only POST is accepted");
  }

  // ── Auth: service role OR worker secret OR shared secret ──
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const workerSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");

  if (!serviceRoleKey && !workerSecret && !sharedSecret) {
    return jsonError(500, "CONFIG_ERROR", "No auth secrets configured (service role, ENRICHMENT_WORKER_SECRET, or N8N_SHARED_SECRET)");
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const apikeyHeader = req.headers.get("apikey") ?? "";

  let token = "";
  if (/^Bearer\s+/i.test(authHeader)) {
    token = authHeader.replace(/^Bearer\s+/i, "").trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  } else if (apikeyHeader) {
    token = apikeyHeader.trim();
  }

  if (!token) {
    console.warn("n8n-ingest unauthorized: missing auth token header");
    return jsonError(401, "UNAUTHORIZED", "Missing Authorization (Bearer), X-Api-Key, or apikey header");
  }

  const authenticated =
    (workerSecret ? constantTimeCompare(token, workerSecret) : false) ||
    (serviceRoleKey ? constantTimeCompare(token, serviceRoleKey) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);

  if (!authenticated) {
    console.warn("n8n-ingest unauthorized: invalid token");
    return jsonError(401, "UNAUTHORIZED", "Invalid authentication");
  }

  // ── Parse body ──
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  // ── Normalize envelope ──
  const env = normalizeEnvelope(body);

  // ── Validate required fields ──
  if (!env.workflow_key || typeof env.workflow_key !== "string") {
    return jsonError(400, "MISSING_FIELD", "workflow_key is required (string)");
  }
  if (!VALID_WORKFLOW_KEYS.includes(env.workflow_key as WorkflowKey)) {
    return jsonError(
      400,
      "INVALID_WORKFLOW_KEY",
      `workflow_key must be one of: ${VALID_WORKFLOW_KEYS.join(", ")}`,
    );
  }
  if (!env.run_id || typeof env.run_id !== "string") {
    return jsonError(400, "MISSING_FIELD", "run_id is required (string)");
  }
  if (!env.payload || typeof env.payload !== "object" || Object.keys(env.payload).length === 0) {
    return jsonError(400, "MISSING_FIELD", "payload is required (object)");
  }

  // ── Supabase admin client ──
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const effectiveServiceKey = serviceRoleKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!effectiveServiceKey) {
    return jsonError(500, "CONFIG_ERROR", "SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  const supabase = createClient(supabaseUrl, effectiveServiceKey, {
    auth: { persistSession: false },
  });

  // ── Compute payload fingerprint ──
  const payloadStr = JSON.stringify(env.payload);
  const payloadFingerprint = await sha256(`${env.workflow_key}|${env.run_id}|${payloadStr}`);

  try {
    // ── Dedupe + replay check ──
    const { data: existingRun, error: fetchErr } = await supabase
      .from("automation_runs")
      .select("status, payload_fingerprint")
      .eq("run_id", env.run_id)
      .maybeSingle();

    if (fetchErr) throw new Error(`automation_runs fetch failed: ${fetchErr.message}`);

    if (existingRun) {
      // Already processed with same payload → dedupe
      if (existingRun.status === "processed" && existingRun.payload_fingerprint === payloadFingerprint) {
        return jsonOk({ ok: true, deduped: true, workflow_key: env.workflow_key, run_id: env.run_id });
      }
      // Already processed (different payload or no fingerprint) → replay
      if (existingRun.status === "processed") {
        return jsonOk({ ok: true, replay: true, workflow_key: env.workflow_key, run_id: env.run_id });
      }
      // Still processing with same fingerprint → dedupe (in-flight)
      if (existingRun.payload_fingerprint === payloadFingerprint && existingRun.status === "processing") {
        return jsonOk({ ok: true, deduped: true, workflow_key: env.workflow_key, run_id: env.run_id });
      }
    }

    // ── Upsert automation_runs with fingerprint ──
    const { error: runErr } = await supabase
      .from("automation_runs")
      .upsert(
        {
          run_id: env.run_id,
          workflow_key: env.workflow_key,
          status: "processing",
          requested_by: env.requested_by,
          org_id: env.org_id,
          org_name: env.org_name,
          metro_id: env.metro_id,
          inputs_hash: env.inputs_hash,
          payload: env.payload,
          payload_fingerprint: payloadFingerprint,
        },
        { onConflict: "run_id" },
      );

    if (runErr) throw new Error(`automation_runs upsert failed: ${runErr.message}`);

    let result: Record<string, unknown> = {};
    const usageEvents: UsageEvent[] = [];

    // ── Route by workflow_key ──
    if (env.workflow_key === "partner_enrich") {
      result = await handlePartnerEnrich(supabase, env);
      usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "successful_run", unit: "run" });
    } else if (env.workflow_key === "opportunity_monitor") {
      result = await handleOpportunityMonitor(supabase, env);
      const signalsInserted = (result.signals_inserted as number) || 0;
      usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "successful_run", unit: "run" });
      if (signalsInserted > 0) {
        usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "signals_emitted", quantity: signalsInserted, unit: "signal" });
      }
    } else if (env.workflow_key === "recommendations_generate") {
      result = await handleRecommendations(supabase, env);
      usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "successful_run", unit: "run" });
    } else if (env.workflow_key === "watchlist_ingest") {
      result = await handleWatchlistIngest(supabase, env);
      // Only bill if not deduped
      if (!result.deduped) {
        usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "crawl_processed", unit: "perplexity_search", quantity: 1 });
        usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "successful_run", unit: "run" });
        if (result.signal_emitted) {
          usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "signals_emitted", quantity: 1, unit: "signal" });
        }
        if (result.escalation && (result.escalation as Record<string, unknown>).should_escalate) {
          usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "llm_escalation_flagged", unit: "count" });
        }
      }
    } else if (env.workflow_key === "watchlist_diff") {
      result = await handleWatchlistDiff(supabase, env);
      if (!result.deduped) {
        usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "successful_run", unit: "run" });
        const sigsInserted = (result.signals_inserted as number) || 0;
        if (sigsInserted > 0) {
          usageEvents.push({ org_id: env.org_id, workflow_key: env.workflow_key, run_id: env.run_id, event_type: "signals_emitted", quantity: sigsInserted, unit: "signal" });
        }
      }
    }

    // ── Mark processed ──
    await supabase
      .from("automation_runs")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("run_id", env.run_id);

    // ── Propagate enrichment status back to opportunity ──
    if (env.workflow_key === "partner_enrich" && env.org_id) {
      try {
        await supabase
          .from("opportunities")
          .update({ org_enrichment_status: "completed" })
          .eq("id", env.org_id);
      } catch { /* best-effort */ }
    }

    // ── Emit usage events (best-effort, never blocks) ──
    if (usageEvents.length > 0) {
      await emitUsageEvents(supabase, usageEvents);
    }

    return jsonOk({ ok: true, workflow_key: env.workflow_key, run_id: env.run_id, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    try {
      await supabase
        .from("automation_runs")
        .update({
          status: "error",
          error_message: message.slice(0, 1000),
          processed_at: new Date().toISOString(),
        })
        .eq("run_id", env.run_id);

      // Propagate failure status to opportunity
      if (env.workflow_key === "partner_enrich" && env.org_id) {
        await supabase
          .from("opportunities")
          .update({ org_enrichment_status: "failed" })
          .eq("id", env.org_id);
      }
    } catch {
      // best-effort
    }

    return jsonError(500, "PROCESSING_ERROR", message);
  }
});

// ────────────────────────────────────────────────────────
// partner_enrich
// ────────────────────────────────────────────────────────
async function handlePartnerEnrich(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  env: IngestEnvelope,
) {
  if (!env.org_name) throw new Error("org_name is required for partner_enrich");

  const { data: extraction, error: extErr } = await supabase
    .from("org_extractions")
    .insert({
      run_id: env.run_id,
      org_name: env.org_name,
      website_url: env.website_url || null,
      raw_extraction: env.payload,
    })
    .select("id")
    .single();

  if (extErr) throw new Error(`org_extractions insert failed: ${extErr.message}`);

  const facts = env.payload;
  const { data: enrichment, error: enrErr } = await supabase
    .from("org_enrichment_facts")
    .insert({
      extraction_id: extraction.id,
      run_id: env.run_id,
      org_name: env.org_name,
      mission_summary: (facts.mission_summary as string) || null,
      programs: Array.isArray(facts.programs) ? facts.programs : [],
      populations_served: Array.isArray(facts.populations_served) ? facts.populations_served : [],
      geographies: Array.isArray(facts.geographies) ? facts.geographies : [],
      funding_signals: Array.isArray(facts.funding_signals) ? facts.funding_signals : [],
      keywords: Array.isArray(facts.keywords) ? facts.keywords : [],
    })
    .select("id")
    .single();

  if (enrErr) throw new Error(`org_enrichment_facts insert failed: ${enrErr.message}`);

  return { extraction_id: extraction.id, enrichment_id: enrichment.id };
}

// ────────────────────────────────────────────────────────
// opportunity_monitor — with fingerprint dedup
// ────────────────────────────────────────────────────────
async function handleOpportunityMonitor(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  env: IngestEnvelope,
) {
  const signals = normalizeOpportunitySignals(env.payload);

  if (signals.length === 0) {
    return { signals_inserted: 0, signals_skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (const s of signals) {
    const fingerprint = await sha256(`${s.signal_type}|${s.signal_value}|${s.source_url}`);

    const row = {
      run_id: env.run_id,
      opportunity_id: env.opportunity_id || null,
      signal_type: s.signal_type,
      signal_value: s.signal_value || null,
      confidence: s.confidence,
      source_url: s.source_url || null,
      detected_at: s.detected_at,
      signal_fingerprint: fingerprint,
    };

    const { error } = await supabase
      .from("opportunity_signals")
      .insert(row)
      .select("id");

    if (error) {
      if (error.code === "23505") {
        skipped++;
        continue;
      }
      throw new Error(`opportunity_signals insert failed: ${error.message}`);
    }
    inserted++;
  }

  return { signals_inserted: inserted, signals_skipped: skipped };
}

// ────────────────────────────────────────────────────────
// recommendations_generate
// ────────────────────────────────────────────────────────
async function handleRecommendations(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  env: IngestEnvelope,
) {
  if (!env.metro_id) throw new Error("metro_id is required for recommendations_generate");
  if (!env.inputs_hash) throw new Error("inputs_hash is required for recommendations_generate");

  const rec = env.payload;
  const { data, error } = await supabase
    .from("ai_recommendations")
    .upsert(
      {
        run_id: env.run_id,
        metro_id: env.metro_id,
        inputs_hash: env.inputs_hash,
        recommendation_type: String(rec.recommendation_type || "general"),
        title: String(rec.title || "Untitled"),
        body: typeof rec.body === "string" ? rec.body : null,
        priority: typeof rec.priority === "string" ? rec.priority : "medium",
        metadata: rec.metadata ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "metro_id,inputs_hash" },
    )
    .select("id")
    .single();

  if (error) throw new Error(`ai_recommendations upsert failed: ${error.message}`);

  return { recommendation_id: data.id };
}

// ────────────────────────────────────────────────────────
// watchlist_ingest — store crawl snapshot + optional facts
//   + auto-diff vs previous snapshot
//   + deterministic signal emission
// ────────────────────────────────────────────────────────
async function handleWatchlistIngest(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  env: IngestEnvelope,
) {
  if (!env.org_id) throw new Error("org_id is required for watchlist_ingest");

  const p = env.payload;
  const url = typeof p.url === "string" ? p.url : null;
  if (!url) throw new Error("payload.url is required for watchlist_ingest");

  const contentHash = typeof p.content_hash === "string" ? p.content_hash : null;
  if (!contentHash) throw new Error("payload.content_hash is required for watchlist_ingest");

  const rawText = typeof p.raw_text === "string" ? p.raw_text : null;
  if (!rawText) throw new Error("payload.raw_text is required for watchlist_ingest");

  const crawledAt = typeof p.crawled_at === "string" ? p.crawled_at : new Date().toISOString();

  // Insert snapshot — unique(org_id, content_hash) provides dedupe
  const { data: snapshot, error: snapErr } = await supabase
    .from("org_snapshots")
    .insert({
      org_id: env.org_id,
      run_id: env.run_id,
      url,
      crawled_at: crawledAt,
      content_hash: contentHash,
      raw_text: rawText,
      meta: typeof p.meta === "object" && p.meta !== null ? p.meta : {},
    })
    .select("id")
    .single();

  // Dedupe: if unique constraint violation, return deduped flag
  if (snapErr) {
    if (snapErr.code === "23505") {
      return { deduped: true, content_hash: contentHash };
    }
    throw new Error(`org_snapshots insert failed: ${snapErr.message}`);
  }

  const result: Record<string, unknown> = { snapshot_id: snapshot.id };

  // Optional: extract facts if present
  if (p.facts && typeof p.facts === "object") {
    const { data: factsRow, error: factsErr } = await supabase
      .from("org_snapshot_facts")
      .insert({
        org_id: env.org_id,
        snapshot_id: snapshot.id,
        run_id: env.run_id,
        facts: p.facts,
        model_version: typeof p.model_version === "string" ? p.model_version : null,
      })
      .select("id")
      .single();

    if (factsErr) throw new Error(`org_snapshot_facts insert failed: ${factsErr.message}`);
    result.facts_id = factsRow.id;
  }

  // Update last_crawled_at on watchlist
  await supabase
    .from("org_watchlist")
    .update({ last_crawled_at: new Date().toISOString() })
    .eq("org_id", env.org_id);

  // Opportunistically populate website_domain on opportunities linked to this org
  const domain = normalizeDomain(url);
  if (domain && env.org_id) {
    try {
      await supabase
        .from("opportunities")
        .update({ website_url: url, website_domain: domain })
        .is("website_domain", null)
        .eq("id", env.org_id);
    } catch { /* best-effort, org_id may not match opportunity id */ }
  }

  // ── Auto-diff vs previous snapshot ──
  const { data: prevSnapshots } = await supabase
    .from("org_snapshots")
    .select("id, content_hash, raw_text")
    .eq("org_id", env.org_id)
    .neq("id", snapshot.id)
    .order("crawled_at", { ascending: false })
    .limit(1);

  const prev = prevSnapshots?.[0] ?? null;
  const changed = prev ? prev.content_hash !== contentHash : false;
  const isBaseline = !prev;

  const diffPayload = {
    baseline: isBaseline,
    changed,
    from_content_hash: prev?.content_hash ?? null,
    to_content_hash: contentHash,
    delta: {
      added_chars: changed && prev ? Math.max(0, rawText.length - (prev.raw_text?.length ?? 0)) : 0,
      removed_chars: changed && prev ? Math.max(0, (prev.raw_text?.length ?? 0) - rawText.length) : 0,
    },
  };

  // Insert diff row (idempotent via unique to_snapshot_id)
  const { data: diffRow, error: diffErr } = await supabase
    .from("org_snapshot_diffs")
    .insert({
      org_id: env.org_id,
      from_snapshot_id: prev?.id ?? null,
      to_snapshot_id: snapshot.id,
      run_id: env.run_id,
      diff: diffPayload,
    })
    .select("id")
    .single();

  if (diffErr && diffErr.code !== "23505") {
    throw new Error(`org_snapshot_diffs insert failed: ${diffErr.message}`);
  }

  const diffId = diffRow?.id ?? null;
  result.diff_id = diffId;
  result.changed = changed;
  result.baseline = isBaseline;

  // ── Emit deterministic signal when changed ──
  const signalConfidence = 0.6;
  if (changed && diffId) {
    const orgName = env.org_name || env.org_id;
    const summary = `Website content changed for ${orgName}`;
    const fingerprint = await sha256(`watchlist_change|${env.org_id}|${snapshot.id}`);

    // Evaluate escalation (deterministic-first)
    const prevWordCount = prev?.raw_text ? prev.raw_text.split(/\s+/).length : 0;
    const currWordCount = rawText.split(/\s+/).length;
    const wordDelta = Math.abs(currWordCount - prevWordCount);

    const escalation = evaluateEscalation({
      changed,
      baseline: isBaseline,
      confidence: signalConfidence,
      wordDelta,
      rawTextLength: rawText.length,
    });

    const { error: sigErr } = await supabase
      .from("org_watchlist_signals")
      .insert({
        org_id: env.org_id,
        diff_id: diffId,
        snapshot_id: snapshot.id,
        signal_type: "watchlist_change",
        summary,
        confidence: signalConfidence,
        fingerprint,
        escalation_reason: escalation.shouldEscalate ? escalation.reason : null,
        llm_used: false, // v1: never actually call LLM, just record decision
      });

    if (sigErr && sigErr.code !== "23505") {
      throw new Error(`org_watchlist_signals insert failed: ${sigErr.message}`);
    }
    result.signal_emitted = sigErr?.code !== "23505";
    result.escalation = {
      should_escalate: escalation.shouldEscalate,
      reason: escalation.reason,
      word_delta: wordDelta,
    };

    // ── Create campaign suggestion from watchlist signal ──
    if (result.signal_emitted && signalConfidence >= 0.4) {
      try {
        await createCampaignSuggestionFromSignal(supabase, {
          org_id: env.org_id!,
          org_name: orgName,
          signal_id: snapshot.id, // use snapshot as source_id
          diff_id: diffId,
          summary,
          confidence: signalConfidence,
          created_at: new Date().toISOString(),
        });
        result.suggestion_created = true;
      } catch {
        result.suggestion_created = false; // best-effort
      }
    }

    // ── Auto-trigger insight generation (debounced, best-effort) ──
    if (result.signal_emitted) {
      try {
        const genResult = await triggerInsightGenerationIfDue(
          supabase,
          env.org_id!,
          env.run_id || "auto",
        );
        result.insight_auto_triggered = genResult.triggered;
        result.insight_trigger_reason = genResult.reason;
      } catch {
        result.insight_auto_triggered = false;
        result.insight_trigger_reason = "error";
      }
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────
// Campaign suggestion from watchlist signal (deterministic)
// ────────────────────────────────────────────────────────
async function createCampaignSuggestionFromSignal(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: {
    org_id: string;
    org_name: string;
    signal_id: string;
    diff_id: string | null;
    summary: string;
    confidence: number;
    created_at: string;
  },
) {
  // Anti-spam: skip if org has dismissed/snoozed suggestion in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recentDismissed } = await supabase
    .from("campaign_suggestions")
    .select("id, status, snoozed_until")
    .eq("org_id", params.org_id)
    .in("status", ["dismissed", "snoozed"])
    .gte("updated_at", sevenDaysAgo)
    .limit(1);

  if (recentDismissed && recentDismissed.length > 0) {
    const s = recentDismissed[0];
    if (s.status === "snoozed" && s.snoozed_until && new Date(s.snoozed_until) > new Date()) {
      return; // still snoozed
    }
    if (s.status === "dismissed") {
      return; // recently dismissed
    }
  }

  // Grouping: if open suggestion exists for this org within 48h, append item
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600000).toISOString();
  const { data: existingSuggestion } = await supabase
    .from("campaign_suggestions")
    .select("id")
    .eq("org_id", params.org_id)
    .eq("status", "open")
    .gte("created_at", fortyEightHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existingSuggestion && existingSuggestion.length > 0) {
    // Append item to existing suggestion
    await supabase.from("campaign_suggestion_items").insert({
      suggestion_id: existingSuggestion[0].id,
      signal_id: params.signal_id,
    });
    return;
  }

  // Create new suggestion
  const bodyTemplate = `<p>Hi {{first_name}},</p>
<p>I noticed {{org_name}} recently updated your website ({{signal_summary}}).</p>
<p>We're exploring partnerships in {{metro_or_region}} and thought it could be a good time to connect.</p>
<p>Would you be open to a quick call next week?</p>
<p>— {{sender_name}}</p>`;

  const reason = `${params.summary} | diff_id: ${params.diff_id || "N/A"} | detected: ${params.created_at}`;

  const { data: newSuggestion, error: sugErr } = await supabase
    .from("campaign_suggestions")
    .insert({
      org_id: params.org_id,
      source_type: "watchlist_signal",
      source_id: params.signal_id,
      suggestion_type: "website_change_outreach",
      title: "Website update detected — consider outreach",
      subject: "Quick question about your recent update",
      body_template: bodyTemplate,
      reason,
      confidence: params.confidence,
      status: "open",
    })
    .select("id")
    .single();

  // If unique violation, treat as success (idempotent)
  if (sugErr && sugErr.code !== "23505") {
    throw sugErr;
  }

  // Also insert the signal as an item
  if (newSuggestion) {
    await supabase.from("campaign_suggestion_items").insert({
      suggestion_id: newSuggestion.id,
      signal_id: params.signal_id,
    });
  }
}

// ────────────────────────────────────────────────────────
// watchlist_diff — store diff between snapshots + optional signals
//   (kept for backwards compat with external callers)
// ────────────────────────────────────────────────────────
async function handleWatchlistDiff(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  env: IngestEnvelope,
) {
  if (!env.org_id) throw new Error("org_id is required for watchlist_diff");

  const p = env.payload;
  const fromSnapshotId = typeof p.from_snapshot_id === "string" ? p.from_snapshot_id : null;
  const toSnapshotId = typeof p.to_snapshot_id === "string" ? p.to_snapshot_id : null;
  if (!toSnapshotId) {
    throw new Error("payload.to_snapshot_id is required for watchlist_diff");
  }

  const diff = typeof p.diff === "object" && p.diff !== null ? p.diff : {};

  const { data: diffRow, error: diffErr } = await supabase
    .from("org_snapshot_diffs")
    .insert({
      org_id: env.org_id,
      from_snapshot_id: fromSnapshotId,
      to_snapshot_id: toSnapshotId,
      run_id: env.run_id,
      diff,
    })
    .select("id")
    .single();

  if (diffErr) {
    if (diffErr.code === "23505") {
      return { deduped: true, to_snapshot_id: toSnapshotId };
    }
    throw new Error(`org_snapshot_diffs insert failed: ${diffErr.message}`);
  }

  const result: Record<string, unknown> = { diff_id: diffRow.id };

  // Optional: write derived signals to org_watchlist_signals
  if (Array.isArray(p.signals) && p.signals.length > 0) {
    let signalsInserted = 0;
    for (const s of p.signals as Record<string, unknown>[]) {
      const signalType = String(s.signal_type || "watchlist_change");
      const signalValue = String(s.signal_value || "");
      const sourceUrl = typeof s.source_url === "string" ? s.source_url : "";
      const fingerprint = await sha256(`${signalType}|${signalValue}|${sourceUrl}`);

      const { error } = await supabase
        .from("org_watchlist_signals")
        .insert({
          org_id: env.org_id,
          diff_id: diffRow.id,
          snapshot_id: toSnapshotId,
          signal_type: signalType,
          summary: signalValue || "Watchlist change detected",
          confidence: typeof s.confidence === "number" ? s.confidence : 0.6,
          fingerprint,
        });

      if (error) {
        if (error.code === "23505") continue; // dedup
        throw new Error(`org_watchlist_signals insert failed: ${error.message}`);
      }
      signalsInserted++;
    }
    result.signals_inserted = signalsInserted;

    // ── Auto-trigger insight generation (debounced, best-effort) ──
    if (signalsInserted > 0 && env.org_id) {
      try {
        const genResult = await triggerInsightGenerationIfDue(
          supabase,
          env.org_id,
          env.run_id || "auto",
        );
        result.insight_auto_triggered = genResult.triggered;
      } catch {
        result.insight_auto_triggered = false;
      }
    }
  }

  return result;
}
