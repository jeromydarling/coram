import { z } from "zod";

// ── partner_enrich ──
const partnerEnrichPayload = z.object({
  mission_summary: z.string(),
  programs: z.array(z.string()),
  populations_served: z.array(z.string()),
  geographies: z.array(z.string()),
  funding_signals: z.array(z.string()),
  keywords: z.array(z.string()),
});

const partnerEnrichSchema = z.object({
  workflow_key: z.literal("partner_enrich"),
  run_id: z.string().min(1),
  requested_by: z.string().optional(),
  org_id: z.string().optional(),
  org_name: z.string().min(1),
  website_url: z.string().optional(),
  payload: partnerEnrichPayload,
});

// ── opportunity_monitor ──
const signalSchema = z.object({
  signal_type: z.string(),
  signal_value: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source_url: z.string().optional(),
  detected_at: z.string().optional(),
});

const opportunityMonitorSchema = z.object({
  workflow_key: z.literal("opportunity_monitor"),
  run_id: z.string().min(1),
  requested_by: z.string().optional(),
  opportunity_id: z.string().optional(),
  org_id: z.union([z.string(), z.null()]).optional(),
  org_name: z.union([z.string(), z.null()]).optional(),
  payload: z.object({
    result: z.object({
      signals: z.array(signalSchema),
    }),
  }),
});

// ── recommendations_generate ──
const recommendationsSchema = z.object({
  workflow_key: z.literal("recommendations_generate"),
  run_id: z.string().min(1),
  requested_by: z.string().optional(),
  metro_id: z.string().min(1),
  inputs_hash: z.string().min(1),
  payload: z.object({
    recommendation_type: z.string(),
    title: z.string(),
    body: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

const SCHEMAS: Record<string, z.ZodType> = {
  partner_enrich: partnerEnrichSchema,
  opportunity_monitor: opportunityMonitorSchema,
  recommendations_generate: recommendationsSchema,
};

/**
 * Validate a fixture object against the contract schema for its workflow_key.
 * Returns { success: true } or { success: false, errors: string[] }.
 */
export function validateFixture(fixture: Record<string, unknown>): {
  success: boolean;
  errors: string[];
} {
  const wk = fixture.workflow_key;
  if (typeof wk !== "string" || !SCHEMAS[wk]) {
    return { success: false, errors: [`Unknown or missing workflow_key: ${wk}`] };
  }

  const result = SCHEMAS[wk].safeParse(fixture);
  if (result.success) {
    return { success: true, errors: [] };
  }

  const errors = result.error.issues.map(
    (i) => `${i.path.join(".")}: ${i.message}`,
  );
  return { success: false, errors };
}
