
-- ============================================================
-- PART 2: STRIPE BILLING TABLES
-- ============================================================

CREATE TABLE public.billing_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id text UNIQUE NOT NULL,
  stripe_price_id text UNIQUE NOT NULL,
  tier text NOT NULL,
  billing_interval text NOT NULL,
  base_price_cents int NOT NULL,
  included_users int NOT NULL DEFAULT 4,
  included_usage jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_billing_product()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tier NOT IN ('core', 'insight', 'story', 'bridge') THEN
    RAISE EXCEPTION 'Invalid billing tier: %', NEW.tier;
  END IF;
  IF NEW.billing_interval NOT IN ('month', 'year') THEN
    RAISE EXCEPTION 'Invalid billing interval: %', NEW.billing_interval;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_billing_product
  BEFORE INSERT OR UPDATE ON public.billing_products
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_product();

ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view billing products"
  ON public.billing_products FOR SELECT
  TO authenticated USING (true);

CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'inactive',
  current_period_end timestamptz NULL,
  seats int NOT NULL DEFAULT 4,
  usage_addons jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view subscription"
  ON public.tenant_subscriptions FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant admins can update subscription"
  ON public.tenant_subscriptions FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  openai_tokens bigint NOT NULL DEFAULT 0,
  firecrawl_pages int NOT NULL DEFAULT 0,
  n8n_runs int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start, period_end)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view usage"
  ON public.usage_counters FOR SELECT
  USING (public.user_in_tenant(tenant_id));

-- ============================================================
-- PART 3: FEATURE FLAG TABLES
-- ============================================================

CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view flags"
  ON public.feature_flags FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.feature_flags (key, description) VALUES
  ('impulsus', 'Private impact scrapbook journal'),
  ('testimonium', 'Narrative storytelling + insight layer'),
  ('relatio', 'Integrations + migration bridges'),
  ('signum', 'Signals & discovery intelligence'),
  ('civitas', 'Community layer (Metros, Local Pulse, Narrative)'),
  ('voluntarium', 'Volunteer management'),
  ('provisio', 'Technology provisions'),
  ('drift_detection', 'Drift detection system'),
  ('heatmap_overlays', 'Heat map narrative overlays'),
  ('story_signals', 'Story signal detection'),
  ('executive_storytelling', 'Executive storytelling tools'),
  ('narrative_exports', 'Narrative export capabilities'),
  ('crm_migration', 'CRM migration tools');

CREATE TABLE public.tenant_feature_flags (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, key)
);

ALTER TABLE public.tenant_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view flags"
  ON public.tenant_feature_flags FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage flags"
  ON public.tenant_feature_flags FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update flags"
  ON public.tenant_feature_flags FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

CREATE TABLE public.user_feature_overrides (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  PRIMARY KEY (tenant_id, user_id, key)
);

