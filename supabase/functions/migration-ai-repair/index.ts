/**
 * migration-ai-repair — Wave 5: AI-Assisted Migration Rescue.
 *
 * WHAT: When a migration row fails, send the row + schema + error to
 *       Gemini Flash (via Lovable AI gateway). Gemini either proposes a
 *       normalized row (with confidence + reasoning) or marks it unrescuable.
 *       Every proposal lands in `migration_review_queue` — NEVER auto-committed.
 *
 * WHERE: Called by migration runners on row-level failure. Also exposed to
 *        the steward via UI to retry rescue on a queued row.
 *
 * WHY:   Preserves the Confidence Ladder promise — "we stop before it touches
 *        your live records" — while still extending a hand instead of silently
 *        dropping rows.
 *
 * GOVERNANCE: Honesty guardrail — confidence < 0.7 is surfaced as
 *             "needs human eyes", not as a suggestion. Triggers gardener
 *             notification on any failed/unrescuable batch.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { callLlmJson, calmFallbackMessage } from "../_shared/llmGateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-key",
};

interface FailedRow {
  source_row: Record<string, unknown>;
  target_entity: string;          // "people" | "opportunities" | ...
  failure_reason: string;
}

interface RepairBody {
  migration_id: string;
  tenant_id: string;
  integration_key: string;
  failed_rows: FailedRow[];
  notify_gardener?: boolean;       // default true
}

const TARGET_SCHEMAS: Record<string, Record<string, string>> = {
  people: {
    first_name: "string", last_name: "string", email: "string (lowercase, valid)",
    phone: "string (E.164 if possible)", title: "string", organization: "string",
    notes: "string",
  },
  opportunities: {
    name: "string (required)", organization: "string", website_url: "string (https URL)",
    sector: "string", city: "string", state: "string (2-letter US or full name)",
    notes: "string",
  },
};

const REPAIR_TOOL = {
  type: "function" as const,
  function: {
    name: "propose_repair",
    description: "Propose a normalized row payload OR mark the row as unrescuable.",
    parameters: {
      type: "object",
      properties: {
        repairable: { type: "boolean", description: "True if a confident repair is possible." },
        proposed_payload: {
          type: "object",
          description: "The repaired row, conforming to the target schema. Only set if repairable=true.",
          additionalProperties: true,
        },
        confidence: {
          type: "number",
          description: "0..1 confidence that the proposal is correct. Be honest — low confidence is fine.",
        },
        reasoning: {
          type: "string",
          description: "1–3 sentences, plain language, no jargon. What you changed and why.",
        },
      },
      required: ["repairable", "confidence", "reasoning"],
      additionalProperties: false,
    },
  },
};

async function repairOne(row: FailedRow): Promise<{
  proposed_payload: Record<string, unknown> | null;
  confidence: number;
  reasoning: string;
  status: "auto_rescued_pending_review" | "pending_review" | "unrescuable";
  error_kind?: string;
}> {
  const schema = TARGET_SCHEMAS[row.target_entity] || { _: "unknown entity — make a best-effort mapping" };

  const result = await callLlmJson<{
    repairable: boolean;
    proposed_payload?: Record<string, unknown>;
    confidence: number;
    reasoning: string;
  }>(
    [
      {
        role: "system",
        content:
          "You are a careful data steward repairing a single failed import row. " +
          "Never invent values you cannot infer from the source row. " +
          "If you are unsure, set repairable=false. " +
          "Honesty over helpfulness — confidence below 0.7 is fine and expected.",
      },
      {
        role: "user",
        content:
          `Target entity: ${row.target_entity}\n` +
          `Target schema (field: type/constraint):\n${JSON.stringify(schema, null, 2)}\n\n` +
          `Failure reason: ${row.failure_reason}\n\n` +
          `Source row from vendor:\n${JSON.stringify(row.source_row, null, 2)}\n\n` +
          `Propose a repair OR mark unrescuable.`,
      },
    ],
    {
      model: "google/gemini-3-flash-preview",
      temperature: 0.1,
      tools: [REPAIR_TOOL],
      tool_choice: { type: "function", function: { name: "propose_repair" } },
      timeoutMs: 25_000,
      maxAttempts: 3,
    },
  );

  if (!result.ok || !result.data) {
    return {
      proposed_payload: null,
      confidence: 0,
      reasoning: calmFallbackMessage(result.errorKind),
      status: "pending_review",
      error_kind: result.errorKind,
    };
  }

  const { repairable, proposed_payload, confidence, reasoning } = result.data;
  const conf = Math.max(0, Math.min(1, Number(confidence) || 0));

  if (!repairable || !proposed_payload) {
    return { proposed_payload: null, confidence: conf, reasoning, status: "unrescuable" };
  }
  if (conf < 0.7) {
    // Honesty guardrail — propose, but require human eyes explicitly.
    return { proposed_payload, confidence: conf, reasoning, status: "pending_review" };
  }
  return { proposed_payload, confidence: conf, reasoning, status: "auto_rescued_pending_review" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Dual auth: either a logged-in tenant member, OR an internal edge call.
  const internalKey = Deno.env.get("INTERNAL_NOTIFY_KEY");
  const providedInternal = req.headers.get("x-internal-key");
  const isInternalCall = !!internalKey && providedInternal === internalKey;

  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  let supabase;
  let userId: string | null = null;
  if (isInternalCall) {
    supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  } else {
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = claims.claims.sub as string;
  }

  let body: RepairBody;
  try {
    body = await req.json() as RepairBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.migration_id || !body.tenant_id || !body.integration_key ||
      !Array.isArray(body.failed_rows) || body.failed_rows.length === 0) {
    return new Response(JSON.stringify({
      error: "migration_id, tenant_id, integration_key, failed_rows[] required",
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (body.failed_rows.length > 100) {
    return new Response(JSON.stringify({ error: "Batch too large (max 100 rows)" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // For user-initiated calls, verify tenant membership.
  if (!isInternalCall && userId) {
    const { data: member } = await supabase
      .from("tenant_users").select("tenant_id")
      .eq("tenant_id", body.tenant_id).eq("user_id", userId).maybeSingle();
    if (!member) {
      return new Response(JSON.stringify({ error: "Not a member of this tenant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const sampleErrors: string[] = [];
  let rescued = 0;
  let unrescuable = 0;
  const toInsert: Array<Record<string, unknown>> = [];

  for (const row of body.failed_rows) {
    const r = await repairOne(row);
    if (r.status === "unrescuable") unrescuable++;
    if (r.proposed_payload) rescued++;
    sampleErrors.push(row.failure_reason);

    toInsert.push({
      migration_id: body.migration_id,
      tenant_id: body.tenant_id,
      integration_key: body.integration_key,
      source_row: row.source_row,
      target_entity: row.target_entity,
      failure_reason: row.failure_reason,
      ai_proposed_payload: r.proposed_payload,
      ai_confidence: r.confidence,
      ai_reasoning: r.reasoning,
      ai_error_kind: r.error_kind ?? null,
      status: r.status,
    });
  }

  // Use service role for inserts so user-initiated calls still write under RLS-safe context.
  const writer = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error: insertErr } = await writer
    .from("migration_review_queue").insert(toInsert);
  if (insertErr) {
    console.error("[migration-ai-repair] insert error:", insertErr);
    return new Response(JSON.stringify({ error: insertErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fire-and-acknowledge gardener notification (non-blocking on email failure).
  const notify = body.notify_gardener !== false;
  let notified = false;
  if (notify && internalKey) {
    try {
      const notifyResp = await fetch(`${supabaseUrl}/functions/v1/migration-gardener-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify({
          migration_id: body.migration_id,
          tenant_id: body.tenant_id,
          integration_key: body.integration_key,
          reason: "AI rescue completed — proposals are waiting for review.",
          failed_count: body.failed_rows.length,
          rescued_count: rescued,
          unrescuable_count: unrescuable,
          sample_errors: sampleErrors.slice(0, 5),
        }),
      });
      notified = notifyResp.ok;
      if (!notifyResp.ok) {
        console.warn(`[migration-ai-repair] notify failed: ${notifyResp.status}`);
      }
    } catch (err) {
      console.warn("[migration-ai-repair] notify exception:", err);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    processed: body.failed_rows.length,
    rescued_count: rescued,
    unrescuable_count: unrescuable,
    gardener_notified: notified,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
