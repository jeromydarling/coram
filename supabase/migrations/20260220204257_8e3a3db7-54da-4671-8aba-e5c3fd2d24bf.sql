CREATE TABLE public.activation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchased_by uuid NULL REFERENCES auth.users(id),
  session_type text NOT NULL CHECK (session_type IN ('guided_activation','guided_activation_plus')),
  sessions_total int NOT NULL CHECK (sessions_total IN (1,2)),
  sessions_remaining int NOT NULL CHECK (sessions_remaining >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scheduled','completed','canceled')),
  requested_times text NULL,
  scheduled_at timestamptz NULL,
  duration_minutes int NOT NULL DEFAULT 90,
  meet_link text NULL,
  calendar_event_id text NULL,
  calendar_event_url text NULL,
  operator_notes text NULL,
  customer_notes text NULL,
  stripe_payment_intent_id text NULL,
  stripe_checkout_session_id text NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activation_sessions_tenant ON public.activation_sessions (tenant_id, purchased_at DESC);
CREATE INDEX idx_activation_sessions_status ON public.activation_sessions (status, purchased_at DESC);
CREATE UNIQUE INDEX idx_activation_sessions_checkout_unique 
  ON public.activation_sessions (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TRIGGER set_activation_sessions_updated_at
  BEFORE UPDATE ON public.activation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.activation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view own sessions"
  ON public.activation_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = activation_sessions.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can update scheduling request"
  ON public.activation_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = activation_sessions.tenant_id
        AND tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = activation_sessions.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all sessions"
  ON public.activation_sessions FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::public.app_role[])
  );