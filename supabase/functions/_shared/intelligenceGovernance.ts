/**
 * intelligenceGovernance — Shared AI governance helpers for edge functions.
 *
 * WHAT: Classifies calls as Essential vs Deep, checks allowances, tracks usage.
 * WHERE: Imported by all AI edge functions (profunda-ai, neighborhood-insights, etc.).
 * WHY: Enforces the CROS tier-based Deep Insight governance model.
 *
 * Essential Intelligence: unlimited — summaries, rewrites, basic reflections.
 * Deep Intelligence: metered — cross-entity synthesis, external research, drift, reports.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type IntelligenceMode = 'essential' | 'deep';
export type AIEngine = 'lovable' | 'perplexity' | 'firecrawl';

export interface GovernanceResult {
  mode: IntelligenceMode;
  allowed: boolean;
  deepUsed: number;
  deepAllowance: number;
  degraded: boolean;
  message?: string;
}

// ── Rate Card Constants ──
// Per-call cost estimates based on known vendor pricing (updated 2026-02).
// Firecrawl: $19/mo Hobby = 3,000 credits → ~$0.006/credit.
// Perplexity: sonar-pro ~$5/1K requests → $0.005/request.
export const RATE_CARDS: Record<AIEngine, { costPerCall: number; costPer1kTokens: number; unit: string }> = {
  lovable:    { costPerCall: 0,       costPer1kTokens: 0.0005, unit: 'token'  },  // Platform-included
  perplexity: { costPerCall: 0.005,   costPer1kTokens: 0,      unit: 'request' }, // sonar-pro ~$5/1K requests
  firecrawl:  { costPerCall: 0.006,   costPer1kTokens: 0,      unit: 'credit'  }, // $19/3K credits = ~$0.006/credit
};

/**
 * Estimate cost for a single AI call using rate cards.
 * For Firecrawl, pass actualCredits as totalTokens for precise cost.
 */
export function estimateCost(engine: AIEngine, totalTokens: number): number {
  const card = RATE_CARDS[engine];
  if (engine === 'lovable') {
    return (totalTokens / 1000) * card.costPer1kTokens;
  }
  // For Firecrawl: totalTokens = actual credits consumed; multiply by per-credit cost
  if (engine === 'firecrawl' && totalTokens > 0) {
    return totalTokens * card.costPerCall;
  }
  return card.costPerCall;
}

/**
 * Firecrawl credit accumulator — lightweight counter for tracking credits
 * across multiple Firecrawl calls within a single edge function invocation.
 *
 * WHAT: Accumulates actual Firecrawl credit usage from API responses.
 * WHERE: Used by contact-enrich, local-pulse-worker, and any Firecrawl consumer.
 * WHY: Firecrawl responses include creditsUsed; capturing this gives ground truth vs estimates.
 */
export class FirecrawlCreditTracker {
  private credits = 0;
  private calls = 0;

  /** Call after each Firecrawl API response. Extracts creditsUsed if present. */
  track(responseData: Record<string, unknown>): void {
    this.calls++;
    const used = (responseData?.creditsUsed as number)
      ?? (responseData?.data as Record<string, unknown>)?.creditsUsed as number
      ?? 1; // Minimum 1 credit per successful call
    this.credits += typeof used === 'number' ? used : 1;
  }

  /** Record accumulated usage to governance system. */
  async flush(
    supabase: SupabaseClient,
    tenantId: string,
    workflowKey: string,
  ): Promise<void> {
    if (this.calls === 0) return;
    const cost = this.credits * RATE_CARDS.firecrawl.costPerCall;
    await recordWorkflowUsage(supabase, tenantId, workflowKey, 'firecrawl', 'deep', this.credits, cost);
    console.log(`[firecrawl-tracker] Flushed: ${this.calls} calls, ${this.credits} credits, $${cost.toFixed(4)}`);
  }

  get totalCredits(): number { return this.credits; }
  get totalCalls(): number { return this.calls; }
}

/** Workflow keys that always count as Deep Intelligence. */
const DEEP_WORKFLOW_KEYS = new Set([
  'neighborhood_insights',
  'drift_detection',
  'territory_news',
  'grant_discovery',
  'enrichment',
  'deep_report',
  'compass_full',
  'narrative_forecast',
  'cross_entity_synthesis',
]);

/** Workflow keys that are always Essential (unlimited). */
const ESSENTIAL_WORKFLOW_KEYS = new Set([
  'nri_chat',
  'tone_rewrite',
  'summary_single',
  'reflection_basic',
  'compass_light',
  'structured_aggregation',
  'local_pulse_discovery',
]);

/**
 * Classify a workflow as Essential or Deep intelligence.
 * SAFEGUARD: Unknown workflows default to 'deep' (metered) to prevent
 * accidental unlimited usage from unregistered workflow keys.
 */
