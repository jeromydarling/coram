
-- ═══════════════════════════════════════════════════════
-- PHASE 7M: NARRATIVE FLYWHEEL HEALTH + NRI STORY SIGNALS
-- ═══════════════════════════════════════════════════════

-- 1) operator_schedules — tracks what should be running and when
CREATE TABLE public.operator_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('hourly','daily','weekly','manual')),
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz NULL,
  last_status text NULL CHECK (last_status IN ('ok','warning','error')),
  last_stats jsonb NOT NULL DEFAULT '{}',
  last_error jsonb NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operator_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read operator_schedules"
  ON public.operator_schedules FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

CREATE POLICY "Admin can update operator_schedules"
  ON public.operator_schedules FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- 2) system_health_events — append-only job execution log
CREATE TABLE public.system_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_key text NOT NULL,
  tenant_id uuid NULL REFERENCES public.tenants(id),
  metro_id uuid NULL REFERENCES public.metros(id),
  status text NOT NULL CHECK (status IN ('ok','warning','error')),
  stats jsonb NOT NULL DEFAULT '{}',
  error jsonb NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_she_key_occurred ON public.system_health_events (schedule_key, occurred_at DESC);
CREATE INDEX idx_she_tenant_occurred ON public.system_health_events (tenant_id, occurred_at DESC);
CREATE INDEX idx_she_metro_occurred ON public.system_health_events (metro_id, occurred_at DESC);

ALTER TABLE public.system_health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read system_health_events"
  ON public.system_health_events FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin']::app_role[]));

-- 3) nri_story_signals — gentle suggestions from rollups
CREATE TABLE public.nri_story_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  metro_id uuid NULL REFERENCES public.metros(id),
  opportunity_id uuid NULL REFERENCES public.opportunities(id),
  kind text NOT NULL CHECK (kind IN ('check_in','connection','heads_up','celebration')),
  title text NOT NULL,
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text NULL
);

CREATE UNIQUE INDEX idx_nri_dedupe ON public.nri_story_signals (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_nri_tenant_created ON public.nri_story_signals (tenant_id, created_at DESC);
CREATE INDEX idx_nri_metro_created ON public.nri_story_signals (metro_id, created_at DESC);

ALTER TABLE public.nri_story_signals ENABLE ROW LEVEL SECURITY;

-- Admin + leadership: tenant-scoped read
CREATE POLICY "Admin/leadership read nri_story_signals"
  ON public.nri_story_signals FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership','regional_lead']::app_role[])
    OR (
      EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = auth.uid() AND tu.tenant_id = nri_story_signals.tenant_id
      )
      AND (
        nri_story_signals.metro_id IS NULL
        OR public.has_metro_access(auth.uid(), nri_story_signals.metro_id)
      )
    )
  );

-- Seed operator_schedules with all known jobs
INSERT INTO public.operator_schedules (key, cadence, enabled) VALUES
  ('testimonium_rollup_weekly', 'weekly', true),
  ('operator_refresh_daily', 'daily', true),
  ('metro_narrative_build', 'weekly', true),
  ('metro_news_ingest_daily', 'daily', true),
  ('local_events_sweep_weekly', 'weekly', true),
  ('discovery_cron', 'daily', true),
  ('gmail_scheduled_sync', 'daily', true),
  ('archetype_simulate_tick', 'manual', true),
  ('nri_generate_signals_weekly', 'weekly', true);