ALTER TABLE public.user_feature_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own overrides"
  ON public.user_feature_overrides FOR SELECT
  USING (user_id = auth.uid() AND public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant admins can manage overrides"
  ON public.user_feature_overrides FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update overrides"
  ON public.user_feature_overrides FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete overrides"
  ON public.user_feature_overrides FOR DELETE
  USING (public.is_tenant_admin(tenant_id));

-- ============================================================
-- PART 4: ARCHETYPES + ONBOARDING STATE
-- ============================================================

CREATE TABLE public.archetypes (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  default_tier text NOT NULL DEFAULT 'core',
  default_flags jsonb NOT NULL DEFAULT '{}',
  default_journey_stages jsonb NOT NULL DEFAULT '[]',
  default_keywords jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.archetypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view archetypes"
  ON public.archetypes FOR SELECT
  TO authenticated USING (true);

INSERT INTO public.archetypes (key, name, description, default_flags, default_journey_stages) VALUES
  ('church', 'Church / Faith Community', 'Faith-based community organizations', 
   '{"civitas": true, "voluntarium": true, "provisio": false, "signum": true, "testimonium": false}',
   '["Identified", "Contacted", "First Meeting", "Engaged", "Partner", "Advocate"]'),
  ('digital_inclusion', 'Digital Inclusion Nonprofit', 'Organizations bridging the digital divide',
   '{"civitas": true, "voluntarium": true, "provisio": true, "signum": true, "testimonium": false}',
   '["Target Identified", "Contacted", "Discovery Scheduled", "Discovery Held", "Proposal Sent", "Agreement Signed", "First Volume", "Stable Producer"]'),
  ('social_enterprise', 'Social Enterprise', 'Mission-driven businesses',
   '{"civitas": true, "voluntarium": false, "provisio": false, "signum": true, "testimonium": false}',
   '["Prospect", "Outreach", "Meeting", "Proposal", "Partnership", "Active"]'),
  ('workforce', 'Workforce Development Org', 'Workforce training and employment organizations',
   '{"civitas": true, "voluntarium": true, "provisio": true, "signum": true, "testimonium": false}',
   '["Identified", "Contacted", "Assessment", "Program Design", "Active Program", "Graduate Support"]'),
  ('refugee_support', 'Refugee Support Organization', 'Organizations supporting refugee communities',
   '{"civitas": true, "voluntarium": true, "provisio": true, "signum": true, "testimonium": false}',
   '["Referral", "Intake", "Assessment", "Service Plan", "Active Support", "Self-Sufficient"]'),
  ('education_access', 'Education Access Program', 'Programs increasing educational access',
   '{"civitas": true, "voluntarium": true, "provisio": true, "signum": true, "testimonium": false}',
   '["Identified", "Outreach", "Enrollment", "Active", "Graduating", "Alumni"]'),
  ('library_system', 'Library System', 'Public library systems and branches',
   '{"civitas": true, "voluntarium": true, "provisio": true, "signum": true, "testimonium": false}',
   '["Identified", "Contacted", "Tour/Demo", "Pilot", "Active Branch", "Expanding"]');

CREATE TABLE public.tenant_onboarding_state (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  completed boolean NOT NULL DEFAULT false,
  step text NOT NULL DEFAULT 'start',
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_onboarding_updated_at
  BEFORE UPDATE ON public.tenant_onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tenant_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view onboarding"
  ON public.tenant_onboarding_state FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant admins can update onboarding"
  ON public.tenant_onboarding_state FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can insert onboarding"
  ON public.tenant_onboarding_state FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

-- ============================================================
-- PART 5: IMPORT/LINEAGE TABLES
-- ============================================================

CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_system text NOT NULL,
  source_label text,
  status text NOT NULL DEFAULT 'running',
  stats jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_import_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source_system NOT IN ('profunda', 'hubspot', 'salesforce', 'csv', 'manual') THEN
    RAISE EXCEPTION 'Invalid import source: %', NEW.source_system;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_import_source
  BEFORE INSERT OR UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.validate_import_source();

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view import batches"
  ON public.import_batches FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant admins can create import batches"
  ON public.import_batches FOR INSERT
  WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update import batches"
  ON public.import_batches FOR UPDATE
  USING (public.is_tenant_admin(tenant_id));

-- New CROS import mappings (separate from existing Profunda import_mappings)
CREATE TABLE public.cros_import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
  entity text NOT NULL,
  source_id text NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, entity, source_id)
);

ALTER TABLE public.cros_import_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewable via batch tenant"
  ON public.cros_import_mappings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.import_batches b
    WHERE b.id = batch_id AND public.user_in_tenant(b.tenant_id)
  ));

-- ============================================================
-- PART 6: SYSTEM SWEEP LOG
-- ============================================================

CREATE TABLE public.system_sweep_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  period_start timestamptz,
  period_end timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}',
  last_run_at timestamptz,
  status text NOT NULL DEFAULT 'ok',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_sweep_log()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind NOT IN ('signum_ingest', 'local_events_crawl', 'metro_narrative_build', 'drift_detection', 'email_sync', 'calendar_sync') THEN
    RAISE EXCEPTION 'Invalid sweep kind: %', NEW.kind;
  END IF;
  IF NEW.status NOT IN ('ok', 'warning', 'error') THEN
    RAISE EXCEPTION 'Invalid sweep status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sweep_log
  BEFORE INSERT OR UPDATE ON public.system_sweep_log
  FOR EACH ROW EXECUTE FUNCTION public.validate_sweep_log();

ALTER TABLE public.system_sweep_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can view sweep logs"
  ON public.system_sweep_log FOR SELECT
  USING (
    (tenant_id IS NULL AND public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]))
    OR public.is_tenant_admin(tenant_id)
  );
