
-- ============================================================
-- SYSTEM SWEEP: Tables for admin observability
-- ============================================================

-- 1) system_jobs: canonical list of scheduled processes
CREATE TABLE public.system_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  owner text NOT NULL DEFAULT 'supabase' CHECK (owner IN ('supabase','n8n','manual')),
  schedule text NOT NULL,
  rrule text NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_jobs_select_admin_leadership"
  ON public.system_jobs FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

CREATE POLICY "system_jobs_insert_admin"
  ON public.system_jobs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "system_jobs_update_admin"
  ON public.system_jobs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "system_jobs_delete_admin"
  ON public.system_jobs FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_system_jobs_updated_at
  BEFORE UPDATE ON public.system_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) system_job_runs: execution log
CREATE TABLE public.system_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL REFERENCES public.system_jobs(key) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('system','metro','opportunity','user')),
  metro_id uuid NULL,
  opportunity_id uuid NULL,
  user_id uuid NULL,
  status text NOT NULL CHECK (status IN ('running','completed','failed','partial')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  duration_ms int NULL,
  stats jsonb NOT NULL DEFAULT '{}',
  outputs jsonb NOT NULL DEFAULT '{}',
  errors jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_job_runs_key_started ON public.system_job_runs (job_key, started_at DESC);
CREATE INDEX idx_system_job_runs_metro ON public.system_job_runs (metro_id, started_at DESC);
CREATE INDEX idx_system_job_runs_status ON public.system_job_runs (status, started_at DESC);

ALTER TABLE public.system_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_job_runs_select_admin_leadership"
  ON public.system_job_runs FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

-- INSERT/UPDATE for service role handled by default (no policy = deny for non-service-role)
-- Admin can also insert for manual runs
CREATE POLICY "system_job_runs_insert_admin"
  ON public.system_job_runs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "system_job_runs_update_admin"
  ON public.system_job_runs FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) system_suggestions: the suggestion ledger
CREATE TABLE public.system_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  scope text NOT NULL CHECK (scope IN ('metro','opportunity','person','org')),
  metro_id uuid NULL,
  opportunity_id uuid NULL,
  person_id uuid NULL,
  suggestion_type text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  rationale jsonb NOT NULL DEFAULT '{}',
  confidence int NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  source_refs jsonb NOT NULL DEFAULT '[]',
  audience jsonb NOT NULL DEFAULT '{}',
  delivered_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  acted_at timestamptz NULL,
  action_taken text NULL,
  dedupe_key text NULL
);

CREATE INDEX idx_system_suggestions_created ON public.system_suggestions (created_at DESC);
CREATE INDEX idx_system_suggestions_metro ON public.system_suggestions (metro_id, created_at DESC);
CREATE INDEX idx_system_suggestions_opp ON public.system_suggestions (opportunity_id, created_at DESC);
CREATE UNIQUE INDEX idx_system_suggestions_dedupe ON public.system_suggestions (dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.system_suggestions ENABLE ROW LEVEL SECURITY;

-- Admin/leadership see all
CREATE POLICY "system_suggestions_select_admin_leadership"
  ON public.system_suggestions FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[]));

-- Regional leads / staff see suggestions in their metros
CREATE POLICY "system_suggestions_select_metro_access"
  ON public.system_suggestions FOR SELECT
  USING (
    metro_id IS NOT NULL
    AND public.has_metro_access(auth.uid(), metro_id)
    AND NOT public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
  );

-- INSERT: admin only (service role bypasses RLS)
CREATE POLICY "system_suggestions_insert_admin"
  ON public.system_suggestions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- UPDATE: users can dismiss/act on suggestions they can see
CREATE POLICY "system_suggestions_update_own"
  ON public.system_suggestions FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['admin','leadership']::app_role[])
    OR (metro_id IS NOT NULL AND public.has_metro_access(auth.uid(), metro_id))
  );

-- ============================================================
-- SEED: Known scheduled jobs
-- ============================================================
INSERT INTO public.system_jobs (key, name, description, owner, schedule) VALUES
  ('metro_news_ingest', 'Metro News Ingest', 'Crawls news sources and persists articles for each metro', 'supabase', 'Weekly — Mondays 8:00 AM'),
  ('local_pulse_events', 'Local Pulse Event Discovery', 'Discovers and imports community events from configured sources per metro', 'n8n', 'Weekly — Mondays 6:00 AM'),
  ('metro_narrative_build', 'Metro Narrative Build', 'Generates metro narratives from news, reflections, and relationship data', 'supabase', 'Weekly — Mondays 10:00 AM'),
  ('drift_detection', 'Drift Detection', 'Computes thematic drift scores across metros', 'supabase', 'Weekly — Mondays 11:00 AM'),
  ('discovery_cron', 'Discovery Cron', 'Scheduled discovery pipeline for events, people, and grants', 'supabase', 'Daily — 6:00 AM'),
  ('gmail_task_extraction', 'Gmail Task Extraction', 'Scans sent emails for action items and generates task suggestions', 'supabase', 'Daily — 7:00 AM'),
  ('relationship_intelligence', 'Relationship Intelligence', 'Generates relationship actions and story suggestions', 'supabase', 'Weekly — Mondays 9:00 AM'),
  ('archive_automation_runs', 'Archive Old Automation Runs', 'Prunes terminal automation_runs older than 90 days', 'supabase', 'Weekly — Sundays 2:00 AM'),
  ('watchlist_ingest', 'Watchlist Ingest', 'Crawls watched organization websites for changes', 'n8n', 'Daily (capped)'),
  ('system_sweep', 'System Sweep', 'Weekly health check across all metros — verifies ingestion freshness and generates gentle suggestions', 'supabase', 'Weekly — Mondays 7:00 AM')
ON CONFLICT (key) DO NOTHING;
