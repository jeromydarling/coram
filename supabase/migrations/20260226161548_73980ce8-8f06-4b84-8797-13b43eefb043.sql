
-- Add engine dimension to tenant_usage_counters for unified tracking
ALTER TABLE public.tenant_usage_counters
  ADD COLUMN IF NOT EXISTS ai_calls_lovable INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_calls_perplexity INTEGER NOT NULL DEFAULT 0;

-- The existing ai_calls column becomes the TOTAL (sum of both engines).
-- Individual engine columns allow per-engine breakdown in the budget panel.

COMMENT ON COLUMN public.tenant_usage_counters.ai_calls_lovable IS 'AI calls made via Lovable AI gateway (NRI, chat, email analysis)';
COMMENT ON COLUMN public.tenant_usage_counters.ai_calls_perplexity IS 'AI calls made via Perplexity (search, org enrichment, discovery)';

-- Update compute_tenant_ai_quota to be engine-agnostic (it already is — just documents the unified model)
COMMENT ON FUNCTION public.compute_tenant_ai_quota IS 'Computes unified AI quota across all engines (Lovable AI + Perplexity). monthly_call_cap in operator_ai_budget is the total ceiling.';
