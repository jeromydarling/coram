
-- ═══════════════════════════════════════════════════
-- Phase 8D: Expansion Activation Layer
-- ═══════════════════════════════════════════════════

-- 1) metro_activation_states
CREATE TABLE public.metro_activation_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  metro_id uuid NOT NULL REFERENCES public.metros(id),
  activation_stage text NOT NULL DEFAULT 'considering'
    CHECK (activation_stage IN ('considering','scouting','first_presence','early_relationships','community_entry')),
  activated_at timestamptz NULL,
  last_activity_at timestamptz NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, metro_id)
);

CREATE INDEX idx_metro_activation_states_tenant ON public.metro_activation_states(tenant_id);
ALTER TABLE public.metro_activation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own activation states"
  ON public.metro_activation_states FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant members can insert own activation states"
  ON public.metro_activation_states FOR INSERT
  WITH CHECK (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant members can update own activation states"
  ON public.metro_activation_states FOR UPDATE
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Operators can view all activation states"
  ON public.metro_activation_states FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

-- 2) metro_activation_actions
CREATE TABLE public.metro_activation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  metro_id uuid NOT NULL REFERENCES public.metros(id),
  action_type text NOT NULL
    CHECK (action_type IN ('first_event_attended','first_partner_contact','first_reflection','local_meeting','community_research','email_introduction')),
  label text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_metro_activation_actions_tenant_metro ON public.metro_activation_actions(tenant_id, metro_id);
ALTER TABLE public.metro_activation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own activation actions"
  ON public.metro_activation_actions FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant members can insert own activation actions"
  ON public.metro_activation_actions FOR INSERT
  WITH CHECK (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant members can update own activation actions"
  ON public.metro_activation_actions FOR UPDATE
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Operators can view all activation actions"
  ON public.metro_activation_actions FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

-- 3) metro_activation_log
CREATE TABLE public.metro_activation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  metro_id uuid NOT NULL REFERENCES public.metros(id),
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_metro_activation_log_tenant_metro ON public.metro_activation_log(tenant_id, metro_id);
CREATE INDEX idx_metro_activation_log_created ON public.metro_activation_log(tenant_id, created_at DESC);
ALTER TABLE public.metro_activation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view own activation log"
  ON public.metro_activation_log FOR SELECT
  USING (public.user_in_tenant(tenant_id));

CREATE POLICY "Tenant members can insert own activation log"
  ON public.metro_activation_log FOR INSERT
  WITH CHECK (public.user_in_tenant(tenant_id));

CREATE POLICY "Operators can view all activation log"
  ON public.metro_activation_log FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

-- Updated_at trigger for activation states
CREATE TRIGGER set_metro_activation_states_updated_at
  BEFORE UPDATE ON public.metro_activation_states
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
