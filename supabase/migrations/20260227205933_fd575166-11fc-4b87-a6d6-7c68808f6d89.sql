
-- 1. Create the missing increment_usage_counter RPC
CREATE OR REPLACE FUNCTION public.increment_usage_counter(
  p_tenant_id uuid,
  p_period_start text,
  p_field text,
  p_engine_field text,
  p_tokens integer DEFAULT 0,
  p_cost numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validate field names to prevent SQL injection
  IF p_field NOT IN ('deep_mode_calls', 'essential_mode_calls') THEN
    RAISE EXCEPTION 'Invalid counter field: %', p_field;
  END IF;
  IF p_engine_field NOT IN ('ai_calls_lovable', 'ai_calls_perplexity') THEN
    RAISE EXCEPTION 'Invalid engine field: %', p_engine_field;
  END IF;

  EXECUTE format(
    'UPDATE tenant_usage_counters SET ai_calls = ai_calls + 1, ai_tokens = ai_tokens + $1, ai_cost_estimated_usd = COALESCE(ai_cost_estimated_usd, 0) + $2, %I = COALESCE(%I, 0) + 1, %I = COALESCE(%I, 0) + 1 WHERE tenant_id = $3 AND period_start = $4',
    p_field, p_field, p_engine_field, p_engine_field
  )
  USING p_tokens, p_cost, p_tenant_id, p_period_start;
END;
$$;

-- 2. RLS: Allow tenant users to read their own entitlements
CREATE POLICY "Tenant users can read own entitlements"
ON public.tenant_entitlements
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenant_users tu
    WHERE tu.tenant_id = tenant_entitlements.tenant_id
      AND tu.user_id = auth.uid()
  )
);

-- 3. RLS: Allow authenticated users to read operator_ai_budget (read-only, no secrets)
CREATE POLICY "Authenticated users can read AI budget"
ON public.operator_ai_budget
FOR SELECT
USING (auth.uid() IS NOT NULL);
