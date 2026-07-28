
-- operator_presence_rollups: weekly aggregation per tenant/metro
CREATE TABLE public.operator_presence_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  metro_id uuid NULL REFERENCES public.metros(id) ON DELETE SET NULL,
  visit_notes_count int NOT NULL DEFAULT 0,
  visit_notes_voice_count int NOT NULL DEFAULT 0,
  visit_notes_typed_count int NOT NULL DEFAULT 0,
  visit_notes_with_audio_retained_count int NOT NULL DEFAULT 0,
  unique_opportunities_touched int NOT NULL DEFAULT 0,
  unique_users_contributed int NOT NULL DEFAULT 0,
  last_activity_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_presence_rollups_unique ON public.operator_presence_rollups (tenant_id, week_start, COALESCE(metro_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_presence_rollups_tenant_week ON public.operator_presence_rollups (tenant_id, week_start DESC);
CREATE INDEX idx_presence_rollups_tenant_activity ON public.operator_presence_rollups (tenant_id, last_activity_at DESC);

ALTER TABLE public.operator_presence_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read operator_presence_rollups"
  ON public.operator_presence_rollups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert operator_presence_rollups"
  ON public.operator_presence_rollups FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update operator_presence_rollups"
  ON public.operator_presence_rollups FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- operator_presence_signals: deterministic interpretations
CREATE TABLE public.operator_presence_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_presence_signals
  ADD CONSTRAINT chk_signal_type CHECK (signal_type IN ('voice_first','typed_first','presence_rising','presence_falling','low_followup_risk','healthy_cadence'));

ALTER TABLE public.operator_presence_signals
  ADD CONSTRAINT chk_severity CHECK (severity IN ('low','medium','high'));

CREATE UNIQUE INDEX idx_presence_signals_unique ON public.operator_presence_signals (tenant_id, week_start, signal_type);
CREATE INDEX idx_presence_signals_tenant_week ON public.operator_presence_signals (tenant_id, week_start DESC);

ALTER TABLE public.operator_presence_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read operator_presence_signals"
  ON public.operator_presence_signals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin insert operator_presence_signals"
  ON public.operator_presence_signals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update operator_presence_signals"
  ON public.operator_presence_signals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
