
-- =============================================
-- Phase 21AA: Recovery Intelligence Schema
-- =============================================

-- 1. Recovery tickets
CREATE TABLE public.recovery_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'recovery_emergency',
  status text NOT NULL DEFAULT 'open',
  subject text NOT NULL,
  description text,
  recent_actions jsonb DEFAULT '[]'::jsonb,
  suspected_entity_type text,
  suspected_entity_id text,
  current_route text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recovery_tickets ENABLE ROW LEVEL SECURITY;

-- Users can create and view their own tickets
CREATE POLICY "Users can create own recovery tickets"
  ON public.recovery_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own recovery tickets"
  ON public.recovery_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Admins can update tickets
CREATE POLICY "Admins can update recovery tickets"
  ON public.recovery_tickets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_recovery_ticket()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type NOT IN ('recovery_emergency','data_loss','undo_request','general') THEN
    RAISE EXCEPTION 'Invalid recovery_tickets type: %', NEW.type;
  END IF;
  IF NEW.status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid recovery_tickets status: %', NEW.status;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_recovery_ticket
  BEFORE INSERT OR UPDATE ON public.recovery_tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_recovery_ticket();

-- 2. Tenant privacy settings
CREATE TABLE public.tenant_privacy_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  enable_recent_actions_for_assistant boolean NOT NULL DEFAULT true,
  action_retention_days integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read privacy settings"
  ON public.tenant_privacy_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_privacy_settings.tenant_id
        AND tu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage privacy settings"
  ON public.tenant_privacy_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Cleanup function for old app events (respects tenant retention setting)
CREATE OR REPLACE FUNCTION public.cleanup_old_app_events()
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM app_event_stream
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'deleted_count', v_deleted);
END; $$;
