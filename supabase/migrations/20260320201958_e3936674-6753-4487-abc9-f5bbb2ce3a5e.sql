
-- SEC-008: Create phantom tables that are actively queried in the codebase

-- relatio_sync_config — stores per-tenant sync conflict resolution strategies
CREATE TABLE IF NOT EXISTS public.relatio_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_key text NOT NULL,
  conflict_resolution text NOT NULL DEFAULT 'manual',
  sync_direction text NOT NULL DEFAULT 'inbound',
  auto_sync_enabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_key)
);

ALTER TABLE public.relatio_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view sync configs"
  ON public.relatio_sync_config FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Tenant members can manage sync configs"
  ON public.relatio_sync_config FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()))
  WITH CHECK (public.is_tenant_member(tenant_id, auth.uid()));

-- qa_run_results — stores QA test run outcomes (operator-only)
CREATE TABLE IF NOT EXISTS public.qa_run_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id uuid,
  batch_id uuid,
  test_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  duration_ms integer,
  error_message text,
  screenshot_url text,
  step_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qa_run_results ENABLE ROW LEVEL SECURITY;

-- Only admins can read QA results (operator-only data)
CREATE POLICY "Admins can view QA results"
  ON public.qa_run_results FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- friction_events — behavioral friction signal tracking
CREATE TABLE IF NOT EXISTS public.friction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  page_path text,
  element_selector text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.friction_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view friction events"
  ON public.friction_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- tenant_add_ons — tracks add-on subscriptions per tenant
CREATE TABLE IF NOT EXISTS public.tenant_add_ons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  add_on_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  stripe_subscription_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, add_on_key)
);

ALTER TABLE public.tenant_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view add-ons"
  ON public.tenant_add_ons FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id, auth.uid()));

CREATE POLICY "Admins can manage add-ons"
  ON public.tenant_add_ons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
