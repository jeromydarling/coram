
-- ═══════════════════════════════════════════════════════════
-- PHASE 7P: OPERATOR ADOPTION + JOB HEALTH + VALUE MOMENTS
-- ═══════════════════════════════════════════════════════════

-- 1) operator_adoption_daily
CREATE TABLE IF NOT EXISTS public.operator_adoption_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date date NOT NULL,
  users_active int NOT NULL DEFAULT 0,
  actions_logged int NOT NULL DEFAULT 0,
  reflections_created int NOT NULL DEFAULT 0,
  emails_synced int NOT NULL DEFAULT 0,
  campaign_touches int NOT NULL DEFAULT 0,
  signum_articles_ingested int NOT NULL DEFAULT 0,
  events_added int NOT NULL DEFAULT 0,
  voluntarium_hours_logged int NOT NULL DEFAULT 0,
  provisio_created int NOT NULL DEFAULT 0,
  nri_suggestions_created int NOT NULL DEFAULT 0,
  nri_suggestions_accepted int NOT NULL DEFAULT 0,
  communio_shared_signals int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, date)
);

ALTER TABLE public.operator_adoption_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_operator_adoption_daily" ON public.operator_adoption_daily
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert_operator_adoption_daily" ON public.operator_adoption_daily
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_operator_adoption_daily" ON public.operator_adoption_daily
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_operator_adoption_daily" ON public.operator_adoption_daily
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2) operator_adoption_weekly
CREATE TABLE IF NOT EXISTS public.operator_adoption_weekly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  adoption_score int NOT NULL DEFAULT 0,
  adoption_label text NOT NULL DEFAULT 'quiet' CHECK (adoption_label IN ('quiet','warming','active','thriving')),
  narrative jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, week_start)
);

ALTER TABLE public.operator_adoption_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_operator_adoption_weekly" ON public.operator_adoption_weekly
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert_operator_adoption_weekly" ON public.operator_adoption_weekly
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_operator_adoption_weekly" ON public.operator_adoption_weekly
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_operator_adoption_weekly" ON public.operator_adoption_weekly
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) operator_job_health
CREATE TABLE IF NOT EXISTS public.operator_job_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_key text NOT NULL,
  cadence text NOT NULL CHECK (cadence IN ('hourly','daily','weekly')),
  last_run_at timestamptz NULL,
  last_ok_at timestamptz NULL,
  last_status text NOT NULL DEFAULT 'ok' CHECK (last_status IN ('ok','warning','error')),
  last_stats jsonb NOT NULL DEFAULT '{}',
  last_error jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, job_key)
);

-- Index for NULL tenant_id (global jobs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_operator_job_health_global
  ON public.operator_job_health (job_key) WHERE tenant_id IS NULL;

ALTER TABLE public.operator_job_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_operator_job_health" ON public.operator_job_health
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert_operator_job_health" ON public.operator_job_health
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_operator_job_health" ON public.operator_job_health
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_operator_job_health" ON public.operator_job_health
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4) operator_value_moments
CREATE TABLE IF NOT EXISTS public.operator_value_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  moment_type text NOT NULL CHECK (moment_type IN (
    'nri_action_taken','reconnection','partner_found','event_attended',
    'volunteer_returned','provisio_fulfilled','migration_success'
  )),
  summary text NOT NULL,
  pointers jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operator_value_moments_tenant
  ON public.operator_value_moments (tenant_id, occurred_at DESC);

ALTER TABLE public.operator_value_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_operator_value_moments" ON public.operator_value_moments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_insert_operator_value_moments" ON public.operator_value_moments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_update_operator_value_moments" ON public.operator_value_moments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_delete_operator_value_moments" ON public.operator_value_moments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seed global job health entries
INSERT INTO public.operator_job_health (tenant_id, job_key, cadence) VALUES
  (NULL, 'testimonium-rollup-weekly', 'weekly'),
  (NULL, 'nri-generate-signals-weekly', 'weekly'),
  (NULL, 'operator-refresh-daily', 'daily'),
  (NULL, 'operator-adoption-refresh', 'daily'),
  (NULL, 'metro-narrative-build', 'weekly'),
  (NULL, 'discovery-cron', 'weekly'),
  (NULL, 'gmail-sync-daily', 'daily'),
  (NULL, 'signum-ingest-weekly', 'weekly'),
  (NULL, 'local-events-sweep-weekly', 'weekly')
ON CONFLICT DO NOTHING;
