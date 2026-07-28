
-- ══════════════════════════════════════════════════════════════════
-- Phase 7: Capacity Upgrades — Entitlements, Usage, Audit, Catalog
-- ══════════════════════════════════════════════════════════════════

-- 1) tenant_entitlements — cached subscription entitlements per tenant
CREATE TABLE public.tenant_entitlements (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_key text NOT NULL DEFAULT 'core',
  included_users int NOT NULL DEFAULT 3,
  addon_users int NOT NULL DEFAULT 0,
  ai_tier text NOT NULL DEFAULT 'base',
  local_pulse_tier text NOT NULL DEFAULT 'base',
  nri_tier text NOT NULL DEFAULT 'standard',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_status text NOT NULL DEFAULT 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tenant_entitlements_customer ON public.tenant_entitlements(stripe_customer_id);
CREATE INDEX idx_tenant_entitlements_sub ON public.tenant_entitlements(stripe_subscription_id);
CREATE INDEX idx_tenant_entitlements_status ON public.tenant_entitlements(stripe_status);

ALTER TABLE public.tenant_entitlements ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own entitlements
CREATE POLICY "tenant_read_own_entitlements" ON public.tenant_entitlements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_entitlements.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Operators (admins) can read all
CREATE POLICY "admin_read_all_entitlements" ON public.tenant_entitlements
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_tenant_entitlements_updated_at
  BEFORE UPDATE ON public.tenant_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) tenant_usage_counters — monthly windowed usage tracking
CREATE TABLE public.tenant_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  ai_calls int NOT NULL DEFAULT 0,
  ai_tokens int NOT NULL DEFAULT 0,
  pulse_articles_ingested int NOT NULL DEFAULT 0,
  pulse_runs int NOT NULL DEFAULT 0,
  nri_rollups_run int NOT NULL DEFAULT 0,
  nri_flags_emitted int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, period_start)
);

ALTER TABLE public.tenant_usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_own_usage" ON public.tenant_usage_counters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_usage_counters.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_read_all_usage" ON public.tenant_usage_counters
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 3) tenant_entitlement_audit — change log
CREATE TABLE public.tenant_entitlement_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor text NOT NULL DEFAULT 'stripe_webhook',
  event_type text NOT NULL,
  before jsonb NOT NULL DEFAULT '{}',
  after jsonb NOT NULL DEFAULT '{}',
  stripe_event_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_entitlement_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_entitlement_audit" ON public.tenant_entitlement_audit
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 4) stripe_catalog_cache — lookup_key → price mapping
CREATE TABLE public.stripe_catalog_cache (
  lookup_key text PRIMARY KEY,
  price_id text NOT NULL,
  product_id text NOT NULL,
  active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.stripe_catalog_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_stripe_catalog" ON public.stripe_catalog_cache
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_stripe_catalog_updated_at
  BEFORE UPDATE ON public.stripe_catalog_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) stripe_webhook_events — idempotency tracking
CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_webhook_events" ON public.stripe_webhook_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Seed catalog cache with current products and add-ons
INSERT INTO public.stripe_catalog_cache (lookup_key, price_id, product_id) VALUES
  ('cros_core', 'price_1T2YSYRwrJkY2JxXVot6yfMV', 'prod_U0ZblmvjgxUeUi'),
  ('cros_insight', 'price_1T2YSqRwrJkY2JxXxZSG5ipV', 'prod_U0Zc9AbBqwKD0u'),
  ('cros_story', 'price_1T2YSsRwrJkY2JxXGBcdiY57', 'prod_U0Zca1VMYeBF3o'),
  ('cros_bridge', 'price_1T2YStRwrJkY2JxXVZ0x0nnf', 'prod_U0Zcx0zjAS2j3c'),
  ('cros_addon_additional_users', 'price_1T2ujtRwrJkY2JxXsrxbfVXZ', 'prod_U0wdg9CfDVL9m4'),
  ('cros_addon_expanded_ai', 'price_1T2ujuRwrJkY2JxXfj9iw1Nz', 'prod_U0wducfTEgYHuc'),
  ('cros_addon_expanded_local_pulse', 'price_1T2ujwRwrJkY2JxXvIrddajT', 'prod_U0wd0wBVdPxRoz'),
  ('cros_addon_advanced_nri', 'price_1T2ujxRwrJkY2JxXIZQqwYeu', 'prod_U0wdLzCrYzyesT')
ON CONFLICT (lookup_key) DO UPDATE SET price_id = EXCLUDED.price_id, product_id = EXCLUDED.product_id;
