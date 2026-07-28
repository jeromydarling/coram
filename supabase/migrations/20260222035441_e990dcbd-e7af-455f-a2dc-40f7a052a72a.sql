
-- Living System Signals table
CREATE TABLE public.living_system_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  signal_type text NOT NULL,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_by_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
);

-- Validation trigger for signal_type
CREATE OR REPLACE FUNCTION public.validate_living_signal_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.signal_type NOT IN (
    'reflection_moment', 'community_growth', 'adoption_support_needed',
    'collaboration_movement', 'visitor_voice_pattern'
  ) THEN
    RAISE EXCEPTION 'Invalid living_system_signals signal_type: %', NEW.signal_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_living_signal_type
  BEFORE INSERT OR UPDATE ON public.living_system_signals
  FOR EACH ROW EXECUTE FUNCTION public.validate_living_signal_type();

-- Indexes
CREATE INDEX idx_living_signals_tenant ON public.living_system_signals(tenant_id);
CREATE INDEX idx_living_signals_type ON public.living_system_signals(signal_type);
CREATE INDEX idx_living_signals_created ON public.living_system_signals(created_at DESC);

-- RLS
ALTER TABLE public.living_system_signals ENABLE ROW LEVEL SECURITY;

-- Tenant users can read their own signals
CREATE POLICY "Tenant users can read own signals"
  ON public.living_system_signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = living_system_signals.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Tenant users can update (dismiss) their own signals
CREATE POLICY "Tenant users can dismiss own signals"
  ON public.living_system_signals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = living_system_signals.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

-- Admins (operator) can read all
CREATE POLICY "Admins can read all living signals"
  ON public.living_system_signals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role insert (via edge function)
CREATE POLICY "Service role can insert living signals"
  ON public.living_system_signals FOR INSERT
  WITH CHECK (true);
