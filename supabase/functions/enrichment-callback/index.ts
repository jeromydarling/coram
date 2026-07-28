import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = ["success", "error", "no_data"] as const;
const VALID_ENTITY_TYPES = ["event", "opportunity", "grant"] as const;

export interface CallbackEnvelope {
  run_id: string;
  workflow: string;
  status: string;
  entity_type: string;
  entity_id: string;
  source_url: string;
  scrape: { ok: boolean; bytes: number };
  enrichment: Record<string, unknown>;
  error: { code: string; message: string } | null;
  occurred_at: string;
}

export function validateEnvelope(body: unknown): { valid: true; data: CallbackEnvelope } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") return { valid: false, errors: ["Body must be a JSON object"] };

  const b = body as Record<string, unknown>;

  if (typeof b.run_id !== "string" || !b.run_id) errors.push("run_id: required string");
  if (typeof b.workflow !== "string" || !b.workflow) errors.push("workflow: required string");
  if (!VALID_STATUSES.includes(b.status as typeof VALID_STATUSES[number])) errors.push(`status: must be one of ${VALID_STATUSES.join(", ")}`);
  if (!VALID_ENTITY_TYPES.includes(b.entity_type as typeof VALID_ENTITY_TYPES[number])) errors.push(`entity_type: must be one of ${VALID_ENTITY_TYPES.join(", ")}`);
  if (typeof b.entity_id !== "string" || !b.entity_id) errors.push("entity_id: required string");
  if (typeof b.source_url !== "string" || !b.source_url) errors.push("source_url: required string");

  if (!b.scrape || typeof b.scrape !== "object") {
    errors.push("scrape: required object with ok (boolean) and bytes (number)");
  } else {
    const s = b.scrape as Record<string, unknown>;
    if (typeof s.ok !== "boolean") errors.push("scrape.ok: required boolean");
    if (typeof s.bytes !== "number") errors.push("scrape.bytes: required number");
  }

  if (b.enrichment === undefined || b.enrichment === null || typeof b.enrichment !== "object" || Array.isArray(b.enrichment)) {
    errors.push("enrichment: required object");
  }

  if (b.error !== null && b.error !== undefined) {
    if (typeof b.error !== "object" || Array.isArray(b.error)) {
      errors.push("error: must be null or object with code and message");
    } else {
      const e = b.error as Record<string, unknown>;
      if (typeof e.code !== "string") errors.push("error.code: required string");
      if (typeof e.message !== "string") errors.push("error.message: required string");
    }
  }

  if (typeof b.occurred_at !== "string" || !b.occurred_at) errors.push("occurred_at: required ISO timestamp string");

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: b as unknown as CallbackEnvelope };
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function authenticateRequest(req: Request): { ok: true } | { ok: false; response: Response } {
  // Accept ENRICHMENT_WORKER_SECRET (preferred) or N8N_SHARED_SECRET (universal fallback)
  // to avoid requiring operators to re-key many workflows.
  const enrichmentSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET");
  const sharedSecret = Deno.env.get("N8N_SHARED_SECRET");

  if (!enrichmentSecret && !sharedSecret) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Server misconfigured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  // Accept Bearer token OR X-Api-Key OR apikey header
  const authHeader = req.headers.get("authorization") ?? "";
  const apiKeyHeader = req.headers.get("x-api-key") ?? "";
  const apikeyHeader = req.headers.get("apikey") ?? "";

  let token = "";
  if (authHeader) token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token && apiKeyHeader) token = apiKeyHeader.trim();
  if (!token && apikeyHeader) token = apikeyHeader.trim();

  const authenticated =
    (enrichmentSecret ? constantTimeCompare(token, enrichmentSecret) : false) ||
    (sharedSecret ? constantTimeCompare(token, sharedSecret) : false);

  if (!token || !authenticated) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return { ok: true };
}

