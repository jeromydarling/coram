
-- ============================================================
-- PHASE 21AG: Multi-Gardener Assignment + Routing
-- ============================================================

-- 1. Gardeners table (id = user_id for simplicity)
CREATE TABLE IF NOT EXISTS public.gardeners (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_on_call boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gardeners ENABLE ROW LEVEL SECURITY;

-- Only gardeners (admin role) can read the roster
CREATE POLICY "Gardeners can read roster"
  ON public.gardeners FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Primary gardener can manage roster"
  ON public.gardeners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Gardener scopes (metro, archetype, specialty assignments)
CREATE TABLE IF NOT EXISTS public.gardener_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gardener_id uuid NOT NULL REFERENCES public.gardeners(id) ON DELETE CASCADE,
  scope_type text NOT NULL,  -- 'metro', 'archetype', 'specialty'
  scope_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gardener_id, scope_type, scope_key)
);

ALTER TABLE public.gardener_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can read scopes"
  ON public.gardener_scopes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Primary gardener can manage scopes"
  ON public.gardener_scopes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Validation trigger for scope_type
CREATE OR REPLACE FUNCTION public.validate_gardener_scope_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.scope_type NOT IN ('metro', 'archetype', 'specialty') THEN
    RAISE EXCEPTION 'Invalid gardener_scopes scope_type: %', NEW.scope_type;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_gardener_scope
  BEFORE INSERT OR UPDATE ON public.gardener_scopes
  FOR EACH ROW EXECUTE FUNCTION public.validate_gardener_scope_type();

-- 3. Tenant-gardener assignments
CREATE TABLE IF NOT EXISTS public.tenant_gardener_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  gardener_id uuid NOT NULL REFERENCES public.gardeners(id) ON DELETE CASCADE,
  assignment_type text NOT NULL DEFAULT 'primary',
  reason text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, gardener_id, assignment_type)
);

ALTER TABLE public.tenant_gardener_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can read assignments"
  ON public.tenant_gardener_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gardeners can manage assignments"
  ON public.tenant_gardener_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Validation trigger for assignment_type
CREATE OR REPLACE FUNCTION public.validate_gardener_assignment_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.assignment_type NOT IN ('primary', 'secondary', 'temporary') THEN
    RAISE EXCEPTION 'Invalid assignment_type: %', NEW.assignment_type;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_gardener_assignment
  BEFORE INSERT OR UPDATE ON public.tenant_gardener_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_gardener_assignment_type();

-- 4. Gardener notification settings
CREATE TABLE IF NOT EXISTS public.gardener_notification_settings (
  gardener_id uuid PRIMARY KEY REFERENCES public.gardeners(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  digest_enabled boolean NOT NULL DEFAULT true,
  digest_time_local text NOT NULL DEFAULT '08:00',
  notify_ticket_types text[] NOT NULL DEFAULT ARRAY['recovery','support','bug','feature'],
  notify_severity_min text NOT NULL DEFAULT 'medium',
  notify_on_assignment_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gardener_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can read own settings"
  ON public.gardener_notification_settings FOR SELECT TO authenticated
  USING (gardener_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gardeners can update own settings"
  ON public.gardener_notification_settings FOR UPDATE TO authenticated
  USING (gardener_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (gardener_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gardeners can insert own settings"
  ON public.gardener_notification_settings FOR INSERT TO authenticated
  WITH CHECK (gardener_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- Validation for severity min
CREATE OR REPLACE FUNCTION public.validate_gardener_notif_severity()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.notify_severity_min NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid notify_severity_min: %', NEW.notify_severity_min;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_validate_gardener_notif
  BEFORE INSERT OR UPDATE ON public.gardener_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_gardener_notif_severity();

-- 5. Add routing columns to recovery_tickets
ALTER TABLE public.recovery_tickets
  ADD COLUMN IF NOT EXISTS routed_to_gardener_ids uuid[],
  ADD COLUMN IF NOT EXISTS routing_reason text,
  ADD COLUMN IF NOT EXISTS routed_at timestamptz;

-- 6. Add routing columns to operator_notifications
ALTER TABLE public.operator_notifications
  ADD COLUMN IF NOT EXISTS routed_gardener_id uuid REFERENCES public.gardeners(id),
  ADD COLUMN IF NOT EXISTS routing_reason text;

-- 7. Gardener audit log for assignment changes
CREATE TABLE IF NOT EXISTS public.gardener_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_gardener_id uuid,
  target_tenant_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gardener_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can read audit log"
  ON public.gardener_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gardeners can write audit log"
  ON public.gardener_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Helper: find gardener for a tenant via routing ladder
CREATE OR REPLACE FUNCTION public.route_to_gardener(
  p_tenant_id uuid,
  p_ticket_type text DEFAULT 'support'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_gardener_id uuid;
  v_reason text;
  v_metro_id uuid;
  v_archetype text;
BEGIN
  -- Step 1: Explicit primary assignment
  SELECT gardener_id INTO v_gardener_id
  FROM tenant_gardener_assignments
  WHERE tenant_id = p_tenant_id
    AND assignment_type = 'primary'
    AND (ends_at IS NULL OR ends_at > now())
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_gardener_id IS NOT NULL THEN
    -- Verify gardener is active
    IF EXISTS (SELECT 1 FROM gardeners WHERE id = v_gardener_id AND is_active) THEN
      RETURN jsonb_build_object('gardener_id', v_gardener_id, 'reason', 'explicit_primary_assignment');
    END IF;
  END IF;

  -- Get tenant context
  SELECT t.metro_id, a.key INTO v_metro_id, v_archetype
  FROM tenants t
  LEFT JOIN archetypes a ON a.key = t.archetype
  WHERE t.id = p_tenant_id;

  -- Step 2: Metro match
  IF v_metro_id IS NOT NULL THEN
    SELECT gs.gardener_id INTO v_gardener_id
    FROM gardener_scopes gs
    JOIN gardeners g ON g.id = gs.gardener_id AND g.is_active
    WHERE gs.scope_type = 'metro' AND gs.scope_key = v_metro_id::text
    LIMIT 1;
    
    IF v_gardener_id IS NOT NULL THEN
      RETURN jsonb_build_object('gardener_id', v_gardener_id, 'reason', 'metro_scope_match');
    END IF;
  END IF;

  -- Step 3: Archetype match
  IF v_archetype IS NOT NULL THEN
    SELECT gs.gardener_id INTO v_gardener_id
    FROM gardener_scopes gs
    JOIN gardeners g ON g.id = gs.gardener_id AND g.is_active
    WHERE gs.scope_type = 'archetype' AND gs.scope_key = v_archetype
    LIMIT 1;
    
    IF v_gardener_id IS NOT NULL THEN
      RETURN jsonb_build_object('gardener_id', v_gardener_id, 'reason', 'archetype_scope_match');
    END IF;
  END IF;

  -- Step 4: On-call gardener
  SELECT id INTO v_gardener_id
  FROM gardeners WHERE is_on_call AND is_active
  LIMIT 1;
  
  IF v_gardener_id IS NOT NULL THEN
    RETURN jsonb_build_object('gardener_id', v_gardener_id, 'reason', 'on_call_fallback');
  END IF;

  -- Step 5: Primary gardener (final fallback)
  SELECT id INTO v_gardener_id
  FROM gardeners WHERE is_primary AND is_active
  LIMIT 1;
  
  IF v_gardener_id IS NOT NULL THEN
    RETURN jsonb_build_object('gardener_id', v_gardener_id, 'reason', 'primary_fallback');
  END IF;

  RETURN jsonb_build_object('gardener_id', null, 'reason', 'no_gardener_available');
END; $$;
