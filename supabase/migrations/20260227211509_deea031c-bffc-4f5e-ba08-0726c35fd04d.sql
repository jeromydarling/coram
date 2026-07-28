
-- 1. Add Firecrawl attribution column
ALTER TABLE public.tenant_usage_counters
  ADD COLUMN IF NOT EXISTS ai_calls_firecrawl integer NOT NULL DEFAULT 0;

-- 2. Add unique constraint for atomic upsert (tenant_id + period_start)
ALTER TABLE public.tenant_usage_counters
  DROP CONSTRAINT IF EXISTS tenant_usage_counters_tenant_period_uq;

ALTER TABLE public.tenant_usage_counters
  ADD CONSTRAINT tenant_usage_counters_tenant_period_uq UNIQUE (tenant_id, period_start);

-- 3. Replace the increment_usage_counter RPC with an atomic upsert version
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
BEGIN
  -- Atomic upsert: insert if missing, increment if exists
  INSERT INTO tenant_usage_counters (
    tenant_id, period_start, period_end,
    ai_calls, ai_tokens, ai_cost_estimated_usd
  )
  VALUES (
    p_tenant_id,
    p_period_start::date,
    COALESCE(p_period_end, (date_trunc('month', p_period_start::date) + interval '1 month - 1 day'))::date,
    1, p_tokens, p_cost
  )
  ON CONFLICT (tenant_id, period_start)
  DO UPDATE SET
    ai_calls = tenant_usage_counters.ai_calls + 1,
    ai_tokens = tenant_usage_counters.ai_tokens + p_tokens,
    ai_cost_estimated_usd = tenant_usage_counters.ai_cost_estimated_usd + p_cost;

  -- Increment the mode-specific column (deep_mode_calls or essential_mode_calls)
  IF p_field = 'deep_mode_calls' THEN
    UPDATE tenant_usage_counters
    SET deep_mode_calls = deep_mode_calls + 1
    WHERE tenant_id = p_tenant_id AND period_start = p_period_start::date;
  ELSE
    UPDATE tenant_usage_counters
    SET essential_mode_calls = essential_mode_calls + 1
    WHERE tenant_id = p_tenant_id AND period_start = p_period_start::date;
  END IF;

  -- Increment the engine-specific column
  IF p_engine_field = 'ai_calls_perplexity' THEN
    UPDATE tenant_usage_counters
    SET ai_calls_perplexity = ai_calls_perplexity + 1
    WHERE tenant_id = p_tenant_id AND period_start = p_period_start::date;
  ELSIF p_engine_field = 'ai_calls_firecrawl' THEN
    UPDATE tenant_usage_counters
    SET ai_calls_firecrawl = ai_calls_firecrawl + 1
    WHERE tenant_id = p_tenant_id AND period_start = p_period_start::date;
  ELSE
    UPDATE tenant_usage_counters
    SET ai_calls_lovable = ai_calls_lovable + 1
    WHERE tenant_id = p_tenant_id AND period_start = p_period_start::date;
  END IF;
END;
$$;
