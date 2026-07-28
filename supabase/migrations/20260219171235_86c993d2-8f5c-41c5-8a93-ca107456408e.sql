
-- ============================================
-- Phase 7G: Testimonium Witness Spine tables
-- ============================================

-- 1) testimonium_events — central narrative telemetry log
CREATE TABLE public.testimonium_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NULL,
  opportunity_id uuid NULL,
  metro_id uuid NULL,
  source_module text NOT NULL CHECK (source_module IN (
    'impulsus', 'journey', 'email', 'campaign', 'event',
    'voluntarium', 'provisio', 'migration', 'demo_lab',
    'local_pulse', 'news_ingest'
  )),
  event_kind text NOT NULL,
  signal_weight int NOT NULL DEFAULT 1,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_testimonium_events_tenant_occurred ON public.testimonium_events (tenant_id, occurred_at DESC);
CREATE INDEX idx_testimonium_events_opportunity ON public.testimonium_events (opportunity_id, occurred_at DESC);
CREATE INDEX idx_testimonium_events_metro ON public.testimonium_events (metro_id, occurred_at DESC);

ALTER TABLE public.testimonium_events ENABLE ROW LEVEL SECURITY;

-- Admin/leadership can read
CREATE POLICY "testimonium_events_select"
  ON public.testimonium_events FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  );

-- Insert via service role or admin hooks
CREATE POLICY "testimonium_events_insert"
  ON public.testimonium_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2) testimonium_rollups — weekly aggregation
CREATE TABLE public.testimonium_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  metro_id uuid NULL,
  reflection_count int NOT NULL DEFAULT 0,
  email_touch_count int NOT NULL DEFAULT 0,
  event_presence_count int NOT NULL DEFAULT 0,
  journey_moves int NOT NULL DEFAULT 0,
  volunteer_activity int NOT NULL DEFAULT 0,
  provisions_created int NOT NULL DEFAULT 0,
  migration_activity int NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, week_start, metro_id)
);

ALTER TABLE public.testimonium_rollups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonium_rollups_select"
  ON public.testimonium_rollups FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  );

CREATE POLICY "testimonium_rollups_insert"
  ON public.testimonium_rollups FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "testimonium_rollups_update"
  ON public.testimonium_rollups FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
  );

-- 3) testimonium_flags — gentle narrative signals
CREATE TABLE public.testimonium_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metro_id uuid NULL,
  flag_type text NOT NULL CHECK (flag_type IN ('momentum', 'drift', 'reconnection', 'growth')),
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.testimonium_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonium_flags_select"
  ON public.testimonium_flags FOR SELECT TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin', 'leadership']::app_role[])
  );

CREATE POLICY "testimonium_flags_insert"
  ON public.testimonium_flags FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );
