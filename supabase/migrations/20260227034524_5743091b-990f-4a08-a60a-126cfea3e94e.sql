
-- Part 9: Add date-part columns to life_events for birthday without year
ALTER TABLE public.life_events
  ADD COLUMN IF NOT EXISTS event_month int,
  ADD COLUMN IF NOT EXISTS event_day int,
  ADD COLUMN IF NOT EXISTS event_year int;

-- Part 11: Per-event notification/reminder overrides
ALTER TABLE public.life_events
  ADD COLUMN IF NOT EXISTS notify_enabled boolean,
  ADD COLUMN IF NOT EXISTS remind_enabled boolean,
  ADD COLUMN IF NOT EXISTS remind_at timestamptz,
  ADD COLUMN IF NOT EXISTS remind_rule text,
  ADD COLUMN IF NOT EXISTS last_reminded_at timestamptz;

-- Part 10: Tenant-level life event settings
CREATE TABLE IF NOT EXISTS public.tenant_life_event_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enable_life_event_notifications boolean NOT NULL DEFAULT false,
  enable_life_event_reminders boolean NOT NULL DEFAULT false,
  reminder_window_days int NOT NULL DEFAULT 7,
  default_notify_roles text[] NOT NULL DEFAULT '{steward,shepherd}',
  birthday_notify_roles text[] NOT NULL DEFAULT '{companion,shepherd}',
  sensitive_event_visibility_lock boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_life_event_settings ENABLE ROW LEVEL SECURITY;

-- Stewards can read/write their tenant's settings
CREATE POLICY "Tenant members can view life event settings"
  ON public.tenant_life_event_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_life_event_settings.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Stewards can manage life event settings"
  ON public.tenant_life_event_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.user_roles ur ON ur.user_id = tu.user_id
      WHERE tu.tenant_id = tenant_life_event_settings.tenant_id
        AND tu.user_id = auth.uid()
        AND ur.role = 'steward'
    )
  );

-- Validation trigger for remind_rule
CREATE OR REPLACE FUNCTION public.validate_life_event_remind_rule()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.remind_rule IS NOT NULL AND NEW.remind_rule NOT IN ('annual', 'monthly', 'once') THEN
    RAISE EXCEPTION 'Invalid remind_rule: %', NEW.remind_rule;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_life_event_remind_rule
  BEFORE INSERT OR UPDATE ON public.life_events
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_life_event_remind_rule();

-- Updated_at trigger for tenant settings
CREATE TRIGGER trg_tenant_life_event_settings_updated
  BEFORE UPDATE ON public.tenant_life_event_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_operator_notif_settings_timestamp();
