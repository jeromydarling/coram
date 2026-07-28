
-- Prōvīsiō Evolution: tenant_provision_settings
-- Tracks provision mode per tenant (care / stewardship / enterprise)

CREATE TABLE public.tenant_provision_settings (
  tenant_id UUID NOT NULL PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'care',
  catalog_enabled BOOLEAN NOT NULL DEFAULT false,
  pricing_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for mode
CREATE OR REPLACE FUNCTION public.validate_provision_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.mode NOT IN ('care', 'stewardship', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid provision mode: %', NEW.mode;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_provision_mode
  BEFORE INSERT OR UPDATE ON public.tenant_provision_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_provision_mode();

-- Auto-update timestamp
CREATE TRIGGER trg_provision_settings_updated_at
  BEFORE UPDATE ON public.tenant_provision_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_operator_notif_settings_timestamp();

-- Enable RLS
ALTER TABLE public.tenant_provision_settings ENABLE ROW LEVEL SECURITY;

-- Tenant members can read their own settings
CREATE POLICY "Tenant members can read provision settings"
  ON public.tenant_provision_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = tenant_provision_settings.tenant_id AND tu.user_id = auth.uid()
  ));

-- Tenant admins can insert/update their own settings
CREATE POLICY "Tenant admins can manage provision settings"
  ON public.tenant_provision_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = tenant_provision_settings.tenant_id AND tu.user_id = auth.uid() AND tu.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = tenant_provision_settings.tenant_id AND tu.user_id = auth.uid() AND tu.role = 'admin'
  ));

-- Admin (operator) full access
CREATE POLICY "Operators can manage all provision settings"
  ON public.tenant_provision_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
