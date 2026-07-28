-- ═══════════════════════════════════════════════════════════
-- CROS Deep Insight Governance — Schema Extensions (fix: use 'admin' role)
-- ═══════════════════════════════════════════════════════════

-- 1) Extend tenant_usage_counters with Essential vs Deep tracking + cost estimate
ALTER TABLE public.tenant_usage_counters
  ADD COLUMN IF NOT EXISTS deep_mode_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS essential_mode_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_estimated_usd numeric(10,4) NOT NULL DEFAULT 0;

-- 2) Add columns to operator_ai_budget for new governance model
ALTER TABLE public.operator_ai_budget
  ADD COLUMN IF NOT EXISTS deep_allowance_core integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS deep_allowance_insight integer NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS deep_allowance_story integer NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS nri_guard_core integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS nri_guard_insight integer NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS nri_guard_story integer NOT NULL DEFAULT 4000,
  ADD COLUMN IF NOT EXISTS global_nri_monthly_ceiling integer NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS projected_cost_envelope_usd numeric(10,2) NOT NULL DEFAULT 500.00,
  ADD COLUMN IF NOT EXISTS lovable_cloud_estimated_cost numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perplexity_api_estimated_cost numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS firecrawl_estimated_cost numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS force_essential_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_drift_detection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_territory_crawls boolean NOT NULL DEFAULT false;

-- 3) Create ai_workflow_usage — tracks cost by workflow + engine
CREATE TABLE IF NOT EXISTS public.ai_workflow_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  workflow_key text NOT NULL,
  engine_used text NOT NULL DEFAULT 'lovable',
  intelligence_mode text NOT NULL DEFAULT 'essential',
  call_count integer NOT NULL DEFAULT 1,
  estimated_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_ai_workflow_usage()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.engine_used NOT IN ('lovable', 'perplexity', 'firecrawl') THEN
    RAISE EXCEPTION 'Invalid ai_workflow_usage engine_used: %', NEW.engine_used;
  END IF;
  IF NEW.intelligence_mode NOT IN ('essential', 'deep') THEN
    RAISE EXCEPTION 'Invalid ai_workflow_usage intelligence_mode: %', NEW.intelligence_mode;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_validate_ai_workflow_usage ON public.ai_workflow_usage;
CREATE TRIGGER trg_validate_ai_workflow_usage
  BEFORE INSERT OR UPDATE ON public.ai_workflow_usage
  FOR EACH ROW EXECUTE FUNCTION public.validate_ai_workflow_usage();

CREATE INDEX IF NOT EXISTS idx_ai_workflow_usage_tenant_created
  ON public.ai_workflow_usage (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_workflow_usage_workflow_key
  ON public.ai_workflow_usage (workflow_key, created_at DESC);

ALTER TABLE public.ai_workflow_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view all workflow usage"
  ON public.ai_workflow_usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role inserts workflow usage"
  ON public.ai_workflow_usage FOR INSERT
  WITH CHECK (true);

-- 4) Create operator_ai_cost_model — configurable cost assumptions
CREATE TABLE IF NOT EXISTS public.operator_ai_cost_model (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lovable_cost_per_1k_tokens numeric(10,6) NOT NULL DEFAULT 0.003,
  avg_tokens_per_nri_call integer NOT NULL DEFAULT 2000,
  avg_perplexity_cost_per_call numeric(10,6) NOT NULL DEFAULT 0.005,
  firecrawl_monthly_plan_cost numeric(10,2) NOT NULL DEFAULT 0,
  firecrawl_monthly_credit_pool integer NOT NULL DEFAULT 500,
  smoothing_window_days integer NOT NULL DEFAULT 7,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_ai_cost_model ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view cost model"
  ON public.operator_ai_cost_model FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Operators can update cost model"
  ON public.operator_ai_cost_model FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

INSERT INTO public.operator_ai_cost_model (id) VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- 5) Create operator_ai_events — audit log for governance actions
CREATE TABLE IF NOT EXISTS public.operator_ai_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  tenant_id uuid REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_operator_ai_event_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.event_type NOT IN (
    'deep_allowance_exhausted','nri_guard_exceeded','global_ceiling_warning',
    'force_essential_toggled','drift_paused','territory_crawl_paused',
    'tenant_boost','envelope_adjusted','fallback_activated','nri_usage_high',
    'upgrade_suggestion_triggered'
  ) THEN
    RAISE EXCEPTION 'Invalid operator_ai_events event_type: %', NEW.event_type;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_validate_operator_ai_event_type ON public.operator_ai_events;
CREATE TRIGGER trg_validate_operator_ai_event_type
  BEFORE INSERT OR UPDATE ON public.operator_ai_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_operator_ai_event_type();

ALTER TABLE public.operator_ai_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view AI events"
  ON public.operator_ai_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role inserts AI events"
  ON public.operator_ai_events FOR INSERT
  WITH CHECK (true);