export function classifyIntelligenceMode(workflowKey: string): IntelligenceMode {
  if (ESSENTIAL_WORKFLOW_KEYS.has(workflowKey)) return 'essential';
  if (DEEP_WORKFLOW_KEYS.has(workflowKey)) return 'deep';
  // Default: unknown workflows are metered (deep) for safety
  console.warn(`[governance] unknown workflow key "${workflowKey}" defaulting to deep (metered)`);
  return 'deep';
}

/**
 * Check if a tenant can use Deep Intelligence this period.
 * Returns governance result with mode, allowance info, and degradation state.
 */
export async function checkDeepAllowance(
  supabase: SupabaseClient,
  tenantId: string,
  workflowKey: string,
): Promise<GovernanceResult> {
  const mode = classifyIntelligenceMode(workflowKey);

  // Essential is always allowed
  if (mode === 'essential') {
    return { mode: 'essential', allowed: true, deepUsed: 0, deepAllowance: 0, degraded: false };
  }

  try {
    // Get operator budget (force_essential_mode, deep allowances)
    const { data: budget } = await supabase
      .from('operator_ai_budget')
      .select('force_essential_mode, deep_allowance_core, deep_allowance_insight, deep_allowance_story')
      .limit(1)
      .maybeSingle();

    // If force essential mode is on globally, degrade
    if (budget?.force_essential_mode) {
      return {
        mode: 'essential',
        allowed: true,
        deepUsed: 0,
        deepAllowance: 0,
        degraded: true,
        message: 'Running in streamlined mode.',
      };
    }

    // Get tenant tier
    const { data: entitlement } = await supabase
      .from('tenant_entitlements')
      .select('plan_key')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const tier = entitlement?.plan_key || 'core';
    const deepAllowance = tier === 'story'
      ? (budget?.deep_allowance_story ?? 600)
      : tier === 'insight'
        ? (budget?.deep_allowance_insight ?? 250)
        : (budget?.deep_allowance_core ?? 100);

    // Get current month usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const { data: usage } = await supabase
      .from('tenant_usage_counters')
      .select('deep_mode_calls')
      .eq('tenant_id', tenantId)
      .eq('period_start', periodStart)
      .maybeSingle();

    const deepUsed = usage?.deep_mode_calls ?? 0;

    if (deepUsed >= deepAllowance) {
      return {
        mode: 'essential',
        allowed: true,
        deepUsed,
        deepAllowance,
        degraded: true,
        message: "You've used your included Deep Insights for this month. Continuing with essential summaries.",
      };
    }

    return {
      mode: 'deep',
      allowed: true,
      deepUsed,
      deepAllowance,
      degraded: false,
    };
  } catch (err) {
    console.warn('[governance] allowance check failed, defaulting to essential:', err);
    return { mode: 'essential', allowed: true, deepUsed: 0, deepAllowance: 0, degraded: false };
  }
}

/**
 * Record a workflow usage event after execution.
 * Uses the atomic increment_usage_counter RPC (ON CONFLICT upsert) to prevent race conditions.
 */
export async function recordWorkflowUsage(
  supabase: SupabaseClient,
  tenantId: string,
  workflowKey: string,
  engine: AIEngine,
  mode: IntelligenceMode,
  actualTokens = 0,
  costOverride?: number,
): Promise<void> {
  try {
    const cost = costOverride ?? estimateCost(engine, actualTokens);

    // Insert workflow usage row (detailed per-call log)
    await supabase.from('ai_workflow_usage').insert({
      tenant_id: tenantId,
      workflow_key: workflowKey,
      engine_used: engine,
      intelligence_mode: mode,
      call_count: 1,
      estimated_tokens: actualTokens,
      estimated_cost_usd: cost,
    });

    // Atomic counter increment via RPC (race-safe, handles upsert)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const counterField = mode === 'deep' ? 'deep_mode_calls' : 'essential_mode_calls';
    const engineField = engine === 'perplexity'
      ? 'ai_calls_perplexity'
      : engine === 'firecrawl'
        ? 'ai_calls_firecrawl'
        : engine === 'gemini'
          ? 'ai_calls_gemini'
          : 'ai_calls_lovable';

    await supabase.rpc('increment_usage_counter', {
      p_tenant_id: tenantId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_field: counterField,
      p_engine_field: engineField,
      p_tokens: actualTokens,
      p_cost: cost,
    }).catch((err: unknown) => {
      console.warn('[governance] RPC increment failed:', err);
    });
  } catch (err) {
    console.warn('[governance] usage recording failed (non-fatal):', err);
  }
}

/**
 * Get the current Deep Insight usage percentage for a tenant (for UI banners).
 */
export async function getDeepUsagePct(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<{ pct: number; used: number; allowance: number; atLimit: boolean; nearLimit: boolean }> {
  const result = await checkDeepAllowance(supabase, tenantId, 'deep_report');
  const pct = result.deepAllowance > 0 ? Math.round((result.deepUsed / result.deepAllowance) * 100) : 0;
  return {
    pct,
    used: result.deepUsed,
    allowance: result.deepAllowance,
    atLimit: pct >= 100,
    nearLimit: pct >= 80 && pct < 100,
  };
}