export function buildDuplicateResponse(existingId: string): Response {
  return new Response(
    JSON.stringify({ ok: true, duplicate: true, result_id: existingId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function buildSuccessResponse(resultId: string, warnings?: string[]): Response {
  const body: Record<string, unknown> = { ok: true, duplicate: false, result_id: resultId };
  if (warnings && warnings.length > 0) body.warnings = warnings;
  return new Response(
    JSON.stringify(body),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export function deriveJobStatus(envelopeStatus: string): string {
  return envelopeStatus === "error" ? "failed" : "completed";
}

export interface NormalizedContact {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  source_url: string;
  confidence: number | null;
}

export function extractSuggestedContacts(enrichment: Record<string, unknown>, envelopeSourceUrl: string): NormalizedContact[] {
  const sc = enrichment.suggested_contacts;
  if (!Array.isArray(sc)) return [];
  return sc.map((c: unknown) => {
    const obj = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : null,
      title: typeof obj.title === "string" ? obj.title : null,
      email: typeof obj.email === "string" ? obj.email : null,
      phone: typeof obj.phone === "string" ? obj.phone : null,
      source_url: typeof obj.source_url === "string" ? obj.source_url : envelopeSourceUrl,
      confidence: typeof obj.confidence === "number" ? obj.confidence : null,
    };
  });
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const auth = authenticateRequest(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const validation = validateEnvelope(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({ ok: false, errors: validation.errors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const envelope = validation.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Duplicate check on enrichment_results
    const { data: existing } = await supabase
      .from("enrichment_results")
      .select("id")
      .eq("run_id", envelope.run_id)
      .maybeSingle();

    if (existing) {
      return buildDuplicateResponse(existing.id);
    }

    const scrape = envelope.scrape as { ok: boolean; bytes: number };
    const { data: inserted, error: insertErr } = await supabase
      .from("enrichment_results")
      .insert({
        run_id: envelope.run_id,
        workflow: envelope.workflow,
        status: envelope.status,
        entity_type: envelope.entity_type,
        entity_id: envelope.entity_id,
        source_url: envelope.source_url,
        scrape_ok: scrape.ok,
        scrape_bytes: scrape.bytes,
        enrichment: envelope.enrichment,
        error: envelope.error,
        occurred_at: envelope.occurred_at,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr.message);
      return new Response(
        JSON.stringify({ ok: false, error: "Database write failed" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update enrichment_jobs status
    const newStatus = deriveJobStatus(envelope.status);
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (envelope.status === "error" && envelope.error) {
      updatePayload.last_error = envelope.error.message;
    }

    const { error: updateErr } = await supabase
      .from("enrichment_jobs")
      .update(updatePayload)
      .eq("run_id", envelope.run_id);

    if (updateErr) {
      console.error("Job update error:", updateErr.message);
    }

    // Apply grant-specific fields back to the grants table (best-effort)
    const warnings: string[] = [];
    if (envelope.entity_type === "grant" && envelope.status === "success") {
      try {
        const e = envelope.enrichment as Record<string, unknown>;
        const updates: Record<string, unknown> = {};

        const safeNum = (v: unknown): number | null => {
          if (v === null || v === undefined) return null;
          const n = Number(v);
          return isFinite(n) ? n : null;
        };

        const safeStr = (v: unknown): string | null =>
          typeof v === "string" && v.trim().length > 0 ? v.trim() : null;

        const safeBool = (v: unknown): boolean | null =>
          typeof v === "boolean" ? v : null;

        // Only backfill if the current value is empty/null
        const { data: currentGrant } = await supabase
          .from("grants")
          .select("available_funding, amount_requested, amount_awarded, grant_term_start, grant_term_end, is_multiyear, match_required, reporting_required, notes, grant_types, fiscal_year, application_url")
          .eq("id", envelope.entity_id)
          .maybeSingle();

        if (currentGrant) {
          if (!currentGrant.available_funding && safeNum(e.available_funding ?? e.max_award ?? e.award_ceiling ?? e.total_funding ?? e.funding_available) !== null)
            updates.available_funding = safeNum(e.available_funding ?? e.max_award ?? e.award_ceiling ?? e.total_funding ?? e.funding_available);
          if (!currentGrant.amount_requested && safeNum(e.amount_requested) !== null)
            updates.amount_requested = safeNum(e.amount_requested);
          if (!currentGrant.amount_awarded && safeNum(e.amount_awarded) !== null)
            updates.amount_awarded = safeNum(e.amount_awarded);
          // Also accept "award_amount" or "funding_amount" as aliases
          if (!currentGrant.amount_awarded && safeNum(e.award_amount ?? e.funding_amount) !== null)
            updates.amount_awarded = safeNum(e.award_amount ?? e.funding_amount);
          if (!currentGrant.grant_term_start && safeStr(e.grant_term_start))
            updates.grant_term_start = safeStr(e.grant_term_start);
          if (!currentGrant.grant_term_end && safeStr(e.grant_term_end ?? e.deadline))
            updates.grant_term_end = safeStr(e.grant_term_end ?? e.deadline);
          if (currentGrant.is_multiyear === null && safeBool(e.is_multiyear) !== null)
            updates.is_multiyear = safeBool(e.is_multiyear);
          if (currentGrant.match_required === null && safeBool(e.match_required) !== null)
            updates.match_required = safeBool(e.match_required);
          if (currentGrant.reporting_required === null && safeBool(e.reporting_required) !== null)
            updates.reporting_required = safeBool(e.reporting_required);
          if (!currentGrant.fiscal_year && safeNum(e.fiscal_year) !== null)
            updates.fiscal_year = safeNum(e.fiscal_year);
          if (!currentGrant.notes && safeStr(e.description ?? e.summary))
            updates.notes = safeStr(e.description ?? e.summary);
          if ((!currentGrant.grant_types || currentGrant.grant_types.length === 0) && Array.isArray(e.grant_types) && e.grant_types.length > 0)
            updates.grant_types = e.grant_types;
          if (!currentGrant.application_url && safeStr(e.application_url ?? e.apply_url ?? e.application_link ?? e.how_to_apply_url))
            updates.application_url = safeStr(e.application_url ?? e.apply_url ?? e.application_link ?? e.how_to_apply_url);

          if (Object.keys(updates).length > 0) {
            const { error: grantUpdateErr } = await supabase
              .from("grants")
              .update(updates)
              .eq("id", envelope.entity_id);
            if (grantUpdateErr) {
              console.error("Grant backfill error:", grantUpdateErr.message);
              warnings.push("grant backfill failed: " + grantUpdateErr.message);
            } else {
              console.log(`Grant ${envelope.entity_id} backfilled: ${Object.keys(updates).join(", ")}`);
            }
          }
        }
      } catch (grantErr) {
        console.error("Grant backfill unexpected error:", grantErr);
        warnings.push("grant backfill unexpected error");
      }
    }

    // Upsert grant_resources from n8n enrichment (best-effort)
    if (envelope.entity_type === "grant" && envelope.status === "success") {
      try {
        const e = envelope.enrichment as Record<string, unknown>;
        const llmResources = Array.isArray(e.resources) ? e.resources : [];
        const llmDates = Array.isArray(e.important_dates) ? e.important_dates : [];
        const llmDownloads = Array.isArray(e.downloads) ? e.downloads : [];

        const allResources = [
          ...llmResources.map((r: any) => ({
            grant_id: envelope.entity_id,
            resource_type: 'link' as const,
            label: typeof r.label === 'string' ? r.label : 'Resource',
            url: typeof r.url === 'string' ? r.url : null,
            description: typeof r.description === 'string' ? r.description : null,
            source: 'llm',
            run_id: envelope.run_id,
          })),
          ...llmDates.map((d: any) => ({
            grant_id: envelope.entity_id,
            resource_type: 'date' as const,
            label: typeof d.label === 'string' ? d.label : 'Important Date',
            resource_date: typeof d.date === 'string' ? d.date : null,
            description: typeof d.description === 'string' ? d.description : null,
            source: 'llm',
            run_id: envelope.run_id,
          })),
          ...llmDownloads.map((dl: any) => ({
            grant_id: envelope.entity_id,
            resource_type: 'download' as const,
            label: typeof dl.label === 'string' ? dl.label : 'Download',
            url: typeof dl.url === 'string' ? dl.url : null,
            description: typeof dl.description === 'string' ? dl.description : null,
            source: 'llm',
            run_id: envelope.run_id,
          })),
        ].filter(r => (r as Record<string, unknown>).url || (r as Record<string, unknown>).resource_date); // Must have url or date

        if (allResources.length > 0) {
          for (const res of allResources) {
            const { error: resErr } = await supabase
              .from("grant_resources")
              .upsert(res, { ignoreDuplicates: true });
            if (resErr) console.error("Grant resource save error:", resErr.message);
          }
          console.log(`Saved ${allResources.length} LLM-extracted grant resources`);
        }
      } catch (resErr) {
        console.error("Grant resources unexpected error:", resErr);
        warnings.push("grant_resources write failed");
      }
    }

    // Upsert contact_suggestions (best-effort, never crashes callback)
    try {
      const suggestedContacts = extractSuggestedContacts(envelope.enrichment, envelope.source_url);

      // Check if row exists to preserve applied_indices
      const { data: existingRow } = await supabase
        .from("contact_suggestions")
        .select("id, applied_indices")
        .eq("run_id", envelope.run_id)
        .maybeSingle();

      if (existingRow) {
        // Update suggestions but preserve applied_indices
        const { error: suggestErr } = await supabase
          .from("contact_suggestions")
          .update({
            suggestions: suggestedContacts,
            source_url: envelope.source_url,
          })
          .eq("id", existingRow.id);
        if (suggestErr) {
          console.error("Contact suggestions update error:", suggestErr.message);
          warnings.push("contact_suggestions update failed: " + suggestErr.message);
        }
      } else {
        const { error: suggestErr } = await supabase
          .from("contact_suggestions")
          .insert({
            run_id: envelope.run_id,
            entity_type: envelope.entity_type,
            entity_id: envelope.entity_id,
            source_url: envelope.source_url,
            suggestions: suggestedContacts,
            status: "ready",
            applied_indices: [],
          });
        if (suggestErr) {
          console.error("Contact suggestions insert error:", suggestErr.message);
          warnings.push("contact_suggestions write failed: " + suggestErr.message);
        }
      }
    } catch (suggestCatchErr) {
      console.error("Contact suggestions unexpected error:", suggestCatchErr);
      warnings.push("contact_suggestions unexpected error");
    }

    // ── Momentum recompute trigger (best-effort, non-blocking) ──
    if (envelope.entity_type === "opportunity" && envelope.status === "success") {
      try {
        const fnUrl = `${supabaseUrl}/functions/v1/momentum-recalculate`;
        const workerSecret = Deno.env.get("ENRICHMENT_WORKER_SECRET") || "";
        const resp = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": workerSecret,
          },
          body: JSON.stringify({
            opportunity_id: envelope.entity_id,
            mode: "single",
          }),
        });
        if (!resp.ok) {
          console.error("Momentum recompute failed:", await resp.text());
        }
      } catch (momentumErr) {
        console.error("Momentum recompute error (non-fatal):", momentumErr);
      }
    }

    return buildSuccessResponse(inserted.id, warnings);
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal error" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

Deno.serve(handleRequest);
