
-- ============================================================
-- PART 1: outlook_connections
-- ============================================================
CREATE TABLE public.outlook_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email_address text NOT NULL,
  tenant_domain text NULL,
  connection_status text NOT NULL DEFAULT 'connected'
    CHECK (connection_status IN ('connected','expired','error')),
  scopes text[] NOT NULL DEFAULT '{}',
  last_sync_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_outlook_connections_tenant ON public.outlook_connections (tenant_id);
CREATE INDEX idx_outlook_connections_email ON public.outlook_connections (email_address);

ALTER TABLE public.outlook_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outlook connections"
  ON public.outlook_connections FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert own outlook connections"
  ON public.outlook_connections FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own outlook connections"
  ON public.outlook_connections FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete own outlook connections"
  ON public.outlook_connections FOR DELETE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_outlook_connections_updated_at
  BEFORE UPDATE ON public.outlook_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PART 2: email_send_limits
-- ============================================================
CREATE TABLE public.email_send_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gmail','outlook')),
  email_address text NOT NULL,
  daily_limit int NOT NULL DEFAULT 300,
  soft_limit int NOT NULL DEFAULT 60,
  hard_limit int NOT NULL DEFAULT 85,
  current_count int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT date_trunc('day', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider, email_address)
);

ALTER TABLE public.email_send_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view send limits"
  ON public.email_send_limits FOR SELECT
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin']::app_role[])
    OR public.user_in_tenant(email_send_limits.tenant_id)
  );

CREATE POLICY "Admins manage send limits"
  ON public.email_send_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- PART 3: Add provider column to email_campaign_events
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_campaign_events' AND column_name = 'provider'
  ) THEN
    ALTER TABLE public.email_campaign_events ADD COLUMN provider text DEFAULT 'gmail';
    ALTER TABLE public.email_campaign_events ADD CONSTRAINT chk_provider CHECK (provider IN ('gmail','outlook'));
  END IF;
END$$;

-- ============================================================
-- PART 4: Server-side feature gate function
-- ============================================================
CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tier text;
  v_flag_override boolean;
  v_core_features text[] := ARRAY['relationships','journey','reflections','signum_baseline','provisio','events','voluntarium_basic','basic_narrative','civitas'];
  v_insight_features text[] := ARRAY['testimonium','drift_detection','momentum_map_overlays','story_signals','ingestion_confidence'];
  v_story_features text[] := ARRAY['impulsus','exec_exports','narrative_reporting'];
  v_bridge_features text[] := ARRAY['relatio_marketplace','crm_migrations','hubspot_two_way','communio_opt_in','outreach_campaigns'];
  v_all_features text[];
  v_plan_index int;
  v_plans text[] := ARRAY['core','insight','story','bridge'];
BEGIN
  SELECT enabled INTO v_flag_override
  FROM tenant_feature_flags
  WHERE tenant_id = p_tenant_id AND feature_key = p_feature_key
  LIMIT 1;
  
  IF v_flag_override IS NOT NULL THEN
    RETURN v_flag_override;
  END IF;

  SELECT COALESCE(tier, 'core') INTO v_tier FROM tenants WHERE id = p_tenant_id;
  
  v_plan_index := array_position(v_plans, v_tier);
  IF v_plan_index IS NULL THEN v_plan_index := 1; END IF;
  
  v_all_features := v_core_features;
  IF v_plan_index >= 2 THEN v_all_features := v_all_features || v_insight_features; END IF;
  IF v_plan_index >= 3 THEN v_all_features := v_all_features || v_story_features; END IF;
  IF v_plan_index >= 4 THEN v_all_features := v_all_features || v_bridge_features; END IF;
  
  RETURN p_feature_key = ANY(v_all_features);
END;
$$;
