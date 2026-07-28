
-- ============================================================
-- Operator AI Budget + Per-User Scaling Infrastructure
-- ============================================================

-- 1. Operator-level AI budget config (single row, operator-only)
CREATE TABLE public.operator_ai_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_call_cap integer NOT NULL DEFAULT 5000,
  monthly_token_cap integer NOT NULL DEFAULT 10000000,
  calls_per_user_core integer NOT NULL DEFAULT 30,
  calls_per_user_insight integer NOT NULL DEFAULT 60,
  calls_per_user_story integer NOT NULL DEFAULT 100,
  tokens_per_user_core integer NOT NULL DEFAULT 50000,
  tokens_per_user_insight integer NOT NULL DEFAULT 100000,
  tokens_per_user_story integer NOT NULL DEFAULT 200000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.operator_ai_budget ENABLE ROW LEVEL SECURITY;

-- Only operators can read/write
CREATE POLICY "Operators can read AI budget"
  ON public.operator_ai_budget FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Operators can update AI budget"
  ON public.operator_ai_budget FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

CREATE POLICY "Operators can insert AI budget"
  ON public.operator_ai_budget FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[]));

-- Seed a default row
INSERT INTO public.operator_ai_budget (monthly_call_cap) VALUES (5000);

-- 2. Add bonus columns to tenant_entitlements for gifting / purchased add-ons
ALTER TABLE public.tenant_entitlements
  ADD COLUMN IF NOT EXISTS ai_bonus_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_bonus_tokens integer NOT NULL DEFAULT 0;

-- 3. Database function to compute a tenant's dynamic AI quota
CREATE OR REPLACE FUNCTION public.compute_tenant_ai_quota(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ent record;
  v_budget record;
  v_active_users integer;
  v_calls_per_user integer;
  v_tokens_per_user integer;
  v_raw_calls integer;
  v_raw_tokens integer;
  v_total_platform_calls integer;
  v_scale_factor numeric;
  v_final_calls integer;
  v_final_tokens integer;
BEGIN
  -- Get tenant entitlements
  SELECT * INTO v_ent FROM tenant_entitlements WHERE tenant_id = p_tenant_id;
  IF v_ent IS NULL THEN
    RETURN jsonb_build_object('calls', 200, 'tokens', 500000, 'active_users', 0, 'scaled', false);
  END IF;

  -- Get operator budget
  SELECT * INTO v_budget FROM operator_ai_budget LIMIT 1;
  IF v_budget IS NULL THEN
    RETURN jsonb_build_object('calls', 200, 'tokens', 500000, 'active_users', 0, 'scaled', false);
  END IF;

  -- Count active team members (steward, shepherd, companion + admin/leadership)
  SELECT count(DISTINCT tu.user_id) INTO v_active_users
  FROM tenant_users tu
  JOIN user_roles ur ON ur.user_id = tu.user_id
  WHERE tu.tenant_id = p_tenant_id
    AND ur.role IN ('steward', 'shepherd', 'companion', 'admin', 'leadership');

  -- At minimum 1 user for quota calc
  v_active_users := GREATEST(v_active_users, 1);

  -- Determine per-user rates from operator config
  CASE v_ent.plan_key
    WHEN 'insight' THEN
      v_calls_per_user := v_budget.calls_per_user_insight;
      v_tokens_per_user := v_budget.tokens_per_user_insight;
    WHEN 'story' THEN
      v_calls_per_user := v_budget.calls_per_user_story;
      v_tokens_per_user := v_budget.tokens_per_user_story;
    ELSE
      v_calls_per_user := v_budget.calls_per_user_core;
      v_tokens_per_user := v_budget.tokens_per_user_core;
  END CASE;

  -- Raw quota = per_user_rate × active_users + bonus
  v_raw_calls := (v_calls_per_user * v_active_users) + v_ent.ai_bonus_calls;
  v_raw_tokens := (v_tokens_per_user * v_active_users) + v_ent.ai_bonus_tokens;

  -- Check if total platform demand exceeds operator ceiling
  SELECT COALESCE(sum(
    CASE te.plan_key
      WHEN 'insight' THEN v_budget.calls_per_user_insight
      WHEN 'story' THEN v_budget.calls_per_user_story
      ELSE v_budget.calls_per_user_core
    END * GREATEST((
      SELECT count(DISTINCT tu2.user_id)
      FROM tenant_users tu2
      JOIN user_roles ur2 ON ur2.user_id = tu2.user_id
      WHERE tu2.tenant_id = te.tenant_id
        AND ur2.role IN ('steward', 'shepherd', 'companion', 'admin', 'leadership')
    ), 1) + te.ai_bonus_calls
  ), 0) INTO v_total_platform_calls
  FROM tenant_entitlements te;

  -- Scale down proportionally if over budget
  IF v_total_platform_calls > v_budget.monthly_call_cap AND v_total_platform_calls > 0 THEN
    v_scale_factor := v_budget.monthly_call_cap::numeric / v_total_platform_calls::numeric;
    v_final_calls := GREATEST(floor(v_raw_calls * v_scale_factor)::integer, 10);
    v_final_tokens := GREATEST(floor(v_raw_tokens * v_scale_factor)::integer, 10000);
    RETURN jsonb_build_object(
      'calls', v_final_calls,
      'tokens', v_final_tokens,
      'active_users', v_active_users,
      'scaled', true,
      'scale_factor', round(v_scale_factor, 3),
      'raw_calls', v_raw_calls
    );
  END IF;

  RETURN jsonb_build_object(
    'calls', v_raw_calls,
    'tokens', v_raw_tokens,
    'active_users', v_active_users,
    'scaled', false
  );
END;
$$;
