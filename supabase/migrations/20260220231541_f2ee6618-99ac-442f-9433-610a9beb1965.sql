
-- ══════════════════════════════════════════════════════════════════
-- Phase 8E+: tenant_user_lenses, tenant_settings, referral tables
-- ══════════════════════════════════════════════════════════════════

-- 1) tenant_user_lenses — Tenant-scoped experience lens (dual-write with profiles.ministry_role)
CREATE TABLE public.tenant_user_lenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lens text NOT NULL DEFAULT 'shepherd' CHECK (lens IN ('steward','shepherd','companion','visitor')),
  full_workspace_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_user_lenses ENABLE ROW LEVEL SECURITY;

-- Users can read their own lens
CREATE POLICY "users_read_own_lens" ON public.tenant_user_lenses
  FOR SELECT USING (user_id = auth.uid());

-- Steward/admin can read all lenses in their tenant
CREATE POLICY "steward_read_tenant_lenses" ON public.tenant_user_lenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_user_lenses.tenant_id
        AND tu.user_id = auth.uid()
    )
    AND public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[])
  );

-- Steward/admin can insert/update lenses for their tenant members
CREATE POLICY "steward_manage_tenant_lenses" ON public.tenant_user_lenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_user_lenses.tenant_id
        AND tu.user_id = auth.uid()
    )
    AND public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[])
  );

CREATE POLICY "steward_update_tenant_lenses" ON public.tenant_user_lenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_user_lenses.tenant_id
        AND tu.user_id = auth.uid()
    )
    AND public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[])
  );

-- Operators can read all
CREATE POLICY "operator_read_all_lenses" ON public.tenant_user_lenses
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_tenant_user_lenses_updated
  BEFORE UPDATE ON public.tenant_user_lenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) tenant_settings — Per-tenant defaults for lens, view mode, calm mode
CREATE TABLE public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  default_lens text NOT NULL DEFAULT 'shepherd' CHECK (default_lens IN ('steward','shepherd','companion','visitor')),
  default_view_mode text NOT NULL DEFAULT 'guided' CHECK (default_view_mode IN ('guided','full')),
  calm_mode_default boolean NOT NULL DEFAULT true,
  allow_full_workspace_toggle boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Tenant members can read
CREATE POLICY "tenant_members_read_settings" ON public.tenant_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_settings.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Steward/admin can update
CREATE POLICY "steward_update_settings" ON public.tenant_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_settings.tenant_id
        AND tu.user_id = auth.uid()
    )
    AND public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[])
  );

-- Steward/admin can insert (onboarding)
CREATE POLICY "steward_insert_settings" ON public.tenant_settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_settings.tenant_id
        AND tu.user_id = auth.uid()
    )
    AND public.has_any_role(auth.uid(), ARRAY['admin','steward']::app_role[])
  );

-- Operators can read all
CREATE POLICY "operator_read_all_settings" ON public.tenant_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_tenant_settings_updated
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) operator_referrals — Referral link codes for operator growth tracking
CREATE TABLE public.operator_referrals (
  code text PRIMARY KEY,
  operator_user_id uuid NOT NULL REFERENCES auth.users(id),
  campaign_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_referrals" ON public.operator_referrals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 4) tenant_referral_attribution — Track which referral led to tenant signup
CREATE TABLE public.tenant_referral_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referral_code text NOT NULL REFERENCES public.operator_referrals(code),
  first_touch_at timestamptz NOT NULL DEFAULT now(),
  last_touch_at timestamptz NOT NULL DEFAULT now(),
  attribution jsonb DEFAULT '{}'::jsonb,
  UNIQUE(tenant_id)
);

ALTER TABLE public.tenant_referral_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_attribution" ON public.tenant_referral_attribution
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Tenant stewards can read their own attribution
CREATE POLICY "steward_read_own_attribution" ON public.tenant_referral_attribution
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_referral_attribution.tenant_id
        AND tu.user_id = auth.uid()
    )
  );
