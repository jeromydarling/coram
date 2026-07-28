
-- 1. Add ai_calls_gemini column for Providence Engine Gemini cost tracking
ALTER TABLE public.tenant_usage_counters
  ADD COLUMN IF NOT EXISTS ai_calls_gemini integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tenant_usage_counters.ai_calls_gemini IS 'AI calls made via Google Gemini (Providence Engine stage 3 narrative polish)';

-- 2. Replace increment_usage_counter RPC with fully atomic version
--    Previous version had a race: mode/engine columns incremented via separate UPDATE statements.
--    New version consolidates ALL increments into the single ON CONFLICT upsert.
CREATE OR REPLACE FUNCTION public.increment_usage_counter(
  p_tenant_id uuid,
  p_period_start text,
  p_period_end text DEFAULT NULL,
  p_field text DEFAULT 'essential_mode_calls',
  p_engine_field text DEFAULT 'ai_calls_lovable',
  p_tokens integer DEFAULT 0,
  p_cost numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start date := p_period_start::date;
  v_period_end date := COALESCE(p_period_end, (date_trunc('month', p_period_start::date) + interval '1 month - 1 day'))::date;
BEGIN
  -- Fully atomic upsert: ALL counters incremented in a single statement
  INSERT INTO tenant_usage_counters (
    tenant_id, period_start, period_end,
    ai_calls, ai_tokens, ai_cost_estimated_usd,
    deep_mode_calls, essential_mode_calls,
    ai_calls_lovable, ai_calls_perplexity, ai_calls_firecrawl, ai_calls_gemini
  )
  VALUES (
    p_tenant_id, v_period_start, v_period_end,
    1, p_tokens, p_cost,
    CASE WHEN p_field = 'deep_mode_calls' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'essential_mode_calls' THEN 1 ELSE 0 END,
    CASE WHEN p_engine_field = 'ai_calls_lovable' THEN 1 ELSE 0 END,
    CASE WHEN p_engine_field = 'ai_calls_perplexity' THEN 1 ELSE 0 END,
    CASE WHEN p_engine_field = 'ai_calls_firecrawl' THEN 1 ELSE 0 END,
    CASE WHEN p_engine_field = 'ai_calls_gemini' THEN 1 ELSE 0 END
  )
  ON CONFLICT (tenant_id, period_start)
  DO UPDATE SET
    ai_calls = tenant_usage_counters.ai_calls + 1,
    ai_tokens = tenant_usage_counters.ai_tokens + p_tokens,
    ai_cost_estimated_usd = tenant_usage_counters.ai_cost_estimated_usd + p_cost,
    deep_mode_calls = tenant_usage_counters.deep_mode_calls + CASE WHEN p_field = 'deep_mode_calls' THEN 1 ELSE 0 END,
    essential_mode_calls = tenant_usage_counters.essential_mode_calls + CASE WHEN p_field = 'essential_mode_calls' THEN 1 ELSE 0 END,
    ai_calls_lovable = tenant_usage_counters.ai_calls_lovable + CASE WHEN p_engine_field = 'ai_calls_lovable' THEN 1 ELSE 0 END,
    ai_calls_perplexity = tenant_usage_counters.ai_calls_perplexity + CASE WHEN p_engine_field = 'ai_calls_perplexity' THEN 1 ELSE 0 END,
    ai_calls_firecrawl = tenant_usage_counters.ai_calls_firecrawl + CASE WHEN p_engine_field = 'ai_calls_firecrawl' THEN 1 ELSE 0 END,
    ai_calls_gemini = tenant_usage_counters.ai_calls_gemini + CASE WHEN p_engine_field = 'ai_calls_gemini' THEN 1 ELSE 0 END;
END;
$$;
